import assert from "node:assert/strict";
import test from "node:test";

import { PatientIdentityGraph } from "../src/identity-graph.js";

const NOW = "2026-09-01T15:00:00.000Z";
const EVIDENCE = Object.freeze([
  Object.freeze({ type: "full-name", matched: true }),
  Object.freeze({ type: "date-of-birth", matched: true })
]);

function link(graph, overrides = {}) {
  return graph.confirmLink({
    clinicId: "synthetic-clinic-1",
    canonicalPatientId: "synthetic-canonical-1",
    system: "elation",
    systemTenantId: "synthetic-elation-tenant-1",
    systemPatientId: "synthetic-elation-1",
    evidence: EVIDENCE,
    confirmedBy: "synthetic-reviewer",
    confirmedAt: NOW,
    lastVerifiedAt: NOW,
    adapterVersion: "fixture-linker-0.1.0",
    confirmationMethod: "human",
    ...overrides
  });
}

test("resolves a human-confirmed system identity within its clinic", () => {
  const graph = new PatientIdentityGraph();
  link(graph);

  assert.equal(
    graph.resolve(
      "synthetic-clinic-1",
      "elation",
      "synthetic-elation-tenant-1",
      "synthetic-elation-1"
    ),
    "synthetic-canonical-1"
  );
  assert.equal(
    graph.resolve(
      "synthetic-clinic-2",
      "elation",
      "synthetic-elation-tenant-1",
      "synthetic-elation-1"
    ),
    null
  );
});

test("allows vendor-local identifiers to repeat safely across clinics", () => {
  const graph = new PatientIdentityGraph();
  link(graph);
  link(graph, {
    clinicId: "synthetic-clinic-2",
    canonicalPatientId: "synthetic-canonical-2"
  });

  assert.equal(
    graph.resolve(
      "synthetic-clinic-2",
      "elation",
      "synthetic-elation-tenant-1",
      "synthetic-elation-1"
    ),
    "synthetic-canonical-2"
  );
});

test("rejects model confirmation or mismatched identity evidence", () => {
  const graph = new PatientIdentityGraph();

  assert.throws(
    () => link(graph, { confirmationMethod: "model" }),
    (error) => error.code === "INVALID_INPUT"
  );
  assert.throws(
    () =>
      link(graph, {
        evidence: [
          { type: "full-name", matched: true },
          { type: "date-of-birth", matched: false }
        ]
      }),
    (error) => error.code === "INVALID_INPUT"
  );
});

test("candidate and revoked links never resolve as confirmed", () => {
  for (const status of ["candidate", "revoked", "needs-reverification"]) {
    const graph = new PatientIdentityGraph();
    graph.recordLink({
      clinicId: "synthetic-clinic-1",
      canonicalPatientId: "synthetic-canonical-1",
      system: "elation",
      systemTenantId: "synthetic-elation-tenant-1",
      systemPatientId: "synthetic-elation-1",
      status
    });
    assert.equal(
      graph.resolve(
        "synthetic-clinic-1",
        "elation",
        "synthetic-elation-tenant-1",
        "synthetic-elation-1"
      ),
      null
    );
  }
});

test("rejects conflicting confirmed links in either direction", () => {
  const graph = new PatientIdentityGraph();
  link(graph);

  assert.throws(
    () => link(graph, { canonicalPatientId: "synthetic-canonical-2" }),
    (error) => error.code === "LINK_CONFLICT"
  );
  assert.throws(
    () => link(graph, { systemPatientId: "synthetic-elation-2" }),
    (error) => error.code === "LINK_CONFLICT"
  );
});
