import { describe, expect, it } from 'vitest';
import { experimentPresets, getPreset } from './presets';
import { calculateParticleState, validateParameters } from './physics';

describe('experiment presets', () => {
  it('has four unique, complete definitions', () => {
    expect(new Set(experimentPresets.map(p => p.id)).size).toBe(4);
    for (const p of experimentPresets) {
      expect(p.title && p.description && p.learningObjective && p.expectedBehavior).toBeTruthy();
      expect(() => validateParameters(p.parameters)).not.toThrow();
      expect(p.parameters.initialPosition).toEqual({ x: 0, y: 0 });
    }
  });
  it.each([['positive-charge', 0.2], ['negative-charge', -0.2], ['stronger-field', 0.4], ['no-field', 0]] as const)('%s has the expected acceleration', (id, expected) => {
    const s = calculateParticleState(getPreset(id).parameters, 2);
    expect(s.acceleration.y).toBeCloseTo(expected);
    expect(s.acceleration.x).toBeCloseTo(0);
    if (id === 'no-field') expect(s.velocity).toEqual({ x: 5, y: 0 });
  });
  it('freezes nested preset parameters', () => {
    expect(Object.isFrozen(getPreset('positive-charge').parameters.field)).toBe(true);
    expect(() => { getPreset('positive-charge').parameters.field.y = 999; }).toThrow();
  });
});
