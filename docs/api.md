# AI API contracts

All endpoints are POST JSON under `/api/ai`, local/origin guarded, with a 64 KiB request limit and safe provider errors. Bodies and response models forbid unknown fields. Physics values use SI. OpenAPI schema is available from the running FastAPI app at `/docs` and `/openapi.json`.

## Existing endpoints

`/explain` retains question + Context v1 and answer/key_concepts/related_equations. `/plan-action` retains instruction + Context v1 + snapshot_id + parameter_revision and one proposal/clarification. Both accept optional `preferred_language: "zh-CN" | "en"`; legacy callers can omit it. Their response shapes are unchanged.

## POST /generate-lesson

Request fields:
- `learning_goal`: trimmed 1–2000 characters.
- `preferred_language`: zh-CN or en.
- `simulation_context`: existing full immutable Context v1; all derived quantities are verified.
- `capabilities`: simulation_id=`uniform-electric-field-2d`, unique operation list (1–4 existing Day 4 names), unique parameter_targets (1–6 existing paths).

Success is a discriminated union:
- `status: "unsupported_capability"`, `language`, `reason`: current simulation cannot represent the goal; no actions.
- `status: "lesson"`, integer `schema_version: 1`, server `lesson_id` UUID, language, title, 1–5 learning_objectives, initial_parameters, 1–5 ordered steps, metadata `{provider_model, generated_at}`.

Each step has step_id=`step-N`, title, objective, 1–3 experiment_actions using the complete Day 4 schema (including schema_version=1), expected_behavior, observation_question, 1–5 expected_concepts, explanation, completion_criteria=`submit_observation`, before, after, predicted_physics and `requires_confirmation: true`. Natural prose fields are bounded to 240 characters. The model cannot provide derived before/after or prediction fields. Predicted physics contains force/acceleration vectors and acceleration_magnitude. Step N starts from the validated result of step N−1. No server or frontend execution occurs upon generation.

## POST /evaluate-observation

Request fields: full validated `lesson`, `step_id`, `student_answer` (trimmed 1–2000), current `simulation_context`, `preferred_language`. The server validates the lesson chain and current experiment against the chosen step before calling the provider; client-supplied predictions are never accepted without deterministic reconstruction.

Response fields: assessment=`correct | partially_correct | incorrect | needs_clarification`, feedback/explanation (bounded to 2000), hint (null or ≤240), next_action=`retry | continue`, lesson_id, step_id and independently calculated authoritative_physics. Non-correct assessments must suggest retry. A correct answer may still suggest retry; only correct + continue permits progression. Assessment is educational guidance, not a mastery or certification decision.

## Error semantics

422: malformed schema, unsupported enum/version, inconsistent physics or stale/invalid lesson context. 403: nonlocal client or unapproved frontend origin. 413: body limit. 429: provider quota/rate-limit or application concurrency gate. 503: missing configuration/unavailable transport. 504: timeout. 502: provider permissions/model/upstream/invalid structured output, invalid action transition, or language_mismatch. All are safe errors without upstream debug, credentials or student text echo. Unexpected errors return a generic 500. There are no automatic retries, execution APIs or billing changes.

Lesson IDs are correlation identifiers, not signed authorization. Backend services remain stateless; browser-local lesson state controls progression, and each physical change still requires explicit confirmation. Public authenticated storage/grading is outside this release.

## Experiment Context v2

New routes: `POST /api/v2/ai/explain`, `/plan-action`, `/generate-lesson`, `/evaluate-observation`. Existing `/api/ai/...` v1 contracts are unchanged. V1 data must use v1 endpoints; it is never guessed/migrated to a different experiment.

Every v2 request has `{context, prompt, preferred_language}`. Context fields are exactly:

```json
{
  "schema_version": 2,
  "experiment_id": "lorentz-force-2d",
  "experiment_version": 1,
  "parameters": {},
  "query": {"time": 0},
  "simulation_state": {},
  "observables": {},
  "revision": 1,
  "snapshot_id": "fnv1a-..."
}
```

Empty objects above are placeholders: each plugin independently validates its real parameters/query and recomputes the complete state/observable schema. Read-only initial positions, SI conversions, timestep constraints and presets are in the canonical manifest. Current IDs are `uniform-electric-field` and `lorentz-force-2d`, version 1. Context revision is a nonnegative safe integer; unknown schema/experiment versions reject. No derived data is trusted solely because a hash is present.

Explain returns the original answer/key_concepts/related_equations shape; equations come from the selected registry. Action planning returns clarification or one strict action plus experiment identity/version, before/after parameters, before_observables (actual query), after_observables (reset/initial query), snapshot_id, revision and requires_confirmation=true. The model only supplies action/explanation; the server computes the rest. Action schema remains version 1 and supports set_parameter, scale_parameter, select_preset and reset_simulation. Targets are selected manifest paths, including Lorentz magneticFieldZ, timeStep and duration; readonly paths, wrong presets and unstable combinations reject. There is no execute endpoint.

