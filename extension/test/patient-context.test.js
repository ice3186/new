import assert from "node:assert/strict";
import test from "node:test";

import { PatientIdentityGraph } from "../src/identity-graph.js";
import { PatientContextSession } from "../src/patient-context.js";
import { SafetyError, safeTelemetry } from "../src/safety-error.js";

const START = new Date("2026-09-01T15:00:00.000Z");
const CLINIC = "synthetic-clinic-1";

function setup(clock = () => START) {
  const graph = new PatientIdentityGraph();
  for (const [system, systemPatientId] of [
    ["elation", "synthetic-elation-1"],
    ["spruce", "synthetic-spruce-1"]
  ]) {
    graph.confirmLink({
      clinicId: CLINIC,
      canonicalPatientId: "synthetic-canonical-1",
      system,
      systemTenantId: `synthetic-${system}-tenant-1`,
      systemPatientId,
      evidence: [
        { type: "full-name", matched: true },
        { type: "date-of-birth", matched: true }
      ],
      confirmedBy: "synthetic-reviewer",
      confirmedAt: START.toISOString(),
      lastVerifiedAt: START.toISOString(),
      adapterVersion: "fixture-linker-0.1.0",
      confirmationMethod: "human"
    });
  }

  const context = PatientContextSession.start({
    identityGraph: graph,
    clinicId: CLINIC,
    activeSystem: "elation",
    activeSystemTenantId: "synthetic-elation-tenant-1",
    activeSystemPatientId: "synthetic-elation-1",
    approvedAdapterVersions: {
      elation: "0.1.0",
      spruce: "0.1.0"
    },
    approvedLocatorVersions: {
      elation: "locators-0.1.0",
      spruce: "locators-0.1.0"
    },
    factPolicies: {
      "spruce.communication.unread-count": {
        basis: "observed-at",
        maxAgeMs: 5 * 60 * 1000
      }
    },
    clock
  });

  return { graph, context };
}

function observation(overrides = {}) {
  return {
    clinicId: CLINIC,
    system: "spruce",
    systemTenantId: "synthetic-spruce-tenant-1",
    systemPatientId: "synthetic-spruce-1",
    adapterVersion: "0.1.0",
    locatorVersion: "locators-0.1.0",
    observedAt: START.toISOString(),
    identityMatchCount: 1,
    identityVerified: true,
    complete: true,
    facts: [
      {
        key: "spruce.communication.unread-count",
        state: "observed",
        value: 1,
        sourceRef: "synthetic-spruce-inbox",
        sourceEventAt: START.toISOString()
      }
    ],
    ...overrides
  };
}

test("accepts a verified scalar fact with full provenance", () => {
  const { context } = setup();
  context.observe(observation());

  const fact = context.getFreshFact("spruce.communication.unread-count");
  assert.equal(fact.value, 1);
  assert.equal(fact.state, "observed");
  assert.equal(fact.sourceRef, "synthetic-spruce-inbox");
  assert.equal(fact.locatorVersion, "locators-0.1.0");
  assert.equal(fact.subject.clinicId, CLINIC);
  assert.equal(fact.completeness, "complete");
});

test("fails closed on a wrong patient and emits PHI-free telemetry", () => {
  const { context } = setup();
  const wrongPatientId = "synthetic-wrong-patient-secret";

  assert.throws(
    () => context.observe(observation({ systemPatientId: wrongPatientId })),
    (error) => error.code === "PATIENT_MISMATCH"
  );

  assert.equal(JSON.stringify(context.safeEvents()).includes(wrongPatientId), false);
  assert.throws(
    () => context.factStates(),
    (error) => error.code === "SESSION_CLOSED"
  );
});

test("fails closed on ambiguity, incomplete evidence, and unapproved versions", () => {
  for (const [overrides, code] of [
    [{ identityMatchCount: 2 }, "AMBIGUOUS_IDENTITY"],
    [{ complete: false }, "INCOMPLETE_EVIDENCE"],
    [{ adapterVersion: "0.2.0" }, "UNSUPPORTED_ADAPTER"],
    [{ locatorVersion: "locators-0.2.0" }, "UNSUPPORTED_ADAPTER"]
  ]) {
    const { context } = setup();
    assert.throws(
      () => context.observe(observation(overrides)),
      (error) => error.code === code
    );
  }
});

test("rejects duplicates and structured values", () => {
  const { context } = setup();
  const duplicate = observation().facts[0];
  assert.throws(
    () =>
      context.observe(
        observation({ facts: [duplicate, { ...duplicate }] })
      ),
    (error) => error.code === "INVALID_PROVENANCE"
  );

  const second = setup().context;
  assert.throws(
    () =>
      second.observe(
        observation({
          facts: [{ ...duplicate, value: { mutable: true } }]
        })
      ),
    (error) => error.code === "INVALID_PROVENANCE"
  );
});

test("rejects observations from the future", () => {
  const { context } = setup();
  const future = new Date(START.getTime() + 60_000).toISOString();

  assert.throws(
    () => context.observe(observation({ observedAt: future })),
    (error) => error.code === "INVALID_PROVENANCE"
  );
});

test("keeps availability state separate from temporal freshness", () => {
  for (const state of ["ambiguous", "unavailable"]) {
    const { context } = setup();
    const fact = observation().facts[0];
    context.observe(
      observation({ facts: [{ ...fact, state, value: null }] })
    );

    const [stored] = context.factStates();
    assert.equal(stored.state, state);
    assert.equal(stored.freshness, "fresh");
    assert.equal(
      context.getFreshFact("spruce.communication.unread-count"),
      null
    );
  }
});

test("does not serialize an arbitrary unsupported system value", () => {
  const sentinel = "raw-patient-secret-system";
  const error = new SafetyError("UNSUPPORTED_SYSTEM", sentinel);

  assert.equal(JSON.stringify(error).includes(sentinel), false);
});

test("does not serialize arbitrary error codes", () => {
  const sentinel = "raw-patient-secret-in-error-code";
  const error = new SafetyError(sentinel, "spruce");
  const telemetry = safeTelemetry(error, START.toISOString());

  assert.equal(error.code, "UNEXPECTED_FAILURE");
  assert.equal(JSON.stringify(error).includes(sentinel), false);
  assert.equal(JSON.stringify(telemetry).includes(sentinel), false);
});

test("clears in-memory facts when the patient session closes", () => {
  const { context } = setup();
  context.observe(observation());
  context.close();

  assert.throws(
    () => context.factStates(),
    (error) => error.code === "SESSION_CLOSED"
  );
});
