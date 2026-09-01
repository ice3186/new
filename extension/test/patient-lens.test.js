import assert from "node:assert/strict";
import test from "node:test";

import {
  createFollowUpScenario,
  FIXED_NOW,
  FIXTURE_CLINIC_ID,
  FIXTURE_RUN_ID
} from "../fixtures/follow-up-scenario.js";
import {
  resultMatchesActiveAnchor,
  runPatientLens
} from "../src/patient-lens.js";
import { recordSuggestionFeedback } from "../src/suggestions.js";

function run(scenario, overrides = {}) {
  return runPatientLens({
    runId: FIXTURE_RUN_ID,
    clinicId: FIXTURE_CLINIC_ID,
    identityGraph: scenario.graph,
    activeSystem: "elation",
    adapters: scenario.adapters,
    approvedAdapterVersions: scenario.approvedAdapterVersions,
    approvedLocatorVersions: scenario.approvedLocatorVersions,
    factPolicies: scenario.factPolicies,
    requiredFactKeys: scenario.requiredFactKeys,
    clock: () => FIXED_NOW,
    ...overrides
  });
}

test("assembles three fresh systems into one evidence-backed suggestion", async () => {
  const result = await run(createFollowUpScenario());

  assert.equal(result.status, "ready");
  assert.equal(result.facts.length, 4);
  assert.deepEqual(result.missingSystems, []);
  assert.deepEqual(result.missingFactKeys, []);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].approvalRequired, true);
  assert.deepEqual(
    [...new Set(result.suggestions[0].evidence.map((item) => item.sourceSystem))],
    ["elation", "spruce", "hint"]
  );
  assert.equal(
    result.suggestions[0].evidence.every(
      (item) => item.sourceRef && item.freshness === "fresh"
    ),
    true
  );
  assert.deepEqual(result.feedbackOptions, ["accept", "dismiss"]);
});

test("resolves the same patient from any of the three active systems", async () => {
  for (const activeSystem of ["hint", "elation", "spruce"]) {
    const result = await run(createFollowUpScenario(), { activeSystem });
    assert.equal(result.status, "ready");
    assert.equal(result.subject.activeAnchor.system, activeSystem);
    assert.equal(result.subject.canonicalPatientId, "synthetic-patient-001");
  }
});

test("produces byte-equivalent output with an injected clock", async () => {
  const first = await run(createFollowUpScenario());
  const second = await run(createFollowUpScenario());
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("returns partial context when a source is unavailable", async () => {
  const scenario = createFollowUpScenario();
  const adapters = { ...scenario.adapters };
  delete adapters.spruce;

  const result = await run({ ...scenario, adapters });
  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.missingSystems, ["spruce"]);
  assert.deepEqual(result.suggestions, []);
  assert.equal(result.facts.length, 3);
});

test("suppresses suggestions and identifies stale scrape evidence", async () => {
  const oldObservation = new Date(
    FIXED_NOW.getTime() - 5 * 60 * 1000 - 1
  ).toISOString();
  const result = await run(
    createFollowUpScenario({
      spruce: {
        observedAt: oldObservation,
        facts: [
          {
            key: "spruce.follow-up.completed-in-window",
            state: "absent",
            value: null,
            sourceRef: "synthetic-stale-spruce-search",
            sourceEventAt: oldObservation
          }
        ]
      }
    })
  );

  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.missingSystems, ["spruce"]);
  assert.deepEqual(result.suggestions, []);
});

test("suppresses suggestions when a source clinical event is expired", async () => {
  const result = await run(
    createFollowUpScenario({
      elation: {
        facts: [
          {
            key: "elation.encounter.status",
            state: "observed",
            value: "completed",
            sourceRef: "synthetic-old-encounter",
            sourceEventAt: "2020-01-01T00:00:00.000Z"
          },
          {
            key: "elation.follow-up.expected",
            state: "observed",
            value: true,
            sourceRef: "synthetic-old-encounter",
            sourceEventAt: "2020-01-01T00:00:00.000Z"
          }
        ]
      }
    })
  );

  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.missingSystems, ["elation"]);
  assert.deepEqual(result.suggestions, []);
});