Generate-lesson returns unsupported_capability or schema_version=2 lesson with experiment ID/version, server lesson_id, language/title/objectives, initial_parameters and up to five sequential steps (1–3 actions each). Steps add before/after, predicted_observables and mandatory confirmation. Evaluate-observation additionally requires `lesson` and `step_id`; `prompt` is the student's answer. It returns structured assessment/feedback/explanation/hint/next_action, lesson/step IDs and authoritative_observables for the validated current query. Plans from another experiment/version or a mismatched active setup reject. Only correct + continue unlocks progression; feedback never mutates the experiment.

Safe error classifications and 64 KiB body/32 KiB provider response limits apply to v1 and v2. Context/science/lesson identity failures return 422 invalid_experiment_context, invalid provider output/action or language returns safe 502, quota 429, timeout 504, unavailable configuration 503. All routes share the provider adapter and two-slot per-process gate; CI has no credentials and makes no external calls. Context IDs are not authentication tokens; a public deployment still needs authenticated, server-owned session/authorization design.

## Multi-zone context and regional actions (2026-10-15)

`multi-zone-em`, experiment_version 1, uses the existing Context v2 envelope and four `/api/v2/ai/{operation}` routes. Parameters contain charge/mass, initialPosition/initialVelocity, timeStep/duration, and ≤12 versioned regions. Backend independently recomputes local fields, active IDs, force/acceleration, displacement, velocity/energy changes and state. No client trajectory arrays are accepted or sent to Gemini; summaries are derived from initial/current state, not claims about every previously visited region.

Additional schema_version:1 action variants, only advertised for this plugin:
- `add_field_region`: full `region` (schema in spatial guide).
- `update_field_region`: `region_id`, nonempty `changes` containing name, full electric_field {x,y}, magnetic_field {z}, or color.
- `move_field_region`: region_id,x,y in m.
- `resize_field_region`: region_id,width,height in m.
- `remove_field_region`: region_id.
- `toggle_field_region`: region_id,enabled boolean.

Strict discriminators/keys/types, ID uniqueness/existence, geometry/component/world limits and integration budgets are validated after each sequential operation. Patch nulls are rejected and omitted fields stay omitted in response serialization. Unknown/cross-plugin operations fail. Ambiguous requests should return clarification_needed; the model never mutates frontend state. Existing proposal identity/confirmation fields and bounded three-action/five-step lesson contracts remain unchanged. Preview before readings use the captured query; after readings use t=0 because confirmation resets motion. A particle initially outside all zones therefore has zero reset force even if later motion differs; the region before/after table exposes the exact changed geometry/fields.

Model errors retain existing safe HTTP mapping; invalid context 422, provider invalid action/structure/language 502, quota/busy 429, timeout 504. Request body remains bounded to 64 KiB, including large lessons. Endpoint mocks run in CI; real requests are manual limited verification only.

## Governed AI sessions and limits

GET /api/ai/session issues/validates an HttpOnly signed anonymous cookie; AI POSTs can also issue a new server session. Forged/expired cookies return 401 and are cleared. A server cookie is not authenticated user identity. All existing v1/v2 AI contracts remain; provider-only wire JSON adds a strict scope/result envelope, stripped before normal typed API responses. Deterministic preflight can return out_of_scope 422 or clarification_required 409; semantic classification is part of the ordinary call. Limits return 429/Retry-After, quota-store outage 503; malformed request/context remains 422. Successful reservation responses may expose X-AI-Remaining-Daily/Minute as last-confirmed **application** allowance, never provider/project quota. Responses are no-store; explicit CORS origins and credentials are supported. Maximum public body remains 64 KiB; additional context/message/token limits are configurable. See AI guardrails documentation.

## Double-slit context

Experiment double-slit-interference/version1 uses Context v2 with query `{events: integer}`. Parameters/limits are in the canonical manifest. State contains count/mean/51 histogram bins; observables include normalized intensity, paraxial fringe estimate, exact envelope zero, probability normalization, sample statistics and far-field warning. Full profiles/detection arrays stay out of AI requests. Existing generic parameter/preset/reset actions, lesson sequencing and all governance limits apply unchanged.

Kepler-orbital-mechanics/version1 uses Context v2 `{time: seconds}`, validated bound orbital elements and two masses. State/observables include relative position/velocity, gravity, period, area, energy/h invariants and root residual. Query duration is ≤period×durationPeriods. Generic set/scale/preset/reset actions include eccentricity, semimajorAxis and binary showAreas; all are validated and confirmed under existing governance. No large orbit path is sent to the provider.

`momentum-collisions` v1 uses `{time}` within parameter duration, SI masses/radii/positions/velocities, dimension1/2, restitution0–1 and frame0/1. Strictly rejects overlaps and1D transverse components. Context contains two-body states and at most one event, verified independently. Preview includes contact time (null if none in horizon), post velocities and energy; laboratory versus displayed-frame quantities are labeled separately. Shared `/api/v2/ai/*` operations, quotas and confirmation remain unchanged; no client-derived collision result is trusted.
