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
