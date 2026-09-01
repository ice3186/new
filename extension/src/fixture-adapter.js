import { SafetyError } from "./safety-error.js";

export function createFixtureAdapter({
  clinicId,
  system,
  systemTenantId,
  version,
  locatorVersion,
  activePatientIds = [],
  patients = {}
}) {
  let detectionIndex = 0;

  return Object.freeze({
    system,
    version,
    locatorVersion,
    capabilities: Object.freeze({
      detectPatient: true,
      readFacts: true,
      searchPatient: false,
      openPatient: false,
      observeWorkflow: false,
      performApprovedAction: false,
      verifyResult: false
    }),

    async detectPatient(request = {}) {
      if (request.clinicId !== clinicId) {
        throw new SafetyError("INVALID_PROVENANCE", system);
      }
      const patientId =
        activePatientIds[
          Math.min(detectionIndex, Math.max(activePatientIds.length - 1, 0))
        ];
      detectionIndex += 1;
      if (!patientId) {
        throw new SafetyError("AMBIGUOUS_IDENTITY", system);
      }
      return Object.freeze({
        clinicId,
        system,
        systemTenantId,
        systemPatientId: patientId
      });
    },

    async readFacts({
      clinicId: requestedClinicId,
      systemTenantId: requestedSystemTenantId,
      systemPatientId,
      now
    }) {
      if (
        requestedClinicId !== clinicId ||
        requestedSystemTenantId !== systemTenantId
      ) {
        throw new SafetyError("INVALID_PROVENANCE", system);
      }
      const fixture = patients[systemPatientId];
      if (!fixture) {
        throw new SafetyError("SOURCE_UNAVAILABLE", system);
      }

      return Object.freeze({
        clinicId,
        system,
        systemTenantId,
        systemPatientId: fixture.observedPatientId ?? systemPatientId,
        adapterVersion: version,
        locatorVersion,
        observedAt: fixture.observedAt ?? now.toISOString(),
        identityMatchCount: fixture.identityMatchCount ?? 1,
        identityVerified: fixture.identityVerified ?? true,
        complete: fixture.complete ?? true,
        facts: Object.freeze(
          fixture.facts.map((fact) => Object.freeze({ ...fact }))
        )
      });
    }
  });
}
