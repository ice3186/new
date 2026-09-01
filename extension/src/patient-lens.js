import { PatientContextSession } from "./patient-context.js";
import { SUPPORTED_SYSTEMS } from "./identity-graph.js";
import { SafetyError, safeTelemetry } from "./safety-error.js";
import { suggestNextSteps } from "./suggestions.js";

const IDENTITY_FAILURES = new Set([
  "AMBIGUOUS_IDENTITY",
  "LINK_CONFLICT",
  "PATIENT_CHANGED",
  "PATIENT_MISMATCH"
]);

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeFailure(error, system) {
  return error instanceof SafetyError
    ? error
    : new SafetyError("SOURCE_UNAVAILABLE", system);
}

function normalizeAnchor(anchor, clinicId, system) {
  if (
    anchor?.clinicId !== clinicId ||
    anchor?.system !== system ||
    !requiredString(anchor.systemTenantId) ||
    !requiredString(anchor.systemPatientId)
  ) {
    throw new SafetyError("INVALID_PROVENANCE", system);
  }
  return Object.freeze({
    system,
    systemTenantId: anchor.systemTenantId,
    systemPatientId: anchor.systemPatientId
  });
}

function snapshotPolicies(factPolicies) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(factPolicies ?? {}).map(([key, policy]) => {
        if (
          !requiredString(key) ||
          !["observed-at", "source-event-at"].includes(policy?.basis) ||
          !Number.isFinite(policy?.maxAgeMs) ||
          policy.maxAgeMs <= 0
        ) {
          throw new SafetyError("INVALID_INPUT");
        }
        return [
          key,
          Object.freeze({
            basis: policy.basis,
            maxAgeMs: policy.maxAgeMs
          })
        ];
      })
    )
  );
}

export function resultMatchesActiveAnchor(result, currentContext) {
  const anchor = result?.subject?.activeAnchor;
  return Boolean(
    anchor &&
      currentContext &&
      result.subject.runId === currentContext.runId &&
      result.subject.clinicId === currentContext.clinicId &&
      anchor.system === currentContext.system &&
      anchor.systemTenantId === currentContext.systemTenantId &&
      anchor.systemPatientId === currentContext.systemPatientId
  );
}

