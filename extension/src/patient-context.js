import { SafetyError, safeTelemetry } from "./safety-error.js";
import { SUPPORTED_SYSTEMS } from "./identity-graph.js";

const SUPPORTED_SYSTEM_SET = new Set(SUPPORTED_SYSTEMS);
const FACT_KEY = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/;
const FACT_STATES = new Set([
  "observed",
  "absent",
  "unavailable",
  "ambiguous"
]);

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value) {
  return requiredString(value) && Number.isFinite(Date.parse(value));
}

function isScalar(value) {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function validateFact(fact, system, observedAt) {
  const state = fact?.state;
  const stateAndValueAgree =
    (state === "observed" && fact.value !== null) ||
    (state !== "observed" && fact?.value === null);

  if (
    !fact ||
    typeof fact !== "object" ||
    !FACT_KEY.test(fact.key ?? "") ||
    !fact.key.startsWith(`${system}.`) ||
    !FACT_STATES.has(state) ||
    !stateAndValueAgree ||
    !isScalar(fact.value) ||
    !requiredString(fact.sourceRef) ||
    !isIsoDate(fact.sourceEventAt) ||
    Date.parse(fact.sourceEventAt) > Date.parse(observedAt)
  ) {
    throw new SafetyError("INVALID_PROVENANCE", system);
  }
}

function temporallyFresh(fact, now) {
  return (
    now.getTime() >= Date.parse(fact.observedAt) &&
    now.getTime() <= Date.parse(fact.expiresAt)
  );
}

function usable(fact, now) {
  return (
    temporallyFresh(fact, now) &&
    ["observed", "absent"].includes(fact.state)
  );
}

export class PatientContextSession {
  #identityGraph;
  #clinicId;
  #canonicalPatientId;
  #approvedAdapterVersions;
  #approvedLocatorVersions;
  #factPolicies;
  #facts = new Map();
  #events = [];
  #closed = false;
  #clock;

  static start({
    identityGraph,
    clinicId,
    activeSystem,
    activeSystemTenantId,
    activeSystemPatientId,
    approvedAdapterVersions,
    approvedLocatorVersions,
    factPolicies,
    clock = () => new Date()
  }) {
    if (!identityGraph || !requiredString(clinicId)) {
      throw new SafetyError("INVALID_INPUT", activeSystem || null);
    }
    if (!SUPPORTED_SYSTEM_SET.has(activeSystem)) {
      throw new SafetyError("UNSUPPORTED_SYSTEM", activeSystem || null);
    }

    const canonicalPatientId = identityGraph.resolve(
      clinicId,
      activeSystem,
      activeSystemTenantId,
      activeSystemPatientId
    );
    if (!canonicalPatientId) {
      throw new SafetyError("LINK_NOT_CONFIRMED", activeSystem);
    }

    return new PatientContextSession({
      identityGraph,
      clinicId,
      canonicalPatientId,
      approvedAdapterVersions,
      approvedLocatorVersions,
      factPolicies,
      clock
    });
  }

  constructor({
    identityGraph,
    clinicId,
    canonicalPatientId,
    approvedAdapterVersions,
    approvedLocatorVersions,
    factPolicies,
    clock
  }) {
    this.#identityGraph = identityGraph;
    this.#clinicId = clinicId;
    this.#canonicalPatientId = canonicalPatientId;
    this.#approvedAdapterVersions = Object.freeze({
      ...approvedAdapterVersions
    });
    this.#approvedLocatorVersions = Object.freeze({
      ...approvedLocatorVersions
    });
    this.#factPolicies = Object.freeze(
      Object.fromEntries(
        Object.entries(factPolicies ?? {}).map(([key, policy]) => [
          key,
          Object.freeze({
            basis: policy?.basis,
            maxAgeMs: policy?.maxAgeMs
          })
        ])
      )
    );
    this.#clock = clock;
  }

  observe({
    clinicId,
    system,
    systemTenantId,
    systemPatientId,
    adapterVersion,
    locatorVersion,
    observedAt,
    identityMatchCount,
    identityVerified,
    complete,
    facts
  }) {
    try {
      this.#assertOpen(system);

      if (!SUPPORTED_SYSTEM_SET.has(system)) {
        throw new SafetyError("UNSUPPORTED_SYSTEM", system || null);
      }
      if (clinicId !== this.#clinicId || !requiredString(systemTenantId)) {
        throw new SafetyError("INVALID_PROVENANCE", system);
      }
      if (this.#approvedAdapterVersions[system] !== adapterVersion) {
        throw new SafetyError("UNSUPPORTED_ADAPTER", system);
      }
      if (this.#approvedLocatorVersions[system] !== locatorVersion) {
        throw new SafetyError("UNSUPPORTED_ADAPTER", system);
      }
      if (identityMatchCount !== 1) {
        throw new SafetyError("AMBIGUOUS_IDENTITY", system);
      }
      if (identityVerified !== true) {
        throw new SafetyError("PATIENT_MISMATCH", system);
      }
      if (complete !== true) {
        throw new SafetyError("INCOMPLETE_EVIDENCE", system);
      }

      this.#identityGraph.assertConfirmedMatch(
        this.#clinicId,
        this.#canonicalPatientId,
        system,
        systemTenantId,
        systemPatientId
      );

      if (!isIsoDate(observedAt) || !Array.isArray(facts)) {
        throw new SafetyError("INVALID_PROVENANCE", system);
      }
      if (Date.parse(observedAt) > this.#clock().getTime()) {
        throw new SafetyError("INVALID_PROVENANCE", system);
      }

      for (const fact of facts) {
        validateFact(fact, system, observedAt);
        const policy = this.#factPolicies[fact.key];
        if (
          this.#facts.has(fact.key) ||
          !policy ||
          !Number.isFinite(policy.maxAgeMs) ||
          policy.maxAgeMs <= 0 ||
          !["observed-at", "source-event-at"].includes(policy.basis)
        ) {
          throw new SafetyError("INVALID_PROVENANCE", system);
        }
      }
      if (new Set(facts.map((fact) => fact.key)).size !== facts.length) {
        throw new SafetyError("INVALID_PROVENANCE", system);
      }

      for (const fact of facts) {
        const policy = this.#factPolicies[fact.key];
        const freshnessBase =
          policy.basis === "source-event-at"
            ? fact.sourceEventAt
            : observedAt;
        this.#facts.set(
          fact.key,
          Object.freeze({
            key: fact.key,
            state: fact.state,
            value: fact.value,
            subject: Object.freeze({
              clinicId: this.#clinicId,
              canonicalPatientId: this.#canonicalPatientId,
              sourceSystemTenantId: systemTenantId,
              sourceSystemPatientId: systemPatientId
            }),
            sourceSystem: system,
            sourceRef: fact.sourceRef,
            sourceEventAt: fact.sourceEventAt,
            adapterVersion,
            locatorVersion,
            observedAt,
            expiresAt: new Date(
              Date.parse(freshnessBase) + policy.maxAgeMs
            ).toISOString(),
            freshnessBasis: policy.basis,
            completeness: "complete"
          })
        );
      }

      this.#events.push(
        Object.freeze({
          event: "observation_accepted",
          system,
          factCount: facts.length,
          at: this.#clock().toISOString()
        })
      );
    } catch (error) {
      this.#fail(error);
    }
  }

  verifyActivePatient(system, systemTenantId, systemPatientId) {
    try {
      this.#assertOpen(system);
      this.#identityGraph.assertConfirmedMatch(
        this.#clinicId,
        this.#canonicalPatientId,
        system,
        systemTenantId,
        systemPatientId
      );
    } catch (error) {
      const failure =
        error instanceof SafetyError && error.code === "PATIENT_MISMATCH"
          ? new SafetyError("PATIENT_CHANGED", system)
          : error;
      this.#fail(failure);
    }
  }

  getFreshFact(key) {
    this.#assertOpen();
    const fact = this.#facts.get(key);
    return fact && usable(fact, this.#clock()) ? fact : null;
  }

  factStates() {
    this.#assertOpen();
    const now = this.#clock();
    return Object.freeze(
      [...this.#facts.values()]
        .map((fact) =>
          Object.freeze({
            ...fact,
            freshness: temporallyFresh(fact, now) ? "fresh" : "stale"
          })
        )
        .sort((left, right) => left.key.localeCompare(right.key))
    );
  }

  safeEvents() {
    return Object.freeze([...this.#events]);
  }

  close() {
    this.#facts.clear();
    this.#clinicId = null;
    this.#canonicalPatientId = null;
    this.#closed = true;
  }

  #assertOpen(system = null) {
    if (this.#closed) {
      throw new SafetyError("SESSION_CLOSED", system);
    }
  }

  #fail(error) {
    const failure =
      error instanceof SafetyError
        ? error
        : new SafetyError("SOURCE_UNAVAILABLE");
    this.#events.push(safeTelemetry(failure, this.#clock().toISOString()));
    this.close();
    throw failure;
  }
}
