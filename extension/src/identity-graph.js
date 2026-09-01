import { SafetyError } from "./safety-error.js";

export const SUPPORTED_SYSTEMS = Object.freeze([
  "hint",
  "elation",
  "spruce"
]);

export const LINK_STATES = Object.freeze([
  "candidate",
  "confirmed",
  "conflicted",
  "inaccessible",
  "needs-reverification",
  "revoked"
]);

const SUPPORTED_SYSTEM_SET = new Set(SUPPORTED_SYSTEMS);
const LINK_STATE_SET = new Set(LINK_STATES);
const IDENTITY_EVIDENCE_TYPES = new Set([
  "full-name",
  "date-of-birth",
  "phone",
  "email"
]);
const REQUIRED_IDENTITY_EVIDENCE = new Set(["full-name", "date-of-birth"]);

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isoDate(value) {
  return requiredString(value) && Number.isFinite(Date.parse(value));
}

function assertSystem(system) {
  if (!SUPPORTED_SYSTEM_SET.has(system)) {
    throw new SafetyError("UNSUPPORTED_SYSTEM", system || null);
  }
}

function verifiedEvidence(evidence) {
  if (!Array.isArray(evidence)) {
    return false;
  }
  const matchedTypes = new Set(
    evidence
      .filter(
        (item) => item && typeof item.type === "string" && item.matched === true
      )
      .map((item) => item.type)
  );
  return [...REQUIRED_IDENTITY_EVIDENCE].every((type) =>
    matchedTypes.has(type)
  );
}

function safeEvidence(evidence) {
  return (
    Array.isArray(evidence) &&
    evidence.every(
      (item) =>
        item &&
        IDENTITY_EVIDENCE_TYPES.has(item.type) &&
        typeof item.matched === "boolean"
    )
  );
}

function createScope() {
  return {
    byCanonical: new Map(),
    bySystem: new Map(SUPPORTED_SYSTEMS.map((system) => [system, new Map()]))
  };
}

function systemIdentityKey(systemTenantId, systemPatientId) {
  return JSON.stringify([systemTenantId, systemPatientId]);
}

export class PatientIdentityGraph {
  #scopes = new Map();

  recordLink({
    clinicId,
    canonicalPatientId,
    system,
    systemTenantId,
    systemPatientId,
    status,
    evidence = [],
    confirmedBy = null,
    confirmedAt = null,
    lastVerifiedAt = null,
    adapterVersion = null,
    confirmationMethod = null
  }) {
    assertSystem(system);
    if (
      !requiredString(clinicId) ||
      !requiredString(canonicalPatientId) ||
      !requiredString(systemTenantId) ||
      !requiredString(systemPatientId) ||
      !LINK_STATE_SET.has(status) ||
      !safeEvidence(evidence)
    ) {
      throw new SafetyError("INVALID_INPUT", system);
    }

    if (
      status === "confirmed" &&
      (!requiredString(confirmedBy) ||
        !isoDate(confirmedAt) ||
        !isoDate(lastVerifiedAt) ||
        !requiredString(adapterVersion) ||
        confirmationMethod !== "human" ||
        !verifiedEvidence(evidence))
    ) {
      throw new SafetyError("INVALID_INPUT", system);
    }

    const scope = this.#scope(clinicId, true);
    const patientLinks =
      scope.byCanonical.get(canonicalPatientId) ?? new Map();
    const existingLink = patientLinks.get(system);
    if (
      existingLink &&
      (existingLink.systemTenantId !== systemTenantId ||
        existingLink.systemPatientId !== systemPatientId)
    ) {
      throw new SafetyError("LINK_CONFLICT", system);
    }

    const systemLinks = scope.bySystem.get(system);
    const identityKey = systemIdentityKey(systemTenantId, systemPatientId);
    const linkedCanonical = systemLinks.get(identityKey);
    if (
      status === "confirmed" &&
      linkedCanonical &&
      linkedCanonical !== canonicalPatientId
    ) {
      throw new SafetyError("LINK_CONFLICT", system);
    }

    if (existingLink?.status === "confirmed" && status !== "confirmed") {
      systemLinks.delete(identityKey);
    }

    const link = Object.freeze({
      clinicId,
      canonicalPatientId,
      system,
      systemTenantId,
      systemPatientId,
      status,
      evidence: Object.freeze(
        evidence.map((item) =>
          Object.freeze({ type: item.type, matched: item.matched === true })
        )
      ),
      confirmedBy: status === "confirmed" ? confirmedBy : null,
      confirmedAt: status === "confirmed" ? confirmedAt : null,
      lastVerifiedAt: status === "confirmed" ? lastVerifiedAt : null,
      adapterVersion: status === "confirmed" ? adapterVersion : null,
      confirmationMethod: status === "confirmed" ? confirmationMethod : null
    });

    patientLinks.set(system, link);
    scope.byCanonical.set(canonicalPatientId, patientLinks);
    if (status === "confirmed") {
      systemLinks.set(identityKey, canonicalPatientId);
    }
    return link;
  }

  confirmLink(details) {
    return this.recordLink({ ...details, status: "confirmed" });
  }

  resolve(clinicId, system, systemTenantId, systemPatientId) {
    assertSystem(system);
    if (
      !requiredString(clinicId) ||
      !requiredString(systemTenantId) ||
      !requiredString(systemPatientId)
    ) {
      throw new SafetyError("INVALID_INPUT", system);
    }
    const scope = this.#scope(clinicId, false);
    return (
      scope?.bySystem
        .get(system)
        .get(systemIdentityKey(systemTenantId, systemPatientId)) ?? null
    );
  }

  assertConfirmedMatch(
    clinicId,
    canonicalPatientId,
    system,
    systemTenantId,
    systemPatientId
  ) {
    assertSystem(system);
    const scope = this.#scope(clinicId, false);
    const expected = scope?.byCanonical
      .get(canonicalPatientId)
      ?.get(system);

    if (!expected || expected.status !== "confirmed") {
      throw new SafetyError("LINK_NOT_CONFIRMED", system);
    }
    if (
      expected.systemTenantId !== systemTenantId ||
      expected.systemPatientId !== systemPatientId
    ) {
      throw new SafetyError("PATIENT_MISMATCH", system);
    }
  }

  linksFor(clinicId, canonicalPatientId) {
    const scope = this.#scope(clinicId, false);
    const patientLinks = scope?.byCanonical.get(canonicalPatientId);
    if (!patientLinks) {
      return Object.freeze([]);
    }
    return Object.freeze(
      [...patientLinks.values()].map((link) => Object.freeze({ ...link }))
    );
  }

  #scope(clinicId, create) {
    let scope = this.#scopes.get(clinicId);
    if (!scope && create) {
      scope = createScope();
      this.#scopes.set(clinicId, scope);
    }
    return scope;
  }
}