export async function runPatientLens({
  runId,
  clinicId,
  identityGraph,
  activeSystem,
  adapters,
  approvedAdapterVersions,
  approvedLocatorVersions,
  factPolicies,
  requiredFactKeys,
  clock = () => new Date()
}) {
  let context = null;
  const runEvents = [];

  try {
    if (
      !requiredString(runId) ||
      !requiredString(clinicId) ||
      !SUPPORTED_SYSTEMS.includes(activeSystem) ||
      !Array.isArray(requiredFactKeys)
    ) {
      throw new SafetyError("INVALID_INPUT", activeSystem);
    }

    const versionSnapshot = Object.freeze({ ...approvedAdapterVersions });
    const locatorSnapshot = Object.freeze({ ...approvedLocatorVersions });
    const policySnapshot = snapshotPolicies(factPolicies);
    const requiredKeySnapshot = Object.freeze([...requiredFactKeys]);

    for (const system of SUPPORTED_SYSTEMS) {
      const adapter = adapters[system];
      if (!adapter) {
        continue;
      }
      if (adapter.system !== system) {
        throw new SafetyError("INVALID_PROVENANCE", system);
      }
      if (
        adapter.version !== versionSnapshot[system] ||
        adapter.locatorVersion !== locatorSnapshot[system]
      ) {
        throw new SafetyError("UNSUPPORTED_ADAPTER", system);
      }
    }

    const activeAdapter = adapters[activeSystem];
    if (!activeAdapter) {
      throw new SafetyError("SOURCE_UNAVAILABLE", activeSystem);
    }

    const initialAnchor = normalizeAnchor(
      await activeAdapter.detectPatient({ clinicId }),
      clinicId,
      activeSystem
    );
    const canonicalPatientId = identityGraph.resolve(
      clinicId,
      activeSystem,
      initialAnchor.systemTenantId,
      initialAnchor.systemPatientId
    );
    if (!canonicalPatientId) {
      throw new SafetyError("LINK_NOT_CONFIRMED", activeSystem);
    }

    const links = identityGraph.linksFor(clinicId, canonicalPatientId);
    const linkBySystem = new Map(links.map((link) => [link.system, link]));
    const sourceStates = [];

    context = PatientContextSession.start({
      identityGraph,
      clinicId,
      activeSystem,
      activeSystemTenantId: initialAnchor.systemTenantId,
      activeSystemPatientId: initialAnchor.systemPatientId,
      approvedAdapterVersions: versionSnapshot,
      approvedLocatorVersions: locatorSnapshot,
      factPolicies: policySnapshot,
      clock
    });

    for (const system of SUPPORTED_SYSTEMS) {
      const adapter = adapters[system];
      const link = linkBySystem.get(system);

      if (!link || link.status !== "confirmed") {
        sourceStates.push(Object.freeze({ system, state: "unlinked" }));
        continue;
      }
      if (!adapter) {
        const failure = new SafetyError("SOURCE_UNAVAILABLE", system);
        runEvents.push(safeTelemetry(failure, clock().toISOString()));
        sourceStates.push(Object.freeze({ system, state: "unavailable" }));
        continue;
      }

      let observation;
      try {
        observation = await adapter.readFacts({
          clinicId,
          systemTenantId: link.systemTenantId,
          systemPatientId: link.systemPatientId,
          now: clock()
        });
      } catch (error) {
        const failure = safeFailure(error, system);
        if (IDENTITY_FAILURES.has(failure.code)) {
          throw failure;
        }
        runEvents.push(safeTelemetry(failure, clock().toISOString()));
        sourceStates.push(Object.freeze({ system, state: "unavailable" }));
        continue;
      }

      if (
        observation?.clinicId !== clinicId ||
        observation?.system !== system ||
        observation?.systemTenantId !== link.systemTenantId
      ) {
        throw new SafetyError("INVALID_PROVENANCE", system);
      }
      if (observation.complete !== true) {
        const failure = new SafetyError("INCOMPLETE_EVIDENCE", system);
        runEvents.push(safeTelemetry(failure, clock().toISOString()));
        sourceStates.push(Object.freeze({ system, state: "incomplete" }));
        continue;
      }

      context.observe(observation);
      sourceStates.push(Object.freeze({ system, state: "observed" }));
    }

    const finalAnchor = normalizeAnchor(
      await activeAdapter.detectPatient({ clinicId }),
      clinicId,
      activeSystem
    );
    context.verifyActivePatient(
      activeSystem,
      finalAnchor.systemTenantId,
      finalAnchor.systemPatientId
    );

    const facts = context.factStates();
    for (const fact of facts) {
      identityGraph.assertConfirmedMatch(
        fact.subject.clinicId,
        fact.subject.canonicalPatientId,
        fact.sourceSystem,
        fact.subject.sourceSystemTenantId,
        fact.subject.sourceSystemPatientId
      );
    }

    const missingFactKeys = requiredKeySnapshot.filter(
      (key) =>
        !facts.some(
          (fact) =>
            fact.key === key &&
            fact.freshness === "fresh" &&
            ["observed", "absent"].includes(fact.state)
        )
    );
    const missingSystems = SUPPORTED_SYSTEMS.filter((system) => {
      const source = sourceStates.find((item) => item.system === system);
      return (
        source?.state !== "observed" ||
        missingFactKeys.some((key) => key.startsWith(`${system}.`))
      );
    });
    const ready = missingFactKeys.length === 0 && missingSystems.length === 0;

    return Object.freeze({
      status: ready ? "ready" : "incomplete",
      subject: Object.freeze({
        runId,
        clinicId,
        canonicalPatientId,
        activeAnchor: initialAnchor,
        assembledAt: clock().toISOString()
      }),
      facts,
      sourceStates: Object.freeze(sourceStates),
      missingSystems: Object.freeze(missingSystems),
      missingFactKeys: Object.freeze(missingFactKeys),
      suggestions: ready ? suggestNextSteps(context) : Object.freeze([]),
      feedbackOptions: Object.freeze(["accept", "dismiss"]),
      safeEvents: Object.freeze([...context.safeEvents(), ...runEvents])
    });
  } catch (error) {
    context?.close();
    throw safeFailure(error, activeSystem);
  }
}
