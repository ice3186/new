# DPCSage Product Requirements

Status: initial product baseline
Date: 2026-09-01
Owner: DPCSage
Scope: clinic intelligence across Hint, Elation, and Spruce

## 1. Product thesis

DPCSage is an intelligence layer that understands the clinician's current patient
and workflow across Hint, Elation, and Spruce. It retrieves only the relevant
facts, identifies unfinished or easily missed work, and offers a small number of
timely, evidence-backed suggestions.

Cross-system access is necessary plumbing, not the product. DPCSage's value is
turning verified facts from otherwise disconnected systems into useful clinical
and operational context at the moment of work.

The system has two intentionally separate responsibilities:

1. **Deterministic access** establishes patient identity, retrieves source facts,
   observes known workflow events, performs approved operations, and verifies
   results through versioned Hint, Elation, and Spruce adapters.
2. **Model-assisted intelligence** summarizes verified context, ranks possible
   next steps, explains its reasoning, and learns from user feedback. A model
   never establishes identity, supplies a missing clinical fact, silently repairs
   an adapter, or takes a consequential action without the required approval.

The initial product promise is:

> When a clinic user opens a patient, DPCSage shows the important work they might
> otherwise miss across Hint, Elation, and Spruce, with clear evidence and a safe
> next step.

## 2. Evidence and positioning

Tabflows provides strong market and architectural validation for browser-based
cross-system patient linking. Product-owner observation indicates that it uses a
background Chrome helper tab, session-based browser access rather than official
APIs, durable patient cross-links, and an AI layer. Public material and extension
inspection are consistent with explicit per-system integrations, not a generic
site learner.

DPCSage should adopt the useful patterns—patient linking, per-system adapters,
just-in-time browser access, and visible action status—without copying Tabflows
code or duplicating its broad utility surface. No reusable public license has
been identified. DPCSage differentiates by understanding combined context,
workflow state, and which intervention is valuable now.

## 3. Users and jobs to be done

### Primary user: DPC clinician

When preparing for, conducting, or closing a patient encounter, the clinician
wants to know what matters across all three systems without searching each one,
so important follow-up is not missed and attention stays on the patient.

### Secondary user: clinic operations staff

When processing messages, membership issues, scheduling, and follow-up work,
staff want to see the same verified patient context and the next unresolved task,
so work is completed once and handed off correctly.

### Safety and compliance stakeholder: clinic owner or administrator

The clinic owner needs assurance that DPCSage accesses only authorized systems,
minimizes retained PHI, exposes provenance, records consequential activity, and
fails closed when identity or facts are uncertain.

## 4. Product principles

- **Identity before intelligence.** No cross-system reasoning occurs until the
  active patient and all referenced records meet the required identity checks.
- **Evidence before suggestion.** Every patient-specific suggestion identifies
  the source facts and when they were observed.
- **Context, not a second chart.** Retrieve on demand and retain the minimum data
  needed to reconnect, explain, measure, and audit.
- **Suggest before acting.** Read-only assistance comes before drafted actions;
  drafted actions come before approved execution. Autonomous clinical actions are
  not on the current roadmap.
- **Fail visibly.** Ambiguity, stale selectors, signed-out sessions, and partial
  retrieval are user-visible states, never guessed-through conditions.
- **Learn semantically.** Learn from events such as patient opened, message
  reviewed, task completed, and suggestion dismissed—not indiscriminate screen,
  keystroke, or DOM recording.
- **Prove value narrowly.** One excellent patient-lens workflow precedes a general
  automation platform.

## 5. Core workflows

### 5.1 Patient Lens

1. DPCSage detects that a supported system has an active patient.
2. It extracts identity evidence using the system's versioned adapter.
3. It resolves confirmed links for that patient in the other systems. If no link
   exists, it presents possible matches and requires a human confirmation.
4. It retrieves a defined, small set of relevant facts from each available
   system, using a helper tab only when necessary.
5. It normalizes the facts with source, observed time, and freshness.
6. Rules identify candidate issues; the model may summarize and rank them.
7. The user sees at most three suggestions, their evidence, and the safe next
   step. Missing or unavailable sources are stated explicitly.
8. The user accepts, dismisses, or defers a suggestion. DPCSage records that
   response without retaining unnecessary chart content.

### 5.2 Confirm a patient link

1. An adapter finds candidate records in another system.
2. DPCSage compares approved identity attributes such as full name and date of
   birth. System IDs alone locate records but do not prove equivalence.
