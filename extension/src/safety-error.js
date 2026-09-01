const SAFE_MESSAGES = Object.freeze({
  AMBIGUOUS_IDENTITY: "Patient identity could not be resolved uniquely.",
  INCOMPLETE_EVIDENCE: "The source returned incomplete evidence.",
  INVALID_INPUT: "The observation was malformed.",
  INVALID_PROVENANCE: "The observation did not include valid provenance.",
  LINK_CONFLICT: "The patient link conflicts with an existing confirmed link.",
  LINK_NOT_CONFIRMED: "No confirmed patient link exists for this system.",
  PATIENT_MISMATCH: "The system is showing a different patient.",
  PATIENT_CHANGED: "The active patient changed during the lookup.",
  SESSION_CLOSED: "The patient context session is closed.",
  SOURCE_UNAVAILABLE: "A required source could not be read safely.",
  UNSUPPORTED_ADAPTER: "The adapter version is not approved.",
  UNSUPPORTED_SYSTEM: "The source system is not supported.",
  UNEXPECTED_FAILURE: "The operation failed closed."
});

const SAFE_CODES = new Set(Object.keys(SAFE_MESSAGES));

export class SafetyError extends Error {
  constructor(code, system = null) {
    const safeCode = SAFE_CODES.has(code) ? code : "UNEXPECTED_FAILURE";
    const message = SAFE_MESSAGES[safeCode];
    super(message);
    this.name = "SafetyError";
    this.code = safeCode;
    this.system = ["hint", "elation", "spruce"].includes(system)
      ? system
      : null;
  }
}

export function safeTelemetry(error, at = new Date().toISOString()) {
  if (!(error instanceof SafetyError)) {
    return Object.freeze({
      event: "operation_rejected",
      code: "UNEXPECTED_FAILURE",
      at
    });
  }

  const event = {
    event: "operation_rejected",
    code: error.code,
    at
  };

  if (["hint", "elation", "spruce"].includes(error.system)) {
    event.system = error.system;
  }

  return Object.freeze(event);
}
