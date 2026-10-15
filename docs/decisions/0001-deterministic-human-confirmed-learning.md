# ADR 0001 — Deterministic simulation and human-confirmed AI actions

Date: 2026-10-14 (America/New_York). Status: accepted for local Day 5 MVP.

## Context

AI can propose educational experiments and discuss observations, but generated calculations, tool instructions and state assumptions can be wrong. Multi-step lessons add dependent transitions and possible partial application. Manual editing and delayed responses can invalidate earlier plans.

## Decision

Use the existing analytical simulation as the authority for force, acceleration and trajectories. Treat provider instructions/output as untrusted. Restrict proposals to the existing versioned action union and shared parameter limits. Validate the full sequential lesson on temporary parameters on both backend and frontend. Require a current snapshot/revision, complete before/after preview and explicit confirmation for each atomic step. Navigation/restart also require confirmation before restoration. Keep model feedback advisory and separate from computed physics; never infer mastery from one observation.

Reuse one simulation store, Canvas and physics engine. Maintain one explicit in-memory session state machine. Defer persistent session restoration until a versioned and fully revalidated restore transaction exists. Preserve existing standalone tutoring and free experimentation.

## Consequences

Extra review clicks make state changes understandable and prevent automatic execution or partial updates. Deterministic validation cannot prove natural-language intent or feedback correctness; students must review it. Generative language mismatches fail clearly without unlimited corrective calls. New experiment types need explicit typed capabilities and deterministic validators rather than arbitrary model-generated tools.