3. The user sees the compared values and confirms or rejects the link.
4. DPCSage stores system, tenant, opaque record identifier, confirmation actor,
   time, verification status, and adapter version.
5. Any later identity contradiction invalidates the link for current use and
   requires review.

### 5.3 Approved action (later stage)

1. DPCSage proposes a specific action and shows its target and source evidence.
2. The user reviews the exact payload and explicitly approves it.
3. The adapter rechecks patient identity immediately before execution.
4. The adapter performs one idempotent operation and reads the destination again
   to verify the result.
5. DPCSage reports completed, failed, uncertain, or authentication-required and
   retains an audit record.

### 5.4 Adapter failure and repair

1. A failed invariant stops the read or action and produces a sanitized failure
   report containing system, adapter version, operation, and failure category.
2. Candidate locator repairs are developed outside the live clinical workflow.
3. Repairs run against synthetic or appropriately de-identified fixtures and all
   adapter contract tests.
4. A reviewed, versioned release is required before production use. Production
   models cannot silently change selectors or workflow recipes.

## 6. Functional requirements

### Deterministic context and identity

- **FR-01:** Represent a local canonical patient with zero or one confirmed link
  per supported system and tenant.
- **FR-02:** Represent link states: unlinked, candidate, confirmed, conflicted,
  inaccessible, and needs-reverification.
- **FR-03:** Require explicit identity evidence and human confirmation for a new
  cross-system link; never match using model inference alone.
- **FR-04:** Prevent facts from different patients or tenants from entering the
  same context envelope.
- **FR-05:** Attach source system, source record reference, observed time,
  freshness state, and adapter version to every fact.
- **FR-06:** Distinguish unavailable, absent, stale, ambiguous, and successfully
  observed values. These states must not collapse to `null` or “none found.”

### Adapters and browser behavior

- **FR-07:** Implement a small common adapter contract: `detectPatient`,
  `searchPatient`, `openPatient`, `readFacts`, `observeWorkflow`,
  `performApprovedAction`, and `verifyResult`. An integration may explicitly
  declare unsupported capabilities.
- **FR-08:** Prefer stable accessible names and labeled DOM elements, then stable
  application state, then explicitly authorized same-session navigation or
  requests. Model or visual interpretation is non-authoritative fallback only.
- **FR-09:** Restrict browser permissions to approved Hint, Elation, and Spruce
  origins; do not request access to unrelated browsing.
- **FR-10:** A helper tab must be non-disruptive, attributable to a visible user
  request or active-context refresh, bounded in duration, and closed or reused
  predictably. It must never change data during a read operation.
- **FR-11:** Each adapter operation must validate preconditions and postconditions
  and return a typed success or failure state.

### Context and intelligence

- **FR-12:** Build a patient context envelope from an allowlisted set of facts;
  do not pass raw pages, whole charts, or unrestricted DOM to the model.
- **FR-13:** Run deterministic rules before model synthesis and retain the rule
  result separately from model wording or ranking.
- **FR-14:** Show no more than three ranked suggestions in the primary view.
- **FR-15:** Every suggestion must include why it appeared, supporting sources,
  freshness, uncertainty or missing sources, and a dismiss/feedback control.
- **FR-16:** A suggestion based on stale, conflicted, or unavailable required
  evidence must be suppressed or clearly downgraded according to its rule.
- **FR-17:** Model output must conform to a defined schema and may reference only
  facts supplied in the context envelope. Invalid output produces no suggestion.
- **FR-18:** Capture accepted, dismissed, deferred, and incorrect feedback as the
  learning signal. Feedback may tune ranking but cannot weaken identity or safety
  rules.

### Actions and audit

- **FR-19:** Stage 1 and Stage 2 are read-only. All later write operations require
  an explicit capability declaration and review.
- **FR-20:** Consequential actions require exact payload preview, explicit user
  approval, immediate identity recheck, and result verification.
- **FR-21:** Record access and action audit events without raw clinical text,
  patient names, DOM, screenshots, tokens, or patient-bearing URLs in ordinary
  logs.

## 7. Non-functional requirements

- **NFR-01 Reliability:** No known cross-patient context mixing is acceptable.
  Any identity ambiguity fails closed.
- **NFR-02 Explainability:** A reviewer can trace every displayed fact to its
  source system and observation time and every suggestion to its supporting facts.
- **NFR-03 Performance:** Cached link resolution is under 100 ms locally; after
  fixtures load, Stage 1 produces a context and deterministic suggestion in under
  one second on a development laptop. Live cross-system target latency will be set
  after adapter measurement.
