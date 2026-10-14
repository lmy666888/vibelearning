import { expect, it } from 'vitest';
import { buildSimulationContext } from './simulationContext';
import { defaults } from '../../stores/simulationStore';
it('builds a versioned JSON-serializable SI transport snapshot', () => {
  const context = buildSimulationContext({ parameters: defaults, time: 2, activePresetId: 'positive-charge', currentLessonStepId: 'observe-positive' });
  expect(JSON.parse(JSON.stringify(context))).toEqual(context);
  expect(context.schemaVersion).toBe(1); expect(context.unitSystem).toBe('SI');
  expect(context.simulationId).toBe('uniform-electric-field-2d');
  expect(context.parameters.mass).toBe(1e-6);
  expect(context.particleState.position.x).toBeCloseTo(10);
  expect(context.particleState.position.y).toBeCloseTo(0.4);
  expect(context.force.y).toBeCloseTo(2e-7, 12);
  expect(context.acceleration.y).toBeCloseTo(0.2);
  expect(context.activePresetId).toBe('positive-charge');
  expect(context.currentLessonStepId).toBe('observe-positive');
});
it('uses explicit null for omitted optional identifiers', () => {
  const c = buildSimulationContext({ parameters: defaults, time: 0 });
  expect(c.activePresetId).toBeNull(); expect(c.currentLessonStepId).toBeNull();
});
it('detaches nested parameters and strips unexpected runtime properties', () => {
  const input = { ...defaults, field: { x: 0, y: 100 }, secret: 'should-not-be-copied' };
  const context = buildSimulationContext({ parameters: input, time: 1 });
  input.field.y = 200; expect(context.parameters.field.y).toBe(100);
  expect(JSON.stringify(context)).not.toContain('secret');
  context.parameters.initialVelocity.x = 100; expect(defaults.initialVelocity.x).toBe(5);
});
it('rejects invalid time or parameters', () => {
  expect(() => buildSimulationContext({ parameters: defaults, time: -1 })).toThrow();
  expect(() => buildSimulationContext({ parameters: defaults, time: Infinity })).toThrow();
  expect(() => buildSimulationContext({ parameters: { ...defaults, mass: 0 }, time: 0 })).toThrow();
});
