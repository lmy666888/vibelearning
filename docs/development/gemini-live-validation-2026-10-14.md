# Gemini 3.5 Flash-Lite Live Validation

## Date and selected configuration
2026-10-14, America/New_York. Existing project, feature branch feat/day3-ai-tutor, PR #1.
Provider: Google Gemini. Model: gemini-3.5-flash-lite. Base URL: https://generativelanguage.googleapis.com/v1beta/openai/ . Timeout: 30 seconds. Existing backend-local key preserved, never displayed or tracked. Local .env remains ignored with 0600 permissions.

## Free-tier evidence and limitations
The official standard pricing table lists free input/output for this model: https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite . The user identified the existing AI Studio project as Free tier. No billing was enabled and no project was created. The account-specific rate-limit page redirected to Google sign-in in the available documentation tool; no authenticated project-admin credentials or gcloud session were available. Exact remaining RPM/TPM/RPD and billing-account status are therefore not independently verified. Real generation confirms access now, not unlimited access or guaranteed future quota. No automatic paid fallback or another model was used.

## Minimal actual generation
The official OpenAI-compatible model-list endpoint returned HTTP 200 and listed gemini-3.5-flash-lite. The production HTTP adapter, with a 512 completion-token ceiling and a short negative-charge question, returned HTTP 200 and response model gemini-3.5-flash-lite. The answer correctly explained that negative q reverses force relative to the upward field. The response passed strict answer/key_concepts/related_equations validation. This was real generation, not a fixture.

## Real FastAPI scenarios
Each context was constructed with the existing strict schema and canonical analytical physics implementation. Requests went over HTTP to the real local FastAPI endpoint, which verified all derived quantities before calling the configured provider. No mock provider or HTTP interception was used for these manual checks.

| Scenario | Parameters | HTTP | Actual explanation reviewed | Result |
| --- | --- | --- | --- | --- |
| A: positive | q=+2e-9 C, m=1e-6 kg, Ey=+200 N/C | 200 | Upward field, upward force +4.0e-7 N, upward acceleration +0.40 m/s² | Pass |
| B: negative (Chinese) | q=-2e-9 C, m=1e-6 kg, Ey=+200 N/C | 200 | Chinese answer distinguishes upward field from downward force -4.0e-7 N and acceleration -0.4 m/s² | Pass |
| C: doubled field | q=+2e-9 C, m=1e-6 kg, Ey=+100 then +200 N/C | 200 | Current force +2.0e-7 N and acceleration +0.20 m/s²; predicts +4.0e-7 N and +0.40 m/s² at doubled field | Pass |

Scenario A supplied the real 200 N/C comparison state; scenario C used a real 100 N/C snapshot and clearly labeled the 200 N/C values as a prediction. The numerical values and force directions were manually reviewed against the deterministic engine, not accepted solely because schema validation passed.

## Real React verification
Used the existing visible React interface, set charge to -2 nC and Ey to 200 N/C, entered a Chinese question and clicked Ask AI Tutor. The real Gemini answer stated Fy=-4.0e-7 N and ay=-0.4 m/s², with key concepts and F=qE / a=F/m equations. Playback was started while Asking was visible; elapsed time, position and velocity continued to update. The submitted snapshot stayed at t=0 and an earlier-state notice remained visible after motion. Paused after the response and saved a screenshot outside the repository. No provider response was synthesized or intercepted.

## Error and regression verification
Mocked HTTP tests cover 401/403 credential/permission failure, 404 unavailable model, 429 quota/rate failure, 5xx provider failure, timeout, malformed responses and size limits. A deterministic browser test checks that a provider quota error is readable, does not expose diagnostics and does not stop simulation. No deliberate extra real failed calls were made solely to test error messages.

Final suites executed: 76 Vitest, 79 Pytest, 19 Chromium E2E, strict TypeScript and production build. All passed. Automated tests use mocks and never call paid external services. The selected model is updated only in ignored local configuration and credential-free example/docs/tests.

## Remaining limits
These live checks are a small correctness sample; models can still make mistakes. Exact project quota/account billing state, non-Chromium browsers and production authentication/rate/budget controls remain outside the verified scope. Do not expose the local paid-capable endpoint publicly without those protections.
