# Roadmap

## Completed Day 1

Analytical uniform-electric-field physics, Canvas visualization, parameter controls, playback, health API, unit tests and documentation.

## Completed Day 2

Four experiment presets, stable baseline comparison, authored guided learning, a versioned SI context contract, Chromium E2E, and DPR-change handling.

## Day 3 readiness and proposed scope

1. Define the matching backend Pydantic context schema, version negotiation and request limits; keep calculated physics authoritative.
2. Specify tutor behavior and acceptance tests grounded in the experiment, with explicit user submission and clear authored/generated content labels.
3. Introduce server-only provider configuration, timeouts, cancellation, rate limits and privacy controls before connecting a real model. No provider credential should enter the frontend context.
4. Keep the simulation useful during network/provider failure.

## Later technical debt

Persistence of baselines/lesson progress, localization, richer lesson assessment, presets for mass changes, time controls, trajectory comparison and additional STEM modules. Validate Safari/Firefox, physical multi-monitor/zoom behavior, real mobile devices and production hosting. Establish Git history before collaborative changes.