test("a fresh unrelated fact cannot satisfy a required fact", async () => {
  const scenario = createFollowUpScenario({
    spruce: {
      facts: [
        {
          key: "spruce.other.status",
          state: "observed",
          value: "ok",
          sourceRef: "synthetic-unrelated-record",
          sourceEventAt: FIXED_NOW.toISOString()
        }
      ]
    }
  });
  const factPolicies = {
    ...scenario.factPolicies,
    "spruce.other.status": {
      basis: "observed-at",
      maxAgeMs: 5 * 60 * 1000
    }
  };
  const result = await run(scenario, { factPolicies });

  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.missingFactKeys, [
    "spruce.follow-up.completed-in-window"
  ]);
  assert.deepEqual(result.suggestions, []);
});

test("aborts when a target adapter observes another patient", async () => {
  const sentinel = "synthetic-wrong-patient-secret";
  const scenario = createFollowUpScenario({
    spruce: { observedPatientId: sentinel }
  });

  await assert.rejects(
    () => run(scenario),
    (error) => {
      assert.equal(error.code, "PATIENT_MISMATCH");
      assert.equal(JSON.stringify(error).includes(sentinel), false);
      return true;
    }
  );
});

test("aborts when the clinician switches patients", async () => {
  const scenario = createFollowUpScenario({
    activePatientIds: [
      "synthetic-elation-001",
      "synthetic-elation-other"
    ]
  });

  await assert.rejects(
    () => run(scenario),
    (error) => error.code === "PATIENT_CHANGED"
  );
});

test("rejects adapters and anchors that claim another system", async () => {
  const scenario = createFollowUpScenario();
  const wrongRegistry = {
    ...scenario.adapters,
    elation: scenario.adapters.hint
  };
  await assert.rejects(
    () => run({ ...scenario, adapters: wrongRegistry }),
    (error) => error.code === "INVALID_PROVENANCE"
  );

  const wrongAnchorAdapter = {
    ...scenario.adapters.elation,
    detectPatient: async () => ({
      system: "hint",
      systemPatientId: scenario.ids.hint
    })
  };
  await assert.rejects(
    () =>
      run({
        ...scenario,
        adapters: { ...scenario.adapters, elation: wrongAnchorAdapter }
      }),
    (error) => error.code === "INVALID_PROVENANCE"
  );

  const observationMismatchAdapter = {
    ...scenario.adapters.spruce,
    readFacts: async (request) => ({
      ...(await scenario.adapters.spruce.readFacts(request)),
      system: "hint"
    })
  };
  await assert.rejects(
    () =>
      run({
        ...scenario,
        adapters: {
          ...scenario.adapters,
          spruce: observationMismatchAdapter
        }
      }),
    (error) => error.code === "INVALID_PROVENANCE"
  );
});

test("rejects an adapter version not in the external allowlist", async () => {
  const scenario = createFollowUpScenario({
    hint: { adapterVersion: "never-reviewed-999" }
  });
  let reads = 0;
  const hint = {
    ...scenario.adapters.hint,
    readFacts: async (request) => {
      reads += 1;
      return scenario.adapters.hint.readFacts(request);
    }
  };

  await assert.rejects(
    () =>
      run({
        ...scenario,
        adapters: { ...scenario.adapters, hint }
      }),
    (error) => error.code === "UNSUPPORTED_ADAPTER"
  );
  assert.equal(reads, 0);
});

test("sanitizes raw initial detection errors", async () => {
  const sentinel = "raw-patient-secret-in-dom-or-url";
  const scenario = createFollowUpScenario();
  const adapters = {
    ...scenario.adapters,
    elation: {
      ...scenario.adapters.elation,
      detectPatient: async () => {
        throw new Error(sentinel);
      }
    }
  };

  await assert.rejects(
    () => run({ ...scenario, adapters }),
    (error) => {
      assert.equal(error.code, "SOURCE_UNAVAILABLE");
      assert.equal(JSON.stringify(error).includes(sentinel), false);
      return true;
    }
  );
});

