# DPCSage Intelligence-Layer Direction

Status: product and architecture decision record
Captured: 2026-09-01

## Decision

DPCSage should be a clinic intelligence layer, not merely a cross-system utility.
It should understand the clinician's current patient and workflow across Hint,
Elation, and Spruce; retrieve information from those systems just in time; notice
patterns and unfinished work; and suggest the next useful action. Deterministic
system adapters provide reliable access, while the intelligence layer interprets
the combined context and assists the clinician.

The product should not attempt to crawl and permanently store every record or
learn an entire authenticated application from a single demonstration.

## New Tabflows observations

The following are direct product-owner observations and should be treated as
high-confidence field evidence, although they have not yet been reproduced in a
controlled test:

- Tabflows opens a background Chrome helper tab when it needs to look something
  up or perform work.
- Its integrations do not use official vendor APIs.
- Its patient cross-linking creates a durable identity across systems and retains
  the points at which that patient can be found in each system.
- Tabflows has recently added a Gemini-based AI layer over this connected context.

Public documentation and inspection of the publicly distributed extension are
consistent with a shared Chrome MV3 runtime plus explicit per-system adapters.
The integrations have different capabilities, and the extension combines browser
session access, DOM/application state, navigation, and system-specific behavior.
Nothing found supports the idea that Tabflows autonomously learns a complete site
map from one demonstration.

The helper tab is an architectural clue worth testing. It may provide a stable
first-party execution context for navigation, session-bound requests, background
lookups, or workflows that cannot run reliably inside the user's active tab. Its
exact purpose remains an inference until observed with synthetic accounts.

## Product thesis

Tabflows validates the utility layer:

1. Identify the current patient.
2. Link that identity across systems.
3. Navigate to, read from, or act in each system.

DPCSage's opportunity is the layer above that utility:

1. Build a live, patient-specific view of relevant context without copying the
   entire chart.
2. Understand what the clinician is doing and where they are in the workflow.
3. Detect missing information, care gaps, follow-up needs, and repeated work.
4. Suggest the next useful step with evidence and provenance.
5. Let the clinician approve consequential actions and verify the result.
6. Learn recurring workflow patterns without allowing an AI model to invent
   selectors, patient identity, or clinical facts.

The defensible asset is not a DOM scraper. It is the combination of a verified
cross-system identity graph, reliable adapters, a clinical context model, and a
feedback loop that learns which suggestions are useful.

## Lean architecture

```text
Chrome extension
  |-- patient identity guard
  |-- active-tab context observer
  |-- optional background helper tab
  |-- Hint adapter
  |-- Elation adapter
  `-- Spruce adapter
             |
             v
Clinic context service
  |-- confirmed cross-system patient links
  |-- normalized facts with source and observed-at time
  |-- workflow events and pending-work state
  `-- adapter versions and action audit
             |
             v
Intelligence layer
  |-- deterministic rules and care-gap logic
  |-- model-assisted synthesis and prioritization
  |-- suggestions with supporting evidence
  `-- approval gate and result verification
