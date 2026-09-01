# DPCSage browser core

This directory contains the first, deliberately narrow DPCSage implementation:
a synthetic, read-only patient-context kernel that can later run inside the
Chrome extension.

It proves four safety-critical behaviors before DPCSage touches a live clinic
system:

1. Cross-system patient identifiers must be human-confirmed and unique.
2. Every observation must match the active canonical patient.
3. Every fact carries source, adapter version, observation time, and freshness.
4. Suggestions use only fresh, verified facts and always require approval.

There are no runtime dependencies, network calls, DOM selectors, model calls,
browser permissions, or persisted PHI in this stage.

The current fixtures are entirely synthetic. Once live adapters exist, Patient
Lens results and identity links will be PHI-bearing application data and must
never be copied into ordinary logs or telemetry.

Run the synthetic demonstration and tests:

```bash
cd extension
npm run demo
npm test
```

Live Hint, Elation, and Spruce adapters are intentionally deferred until their
DOM and session behavior can be captured with synthetic test patients and the
required access has been authorized.