- **NFR-04 Resilience:** Failure in one system does not fabricate completeness or
  block facts from available systems; the partial state is explicit.
- **NFR-05 Testability:** Adapter behavior, identity invariants, normalization,
  rules, and model boundaries can be tested with deterministic fixtures.
- **NFR-06 Maintainability:** A system-specific selector or workflow change is
  isolated to its adapter and fixtures.
- **NFR-07 Accessibility:** The primary experience is keyboard operable and does
  not communicate priority or failure by color alone.

## 8. Safety, privacy, and security

The cross-system identity graph is PHI even when DPCSage stores no chart. Before
real-patient use, the product requires an approved HIPAA/BAA posture for every
service that handles PHI, including model and observability providers.

Required controls:

- Least-privilege access scoped by clinic tenant, user, system, and capability.
- Encryption in transit and at rest, managed secrets, session timeout, access
  revocation, and tenant isolation.
- Defined retention and deletion for patient links, fact caches, feedback, and
  audits. Clinical facts default to ephemeral unless a reviewed use requires
  retention.
- No PHI in source control, synthetic fixtures only, and automated checks that
  fixtures and logs contain no obvious identifiers or credentials.
- No raw DOM, screenshots, keystrokes, typed values, authentication tokens, or
  patient-bearing URLs in model requests or ordinary telemetry.
- Prompt-injection resistance: text retrieved from a vendor system is untrusted
  data, never an instruction and never a source of tool permissions.
- User-visible recording/observation controls and a clear explanation of what is
  observed, retained, and sent to a model.
- Auditability for identity decisions, PHI access, suggestions, approvals, and
  actions, with no sensitive payload duplicated into general application logs.
- Documented incident response, rollback, and adapter disable mechanisms before
  production use.

Clinical guardrails:

- Suggestions are decision support, not diagnosis or a substitute for clinician
  judgment.
- High-risk clinical claims require deterministic eligibility logic and source
  evidence; model prose cannot create a care gap.
- Medication, order, diagnosis, and patient-message writes remain human-approved
  unless a future safety review explicitly changes policy.
- A user must always be able to open the cited source and dismiss a suggestion.

## 9. Explicit non-goals

- Crawling or storing an entire authenticated website or complete patient charts.
- Learning a reliable integration from one human demonstration.
- Recording every click, keystroke, screenshot, or DOM mutation.
- Generic support for arbitrary websites or a no-code automation marketplace.
- Automatic selector repair in a live clinic session.
- Autonomous diagnosis, treatment, ordering, prescribing, or patient outreach.
- Replacing Hint, Elation, Spruce, or the legal medical record.
- Building broad analytics, billing, scheduling, or population-health products
  before Patient Lens proves its value.
- Depending on Tabflows code, private implementation details, or a single model
  vendor.

## 10. Success measures

### North-star measure

**Useful cross-system catches per 100 eligible patient contexts:** a suggestion
supported by two or more systems that the user accepts or marks useful and reports
they would otherwise have needed to search for or might have missed.

### Product measures

- At least 30 useful cross-system catches per 100 eligible contexts in the pilot.
- At least 60% of displayed suggestions are accepted or marked useful.
- Fewer than 15% are marked incorrect or irrelevant.
- Median manual navigation avoided is at least two system switches per useful
  context, measured against a short baseline observation.
- At least 50% of pilot users use Patient Lens on three or more clinic days per
  week by week four.

These are pilot hypotheses, not promised benchmarks; reset them after baseline
measurement.

### Safety and reliability measures

- Zero cross-patient or cross-tenant context incidents.
- 100% of facts displayed with source and observed time.
- 100% of suggestions pass schema and evidence-reference validation.
- At least 95% successful reads on supported, authenticated test workflows per
  adapter version; no silent failures.
- 100% of writes, when introduced, have approval and post-action verification.
- PHI or secrets in ordinary telemetry: zero.

### Stage 1 engineering measures

- All identity, normalization, failure-state, and suggestion tests pass against
  synthetic fixtures.
- Mutation of any system identifier or required identity attribute causes a
  visible identity failure and no suggestion.
- Removing one system produces an explicit partial context, not a crash or an
  unsupported claim.
- The same fixture and rules produce byte-for-byte equivalent structured results
  across repeated runs, excluding timestamps.

## 11. Development stages and exit criteria

### Stage 1 — Synthetic Patient Lens kernel

