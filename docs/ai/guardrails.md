# AI guardrails and usage governance — 2026-10-15

## Audited call paths and trust boundary

All current Gemini-backed entry points were audited: v1 `/api/ai/{explain,plan-action,generate-lesson,evaluate-observation}`, v2 equivalents including regional features, legacy TutorService/action/learning services and OpenAICompatibleProvider. All real completions now enter `governance.gateway.completion` through adapter `_complete`; raw `_request` requires context-local dispatch admission. Test providers are explicit dependency overrides, not a production escape hatch. Do not introduce a second network adapter/call path when adding experiments. Topic routing never grants action/session/quota authority.

ASGI middleware issues HMAC-signed random anonymous sessions (HttpOnly, SameSite=Strict, Secure in production), validates expiry/signature, bounds request bodies, checks configured origins and rejects high-confidence explicit role/secret/unrelated requests. It never trusts a browser-provided identity or forwarded IP header. Production deployment must configure trusted proxy addresses at the ASGI server or disable proxy headers; use direct client network identity conservatively. Per-network and global budgets prevent simply rotating anonymous cookies from avoiding all limits. Anonymous sessions are not authenticated users; distributed attackers are not eliminated.

Existing strict Pydantic context/experiment/version/parameters/language/action/lesson validation remains. Derived science is independently recomputed before dispatch. User/lesson/context strings remain user-message data, never concatenated into trusted system instructions. Capability allowlists, fingerprints, atomic updates and explicit confirmation protect all mutations independently of scope outcomes.

## Scope policy

A configurable deterministic preflight recognizes only narrow, explicit high-confidence requests (not general keyword presence). All other prompts go to one ordinary provider call with a trusted educational policy: active experiment, relevant physics/math/scientific prerequisites/interpretation/troubleshooting. The same call must return a strict `scope` envelope: `in_scope` + result JSON; `out_of_scope` or `needs_clarification` + short message. Non-answer routes display deterministic localized messages, not arbitrary model prose. The normal typed response is still validated afterward. Invalid scope/output fails closed, without an automatic extra classifier call. Output length and upstream bytes remain bounded; prompts/keys are never logged or exposed in safe errors.

Prompt injection is not claimed solved. Model scope is a fallible routing signal; it cannot authorize execution, change limits, reveal backend-only credentials, bypass scientific constraints or confirm a frontend mutation. Adversarial fixture includes both legitimate prerequisites and indirect malicious text; measured results and unresolved errors are recorded in the acceptance report.

## Configurable limits and accounting

Environment settings (defaults are for local development):

| Variable | Default |
|---|---:|
| AI_MINUTE / AI_DAILY | 5 / 30 per server-issued session |
| AI_NETWORK_MINUTE / AI_NETWORK_DAILY | 20 / 120 per direct client address |
| AI_GLOBAL_DAILY | 200 provider attempts |
| AI_CONCURRENCY | 2 shared active HTTP dispatch leases |
| AI_INPUT_TOKENS | 32768 conservative UTF-8 serialized-message bytes as token upper estimate |
| AI_ORDINARY_OUTPUT / AI_LESSON_OUTPUT | 1200 / 3500 tokens |
| AI_CONTEXT_BYTES / AI_BODY_BYTES | 32768 / 65536 (body hard maximum 64 KiB) |
| AI_MAX_MESSAGES / AI_PROMPT_CHARS | 8 / 2000 (typed public prompt hard maximum 2000) |
| AI_TIMEOUT | 30 s, also bounded by provider LLM_TIMEOUT_SECONDS |
| AI_RETRIES | 0; at most 2 configurable retries for explicit upstream failure/unavailability only |
| AI_DAILY_USD | 1 estimated USD/day application budget |
| AI_INPUT_PRICE / AI_OUTPUT_PRICE | 2 / 10 USD per million tokens, accounting assumptions, NOT a Gemini price claim |

Limits reserve counters and worst-case configured estimated cost **before** each dispatch. Atomic minute buckets and UTC daily counters cover session, direct network, global attempts/cost, deduplication and shared active leases. Identical successful requests are suppressed briefly (10 s); failed calls release the duplicate marker/concurrency but retain conservative attempt/cost charges. Token metadata can refund unused reserved cost; request count is never refunded. No provider quota balance is invented. Upstream billing/tokenization can differ from estimates; configure prices to your actual project and audit usage. Timeouts/uncertain cancelled upstream work are conservatively charged, without automatic timeout retries. Explicit configured retries reserve again per attempt. Server restart resets the **local development** in-memory store and ephemeral signing key unless configured; this is not multi-instance governance.

## Production Redis and fail-closed behavior

Set AI_ENV=production, AI_REDIS_URL (private credential, never committed), a stable AI_SESSION_SECRET of ≥32 characters from a secret manager, and explicitly configure AI_INPUT_PRICE/AI_OUTPUT_PRICE. Missing required settings or unavailable Redis returns 503/quota_unavailable before new provider dispatch. Deterministic health/simulation remain available. Redis Lua makes the check-and-reserve atomic across instances; all keys share `{ai}` for cluster slot compatibility. Leases expire after the bounded dispatch timeout; failed finalization keeps conservative charges until expiry. Redis must use secure private networking/TLS/ACLs, persistence and capacity/eviction settings appropriate to quota integrity; it is infrastructure the repository does not provision.

Local fallback uses an asyncio lock, expiring counters/leases and a bounded key count. CI additionally starts an isolated Redis service and exercises real Lua concurrency/quota/refund contracts. Never point integration tests at a production DB: the dedicated REDIS_TEST_URL test database is flushed by those tests.

## Errors and UX

Structured detail.code and HTTP statuses: invalid request/context 422, out_of_scope 422, clarification_required 409, invalid_session 401, rate/daily/global/repeated limit 429 with Retry-After, quota/provider unavailable 503, timeout 504, invalid provider response or unsupported proposed action 502 (client-supplied invalid transitions remain 422). Existing legacy safe error codes remain compatible. The shared frontend fetch adapter includes signed cookies, localizes governance guidance, preserves abort behavior and displays last-confirmed application allowance/Retry-After only when server headers exist. That allowance is not Google project quota and may change under parallel requests. Local Canvas remains independent.

Primary Redis references: [atomic Lua scripting](https://redis.io/docs/latest/develop/programmability/eval-intro/), [async redis-py](https://redis.io/docs/latest/develop/clients/redis-py/async/). No external model calls run in CI.

Final six-plugin integration: optics, Kepler and collisions use the same v2 route/provider/gateway, without special bypasses or domain-specific authorization. Verified model summaries stay bounded (14 collision fixture snapshots are test assets, not appended to requests). All-domain tests cover forged context, scope, quotas and actual guarded adapter traversal for every plugin; separate tests exercise explain/action/lesson/feedback per plugin with only network mocked. No LLM decides scientific observables or bypasses action confirmation.

Milestone5: production gateway now checks AI_ENABLED before quota admission and again before every network dispatch/retry. Off is operational containment, not a distributed instant cancellation: roll all replicas; in-flight calls may complete. Readiness doesn't prove model permission/free quota. Private aggregate counters and Redis daily cost/call utilization exclude user/session/raw-prompt labels. Cancellation/parallel global budget/forged-forwarding/redaction and switch-race tests added.336synthetic offline prompts require honest reporting of deferred semantic cases;252adversarial structured actions execute0transitions. See release AI evaluation and deployment gates; no new real Gemini run is claimed.
