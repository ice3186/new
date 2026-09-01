function evidence(fact) {
  return Object.freeze({
    fact: fact.key,
    state: fact.state,
    sourceSystem: fact.sourceSystem,
    sourceRef: fact.sourceRef,
    sourceEventAt: fact.sourceEventAt,
    adapterVersion: fact.adapterVersion,
    locatorVersion: fact.locatorVersion,
    observedAt: fact.observedAt,
    expiresAt: fact.expiresAt,
    freshness: "fresh"
  });
}

export function suggestNextSteps(context) {
  const completedEncounter = context.getFreshFact("elation.encounter.status");
  const followUpExpected = context.getFreshFact(
    "elation.follow-up.expected"
  );
  const completedFollowUp = context.getFreshFact(
    "spruce.follow-up.completed-in-window"
  );
  const membershipStatus = context.getFreshFact("hint.membership.status");

  if (
    completedEncounter?.state !== "observed" ||
    completedEncounter.value !== "completed" ||
    followUpExpected?.state !== "observed" ||
    followUpExpected.value !== true ||
    completedFollowUp?.state !== "absent" ||
    membershipStatus?.state !== "observed" ||
    membershipStatus.value !== "active"
  ) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: "review-missing-follow-up",
      title: "Follow-up may still be needed",
      rationale:
        "Elation records a completed encounter that expects follow-up, Spruce has no completed matching follow-up in the reviewed window, and Hint shows an active membership.",
      evidence: Object.freeze([
        evidence(completedEncounter),
        evidence(followUpExpected),
        evidence(completedFollowUp),
        evidence(membershipStatus)
      ]),
      proposedAction: "review-follow-up-sources",
      approvalRequired: true
    })
  ]);
}

export function recordSuggestionFeedback({ suggestionId, outcome, at }) {
  if (
    suggestionId !== "review-missing-follow-up" ||
    !["accept", "dismiss"].includes(outcome) ||
    typeof at !== "string" ||
    !Number.isFinite(Date.parse(at))
  ) {
    throw new TypeError("Invalid suggestion feedback.");
  }

  return Object.freeze({
    event: "suggestion_feedback",
    suggestionId,
    outcome,
    at
  });
}