**Implementation status (2026-09-01):** Built under `extension/` with synthetic
fixtures, a terminal demonstration, and automated safety tests. It remains
strictly offline and is not approved for live vendor access.

**Question:** Can verified cross-system facts produce a useful, explainable
suggestion without relying on live vendor access or a model?

Build now:

- Synthetic Hint, Elation, and Spruce fixtures for one patient and a small set of
  failure variants. Fixtures contain invented data only.
- Minimal canonical identity-link and provenance-bearing fact types.
- Fixture adapters implementing only `detectPatient` and `readFacts`; unsupported
  methods are explicit.
- A context assembler that fails closed on tenant or patient conflicts and
  represents absent, unavailable, stale, and observed distinctly.
- One deterministic cross-system rule. Recommended first scenario: an unresolved
  Spruce follow-up after an Elation encounter, with Hint eligibility/membership
  context used only where relevant to the action.
- A terminal or existing-app output showing one suggestion, evidence, freshness,
  missing sources, and accept/dismiss feedback. No model call and no network call.
- Automated tests for the happy path, identity mismatch, missing system, stale
  fact, ambiguous value, and duplicate input.

Exit criteria:

- All Stage 1 engineering measures in Section 10 pass.
- A clinician can review the synthetic scenario and correctly explain why the
  suggestion appeared and where each fact came from.
- The rule does not fire when a required fact is stale, unavailable, or assigned
  to a different patient.
- No credentials, PHI, browser permissions, background tab, database, hosted
  service, or model dependency is required.
- The team agrees that the normalized context contract is sufficient to start
  one real read-only adapter without generalizing it for hypothetical systems.

### Stage 2 — One live read-only adapter

**Question:** Can DPCSage reliably recognize patient context and retrieve an
allowlisted fact from one authorized system during real clinic work?

Build one adapter—select the system with available permission and the narrowest
valuable workflow. Add explicit origin permissions, signed-in and signed-out
states, sanitized diagnostics, versioned locators, and Playwright fixtures. Do
not add a helper tab unless an active-tab implementation fails a measured need.

Exit criteria:

- Written authorization and required compliance agreements are in place for the
  test environment and access method.
- The adapter passes its contract and fixture regression suite and at least 50
  consecutive supported test reads with at least 98% success.
- Identity mismatch, authentication loss, unexpected page state, and selector
  failure all fail visibly without returning a fact.
- A privacy review confirms no prohibited data reaches logs or model services.

### Stage 3 — Cross-system Patient Lens pilot

**Question:** Does combined Hint, Elation, and Spruce context save time and catch
meaningful work?

Implement the two remaining read-only adapters, human-confirmed patient linking,
on-demand retrieval, feedback capture, and the Patient Lens extension UI. Test a
bounded helper-tab pattern if necessary. Begin with deterministic suggestions;
add model summarization only after the structured result is correct without it.

Exit criteria:

- Each adapter meets Stage 2 reliability and failure requirements.
- Zero unresolved identity conflicts enter a context envelope during pilot tests.
- At least 100 eligible synthetic or approved pilot contexts are reviewed.
- At least 50% of suggestions are accepted or marked useful, fewer than 20% are
  incorrect, and interviews identify at least one repeatedly valuable workflow.
- A go/no-go review selects one workflow for deeper productization.

### Stage 4 — Evidence-bound intelligence

**Question:** Can a model improve prioritization and communication without
reducing factual reliability or trust?

Add a provider-neutral model boundary, allowlisted context schema, structured
output validation, citation checking, prompt-injection tests, and side-by-side
evaluation against deterministic ranking. The model receives only the minimum
facts needed for the task under an approved BAA posture.

Exit criteria:

- Every generated claim maps to supplied evidence or is rejected.
- Blinded clinician review shows a meaningful ranking or comprehension improvement
  over the deterministic baseline with no increase in incorrect suggestions.
- The system remains functional in deterministic-only mode during model outage.
- Privacy, security, clinical-safety, and model-risk reviews approve the pilot.

### Stage 5 — Approved closed-loop actions

**Question:** Can DPCSage complete one low-risk workflow safely and verify it?

Implement one reversible or low-risk write workflow with payload preview,
approval, identity recheck, idempotency, result verification, audit, and a kill
switch. Do not generalize an action framework before this workflow succeeds.

Exit criteria:

- Written authorization covers the write path.
- 100% of test actions have a matching approval and verification record.
- At least 100 supervised executions complete with no wrong-patient action and no
  unreported uncertain outcome.
