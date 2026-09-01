import {
  createFollowUpScenario,
  FIXED_NOW,
  FIXTURE_CLINIC_ID,
  FIXTURE_RUN_ID
} from "../fixtures/follow-up-scenario.js";
import { runPatientLens } from "../src/patient-lens.js";
import { recordSuggestionFeedback } from "../src/suggestions.js";

const scenario = createFollowUpScenario();
const result = await runPatientLens({
  runId: FIXTURE_RUN_ID,
  clinicId: FIXTURE_CLINIC_ID,
  identityGraph: scenario.graph,
  activeSystem: "elation",
  adapters: scenario.adapters,
  approvedAdapterVersions: scenario.approvedAdapterVersions,
  approvedLocatorVersions: scenario.approvedLocatorVersions,
  factPolicies: scenario.factPolicies,
  requiredFactKeys: scenario.requiredFactKeys,
  clock: () => FIXED_NOW
});
const feedback = recordSuggestionFeedback({
  suggestionId: result.suggestions[0].id,
  outcome: "accept",
  at: FIXED_NOW.toISOString()
});

console.log(
  JSON.stringify(
    {
      status: "synthetic-read-only-demo",
      acceptedObservations: result.safeEvents.filter(
        (event) => event.event === "observation_accepted"
      ).length,
      subject: result.subject,
      facts: result.facts,
      missingSystems: result.missingSystems,
      missingFactKeys: result.missingFactKeys,
      feedbackOptions: result.feedbackOptions,
      suggestions: result.suggestions,
      syntheticFeedback: feedback
    },
    null,
    2
  )
);