test("binds output to an active anchor for a final display check", async () => {
  const result = await run(createFollowUpScenario());
  const currentContext = {
    runId: result.subject.runId,
    clinicId: result.subject.clinicId,
    ...result.subject.activeAnchor
  };
  assert.equal(
    resultMatchesActiveAnchor(result, currentContext),
    true
  );
  assert.equal(
    resultMatchesActiveAnchor(result, {
      ...currentContext,
      clinicId: "synthetic-other-clinic"
    }),
    false
  );
});

test("rejects tenant-spoofed observations", async () => {
  const scenario = createFollowUpScenario();
  const spruce = {
    ...scenario.adapters.spruce,
    readFacts: async (request) => ({
      ...(await scenario.adapters.spruce.readFacts(request)),
      clinicId: "synthetic-other-clinic"
    })
  };

  await assert.rejects(
    () =>
      run({
        ...scenario,
        adapters: { ...scenario.adapters, spruce }
      }),
    (error) => error.code === "INVALID_PROVENANCE"
  );
});

test("normalizes anchors and discards extra adapter data", async () => {
  const scenario = createFollowUpScenario();
  const original = scenario.adapters.elation;
  const elation = {
    ...original,
    detectPatient: async (request) => ({
      ...(await original.detectPatient(request)),
      patientName: "synthetic-secret-name",
      nested: { shouldNotEscape: true }
    })
  };
  const result = await run({
    ...scenario,
    adapters: { ...scenario.adapters, elation }
  });

  assert.deepEqual(Object.keys(result.subject.activeAnchor).sort(), [
    "system",
    "systemPatientId",
    "systemTenantId"
  ]);
  assert.equal(JSON.stringify(result.subject.activeAnchor).includes("secret"), false);
});

test("cancels a run when a source link is invalidated during assembly", async () => {
  const scenario = createFollowUpScenario();
  const original = scenario.adapters.elation;
  const elation = {
    ...original,
    readFacts: async (request) => {
      scenario.graph.recordLink({
        clinicId: FIXTURE_CLINIC_ID,
        canonicalPatientId: "synthetic-patient-001",
        system: "hint",
        systemTenantId: scenario.tenantIds.hint,
        systemPatientId: scenario.ids.hint,
        status: "needs-reverification"
      });
      return original.readFacts(request);
    }
  };

  await assert.rejects(
    () =>
      run({
        ...scenario,
        adapters: { ...scenario.adapters, elation }
      }),
    (error) => error.code === "LINK_NOT_CONFIRMED"
  );
});

test("snapshots freshness policy before adapter execution", async () => {
  const scenario = createFollowUpScenario();
  const elationPolicy = {
    basis: "source-event-at",
    maxAgeMs: 1
  };
  const factPolicies = {
    ...scenario.factPolicies,
    "elation.encounter.status": elationPolicy,
    "elation.follow-up.expected": elationPolicy
  };
  const original = scenario.adapters.elation;
  const elation = {
    ...original,
    detectPatient: async (request) => {
      elationPolicy.maxAgeMs = 100 * 365 * 24 * 60 * 60 * 1000;
      return original.detectPatient(request);
    }
  };
  const result = await run(
    {
      ...scenario,
      adapters: { ...scenario.adapters, elation }
    },
    { factPolicies }
  );

  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.missingSystems, ["elation"]);
  assert.deepEqual(result.suggestions, []);
});

test("captures synthetic accept or dismiss feedback without patient data", async () => {
  const result = await run(createFollowUpScenario());
  const feedback = recordSuggestionFeedback({
    suggestionId: result.suggestions[0].id,
    outcome: "accept",
    at: FIXED_NOW.toISOString()
  });

  assert.deepEqual(feedback, {
    event: "suggestion_feedback",
    suggestionId: "review-missing-follow-up",
    outcome: "accept",
    at: FIXED_NOW.toISOString()
  });
  assert.equal(JSON.stringify(feedback).includes("synthetic-patient"), false);
});

test("the synthetic slice performs no network requests", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("network disabled in Stage 1");
  };

  try {
    await run(createFollowUpScenario());
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