```

Each adapter should expose a small common contract:

- `detectPatient()`
- `searchPatient()`
- `openPatient()`
- `readFields()`
- `observeWorkflow()`
- `performApprovedAction()`
- `verifyResult()`

Implementation priority within an adapter:

1. Stable current-page DOM and accessible names.
2. Stable in-page application state.
3. Session-bound navigation or requests when explicitly authorized.
4. Visual or model-based interpretation only as a non-authoritative fallback.

## Information strategy

Do not warehouse complete records from all three systems. Persist only what is
needed to reconnect context and support safe suggestions:

- Confirmed Hint, Elation, and Spruce patient identifiers.
- Link status, who confirmed it, and when it was last verified.
- Source, timestamp, and freshness for any temporarily normalized fact.
- Workflow state, accepted/dismissed suggestions, and action outcome.
- Adapter and locator version used for each observation or action.

Retrieve clinical values on demand and discard them when the task no longer needs
them unless there is a defined clinical, operational, and compliance reason to
retain them.

The identity graph is itself PHI. Even a maps-not-charts architecture therefore
requires BAA-grade controls, least privilege, auditability, and a deliberate
retention policy. Raw DOM, screenshots, typed values, and URLs containing patient
identifiers must not enter ordinary logs or model telemetry.

## Learning and self-correction

"Watch how you work" should mean observing a narrow stream of semantic events,
not recording every pixel, keystroke, or DOM mutation. Examples include opening a
patient, reviewing a result, creating a task, switching systems, and accepting or
dismissing a suggestion.

See-one-do-one can later help author workflow recipes, but it is not required to
map the three systems. A learned recipe must compile to deterministic adapter
operations, use synthetic test fixtures, and require review before publication.

Production self-correction must be constrained:

1. Detect a locator or workflow failure.
2. Stop and surface the failure; never guess the patient or clinical value.
3. Generate candidate repairs outside the live clinical workflow.
4. Test candidates against synthetic fixtures and known invariants.
5. Require approval, version the adapter, and retain rollback information.

The model may explain, prioritize, and suggest. Deterministic code must establish
patient identity, retrieve source facts, enforce permissions, and verify actions.

## Use and do not use

Use:

- Tabflows as competitive and architectural validation.
- Three hand-authored adapters with a small shared runtime.
- A human-confirmed patient identity graph.
- An optional helper tab if testing proves it materially improves reliability.
- Playwright for synthetic end-to-end tests, not as the extension runtime.
- Human feedback on suggestions as the primary learning signal.

Do not use:

- Tabflows code or extension assets; no reusable public source license was found.
- A generic whole-site crawler or permanent DOM warehouse.
- Runtime DevTools Recorder, Puppeteer Replay, rrweb, Cordyceps, Stagehand, or
  Browser Use as the clinical execution engine.
- Automatic LLM selector repair or autonomous clinical actions.
- Broad access to unrelated browser origins.
- Full-record replication merely because the browser can access it.

## Immediate proof

Build one read-only vertical slice before a general framework:

1. Detect and verify a synthetic patient's identity in the active system.
2. Resolve the confirmed identity in the other two systems.
3. Use a background helper tab to retrieve one high-value fact from each system.
4. Attach source and freshness to every fact.
5. Produce one useful, evidence-backed suggestion.
6. Require clinician confirmation and record whether it was useful.
7. Fail visibly on any identity mismatch, stale locator, or ambiguous result.

This experiment tests the real differentiator: whether cross-system context can
produce meaningfully better clinical assistance, not whether DPCSage can scrape a
large quantity of data.

## Open decisions

- The first narrow workflow where cross-system context produces enough value to
  justify DPCSage beside Tabflows.
- Written permission and BAA posture for session-based access to each system.
- Whether the helper-tab pattern is technically necessary or merely convenient.
- Which facts may be retained, for how long, and for what clinical purpose.
- Which model provider and deployment boundary meet the clinic's PHI requirements.
- The exact line between suggestions, drafted actions, and autonomous actions.

## Research references

- Tabflows: https://www.tabflows.com/
- Chrome extension: https://chromewebstore.google.com/detail/tabflows-stop-searching-f/okbchambnniingjehlfakhllciailejd
- Existing-system behavior: https://help.tabflows.com/en/articles/16101814-how-tabflows-works-with-your-existing-systems
- Patient linking: https://help.tabflows.com/en/articles/15706893-how-do-i-link-a-patient-across-your-systems
- Data handling: https://help.tabflows.com/en/articles/16182205-how-tabflows-handles-patient-data
- Desktop/browser boundary: https://help.tabflows.com/en/articles/16603636-what-works-on-mobile-and-what-requires-desktop-chrome
- Privacy: https://www.tabflows.com/privacy
- BAA: https://www.tabflows.com/baa
- Terms: https://www.tabflows.com/terms
