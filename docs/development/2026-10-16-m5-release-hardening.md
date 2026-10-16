# Milestone5 — Release Integration, Scientific QA & Production Hardening

Dates:2026-10-15–16 America/New_York. No new experiment, public deployment, billing or real-provider evaluation. Source directory's uncommitted lorentz.py whitespace edit was preserved; development uses an isolated Git worktree.

## Phase0 integration evidence

All PRs inspected immediately before merge: actual unchanged head, main target, all current checks successful, mergeable/no conflict, no changes-requested reviews/unresolved threads/comments, intended scoped diff and configured-key/signature scan. Each predecessor normal merge left its content tree identical to the previously tested feature head; verified by git diff --exit-code before next retarget, so checks applied to the same tested content, not an assumed newer head. No force push/rewrite/remote deletion.

- PR6 head3e61e2b54859977cc0ae54c0f40236c580446ade → merge b1e8adcb09f8e2397820807c5c0cf14a3a4c0469.
- PR7 head09f7f442849bd673310a7341b3042981fce4e4fd → merge93cb030f34cb745ea7424e626b9cfaad8d61e8b1.
- PR8 head7663dc5eebeee78f66cad7c7dfe42d877e9ce914 → merge813bd1dbc89f08fba9471d1bcb79ca8ddcb0a1b6.
- PR9 heade83c3c84b6990bba0de12afe9da10669ffd865fd → mergeee31ae64c6cb5aeae10dda2f068ccfff69b6d49a.

Final main ee31ae64c6cb5aeae10dda2f068ccfff69b6d49a, full baseline198Vitest/371Pytest+3localRedis skips/41Chromium, strictTypeScript and build passed. Created feat/release-hardening-scientific-qa from this main.

## Features and files

Six machine-readable scientific manifests shared/scientific, fixed-seed independent scripts/validate_science.py and report docs/release/scientific-validation.json; no tolerance loosening. Uniform fields, Lorentz phase bound, half-open region corners/grazing/charged diagonal refinement, optical symmetry/probability/validity, high-eKepler independent known anomaly/invariants, randomized collision COM/restitution/energy references augment existing edge tests.

336synthetic labeled bilingual prompts across8categories, scripts/build_ai_evaluation.py and evaluate_ai.py,252explicit invalid mutations rejected. Candidate precision56.25%/recall100%/false-rejection0%;126of132out-of-scope cases defer, NOT a final-model acceptance rate.48mockASGI schema/language/credential cases all enforce contracts; no realGemini accuracy claim. Optional --live opt-in daily file-locked≤3request and≤$0.10estimated cap, larger evaluation refuses and requires separate approval/review.

API observability/readiness/preflight modules, central AI_ENABLED switch including retry/admission race, shared daily budget metrics, bounded aggregate latency/counters, protected private metrics, strict/throttled client reports and recoverable frontend boundary. No raw paths/prompts/identifiers/error text in application telemetry. Production template uses secret files, HTTPS origins, no trusted client forwarding, AOF/noevictionRedis and rollback runbook. Redis7.4.6 was initially used locally; official security notes required upgrade to7.4.11, now deployment/CI/native test version. Source SHA256 checked against official redis-hashes.

UX: localized objective visible below title; recovery button instead of blank render failure. Thirty ordered experiment-switch isolation tests and one full UI isolation journey. All six reuse existing science/AI contracts; no domain hardcoding in shared AI logic.

## Validation and discovered issues

230Vitest passed, strictTypeScript/build passed.433Pytest including realRedis passed before final switch-race regression; final full counts/CI captured in PR and external Chinese acceptance report after verification. Scientific fixed-domain properties passed at declared bounds; no model computation changed to hide errors. Locked npm and Python audits found0known vulnerabilities at run time; container OS/image audit not claimed.

Cross-browser first run exposed4unsupported CDP invocations and2fractional pointer oracle differences. Fixed tests to use dynamicChromium DPR versus static equal-size Firefox/WebKit contexts, and actual observed pointer delta with unchanged1e-5precision. Focused18/18passed across engines; completeChromium42/42passed. Some complete local runs encountered multi-minute scheduling stalls and20sconfigured timeouts: results122/126,Firefox40/42,WebKit41/42remain failures, not passes; no retries/timeout increases mask them. Exact final CI and any fresh local confirmations must be reported separately. Native Safari is not tested; WebKit is.

Real production-mode ASGI+Redis smoke verified readiness, Secure/HttpOnly cookie, authenticated metrics, AI-off503 and unchanged deterministic availability, upstreammocked/0externalcalls. Production frontend assets manually reviewed on loopback. Docker daemon unavailable: image builds/Compose startup/OS image scanning not verified. No infrastructure provisioned.

## Release limits and next priorities

Do not declare unrestricted public readiness from mocks/native smoke. Require exact-head CI, human PR review, image build/security scan/digest pin, actual ingress/TLS/secrets/Redis durability+ACL+backup/alerts, kill-switch drill across replicas and small approved live multilingual/model smoke. Metrics are per-process except shared budget reads; external collector required. Anonymous session is not authenticated account. UI technical legends remain partlyEnglish. New hardening PR must not merge automatically. Final commit SHA/PR/CI URLs recorded in acceptance report after GitHub confirms.

Final native backend run:435Pytest passed with realRedis7.4.11, no skips. Added HTTP-disconnect cancellation of the actual ASGI route, upstream task and lease cleanup, plus pre-dispatch kill-race cost refund.230Vitest/type/build remain passed. Native long cross-browser timeout failures retained; exact-head CI is still the delivery gate and is reported after GitHub confirms it.
