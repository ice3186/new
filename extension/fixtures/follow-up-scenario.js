import { createFixtureAdapter } from "../src/fixture-adapter.js";
import { PatientIdentityGraph } from "../src/identity-graph.js";

export const FIXED_NOW = new Date("2026-09-01T15:00:00.000Z");
export const FIXTURE_CLINIC_ID = "synthetic-clinic-001";
export const FIXTURE_RUN_ID = "synthetic-run-001";

export const REQUIRED_FACT_KEYS = Object.freeze([
  "hint.membership.status",
  "elation.encounter.status",
  "elation.follow-up.expected",
  "spruce.follow-up.completed-in-window"
]);

export const FACT_POLICIES = Object.freeze({
  "hint.membership.status": Object.freeze({
    basis: "observed-at",
    maxAgeMs: 15 * 60 * 1000
  }),
  "elation.encounter.status": Object.freeze({
    basis: "source-event-at",
    maxAgeMs: 24 * 60 * 60 * 1000
  }),
  "elation.follow-up.expected": Object.freeze({
    basis: "source-event-at",
    maxAgeMs: 24 * 60 * 60 * 1000
  }),
  "spruce.follow-up.completed-in-window": Object.freeze({
    basis: "observed-at",
    maxAgeMs: 5 * 60 * 1000
  })
});

const IDENTITY_EVIDENCE = Object.freeze([
  Object.freeze({ type: "full-name", matched: true }),
  Object.freeze({ type: "date-of-birth", matched: true })
]);

export function createFollowUpScenario(overrides = {}) {
  const graph = new PatientIdentityGraph();
  const ids = Object.freeze({
    hint: "synthetic-hint-001",
    elation: "synthetic-elation-001",
    spruce: "synthetic-spruce-001"
  });
  const tenantIds = Object.freeze({
    hint: "synthetic-hint-tenant-001",
    elation: "synthetic-elation-tenant-001",
    spruce: "synthetic-spruce-tenant-001"
  });

  for (const [system, systemPatientId] of Object.entries(ids)) {
    graph.confirmLink({
      clinicId: FIXTURE_CLINIC_ID,
      canonicalPatientId: "synthetic-patient-001",
      system,
      systemTenantId: tenantIds[system],
      systemPatientId,
      evidence: overrides.identityEvidence ?? IDENTITY_EVIDENCE,
      confirmedBy: "synthetic-clinician",
      confirmedAt: FIXED_NOW.toISOString(),
      lastVerifiedAt: FIXED_NOW.toISOString(),
      adapterVersion: "fixture-linker-0.1.0",
      confirmationMethod: "human"
    });
  }

  const fixtures = {
    hint: {
      facts: [
        {
          key: "hint.membership.status",
          state: "observed",
          value: "active",
          sourceRef: "synthetic-hint-membership-record",
          sourceEventAt: FIXED_NOW.toISOString()
        }
      ]
    },
    elation: {
      facts: [
        {
          key: "elation.encounter.status",
          state: "observed",
          value: "completed",
          sourceRef: "synthetic-elation-encounter",
          sourceEventAt: "2026-09-01T14:30:00.000Z"
        },
        {
          key: "elation.follow-up.expected",
          state: "observed",
          value: true,
          sourceRef: "synthetic-elation-encounter",
          sourceEventAt: "2026-09-01T14:30:00.000Z"
        }
      ]
    },
    spruce: {
      facts: [
        {
          key: "spruce.follow-up.completed-in-window",
          state: "absent",
          value: null,
          sourceRef: "synthetic-spruce-follow-up-search-30d",
          sourceEventAt: FIXED_NOW.toISOString()
        }
      ]
    }
  };

  const approvedAdapterVersions = Object.fromEntries(
    Object.keys(ids).map((system) => [system, "fixture-0.1.0"])
  );
  const approvedLocatorVersions = Object.fromEntries(
    Object.keys(ids).map((system) => [system, "fixture-locators-0.1.0"])
  );

  const adapters = Object.fromEntries(
    Object.entries(ids).map(([system, systemPatientId]) => {
      const systemOverride = overrides[system] ?? {};
      return [
        system,
        createFixtureAdapter({
          clinicId: FIXTURE_CLINIC_ID,
          system,
          systemTenantId: tenantIds[system],
          version: systemOverride.adapterVersion ?? "fixture-0.1.0",
          locatorVersion:
            systemOverride.locatorVersion ?? "fixture-locators-0.1.0",
          activePatientIds:
            system === "elation"
              ? overrides.activePatientIds ?? [systemPatientId]
              : [systemPatientId],
          patients: {
            [systemPatientId]: {
              ...fixtures[system],
              ...systemOverride
            }
          }
        })
      ];
    })
  );

  return Object.freeze({
    graph,
    adapters,
    ids,
    tenantIds,
    approvedAdapterVersions: Object.freeze(approvedAdapterVersions),
    approvedLocatorVersions: Object.freeze(approvedLocatorVersions),
    factPolicies: FACT_POLICIES,
    requiredFactKeys: REQUIRED_FACT_KEYS
  });
}