- The clinic can disable the action without disabling read-only Patient Lens.

### Stage 6 — Clinic workflow learning

**Question:** Can DPCSage learn which suggestions matter and propose reusable
workflow recipes without becoming an opaque recorder?

Learn ranking from accept/dismiss/defer outcomes and known semantic events. A
developer-only demonstration tool may propose a deterministic workflow recipe,
but publication requires synthetic replay, invariant checks, human review,
versioning, and rollback.

Exit criteria:

- Learned ranking improves the pilot usefulness measure without degrading any
  safety measure or systematically suppressing important classes of suggestion.
- Every proposed workflow compiles to reviewed adapter operations and passes the
  same tests as hand-authored workflows.
- Observation and retention controls are transparent to users and approved by
  privacy and clinical-safety review.

## 12. Risks and mitigations

| Risk | Consequence | Mitigation |
|---|---|---|
| Vendor UI or private-session behavior changes | Reads silently become wrong or unavailable | Versioned adapters, invariants, fixture regression, kill switch, visible failure; seek official authorization |
| Wrong patient link | Cross-patient disclosure or unsafe suggestion | Human confirmation, tenant scoping, identity recheck, contradiction invalidation, fail closed |
| Browser observation feels invasive | Loss of clinician trust and adoption | Semantic events only, least privilege, visible controls, no blanket browsing access |
| Model hallucinates or follows page-borne instructions | Incorrect or unsafe guidance | Allowlisted facts, untrusted-content boundary, structured output, evidence validation, deterministic fallback |
| Too much information creates alert fatigue | Suggestions are ignored | Maximum three suggestions, narrow rules, feedback, usefulness threshold |
| PHI accumulates in caches and telemetry | Compliance and breach exposure | Ephemeral facts by default, redaction, retention limits, BAA review, audits |
| Trying to support every workflow delays learning | No usable product | One Patient Lens scenario and one adapter at a time; explicit stage gates |
| Tabflows already expands into intelligence | Reduced differentiation | Focus on timing, verified evidence, clinic-specific workflow state, safety, and measurable clinical usefulness |
| Existing API-based prototype anchors architecture | Inappropriate coupling to Elation or batch care gaps | Reuse concepts only when they fit the context contract; keep Stage 1 independent of network clients |

## 13. Open questions and decision gates

Resolve before Stage 2:

- Which system can the clinic authorize first for a controlled read-only test?
- What exact real workflow corresponds to the Stage 1 synthetic follow-up rule?
- Which identity attributes are consistently visible and authorized in each
  system, and what combination is sufficient for confirmation?
- Does active-tab access satisfy the chosen workflow, or is a helper tab required
  for reliable lookup?
- What vendor terms, written permission, BAAs, and security review apply to
  browser-session access in each system?

Resolve before Stage 3:

- Where should the PHI-bearing identity graph live: clinic-local, managed cloud,
  or another approved boundary?
- Which facts may be cached, for what purpose, and for how long?
- What is the pilot baseline for system switching, missed follow-up, and time spent
  gathering context?
- Which roles may confirm or invalidate patient links?

Resolve before Stage 4 or later:

- Which model deployment and provider satisfy BAA, retention, and observability
  requirements?
- Which suggestion classes require deterministic rules versus model ranking?
- What qualifies as a consequential action, and which roles may approve each one?
- What evidence would justify any future autonomous action? The default answer is
  that none is justified in the current roadmap.

## 14. Stage 1 acceptance scenario

Use a wholly fictional patient linked across the three fixtures:

- Elation records a completed encounter and an explicit follow-up expectation.
- Spruce has no matching completed follow-up message within the allowed window.
- Hint supplies an allowlisted membership fact needed to select the safe next
  step, or explicitly reports that the fact is unavailable.

Expected result:

> **Follow-up may still be needed.** Elation shows a completed encounter with a
> follow-up expectation; Spruce has no completed matching message as of the stated
> observation time. Hint membership context is shown separately. Review the cited
> records before drafting outreach.

The structured result must cite the Elation and Spruce facts, state Hint's
availability and freshness, and offer accept/dismiss feedback. It must produce no
suggestion when the records fail identity checks or when any fact required by the
rule is stale or ambiguous.

This scenario proves the first architectural seam: deterministic adapters produce
verified context, deterministic logic identifies a candidate issue, and the
presentation remains ready for later model-assisted prioritization without making
the model responsible for truth.
