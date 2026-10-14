import { describe, expect, it } from 'vitest';
import { captureTutorRequest, isSnapshotCurrent } from './tutor';
import { defaults } from '../stores/simulationStore';
const state = { parameters: defaults, time: 2, activePresetId: null, currentLessonStepId: 'observe-positive' as const };
describe('immutable tutor request snapshots', () => {
  it('deep freezes and detaches the transport context', () => {
    const request = captureTutorRequest(' Why? ', state);
    expect(request.question).toBe('Why?');
    expect(Object.isFrozen(request.simulation_context.parameters.field)).toBe(true);
    expect(() => { request.simulation_context.parameters.field.y = 2; }).toThrow();
    expect(request.simulation_context.parameters).not.toBe(defaults);
  });
  it('detects changes to time, parameters, preset and lesson without using UI state', () => {
    const context = captureTutorRequest('Why?', state).simulation_context;
    expect(isSnapshotCurrent(context, state)).toBe(true);
    expect(isSnapshotCurrent(context, { ...state, time: 3 })).toBe(false);
    expect(isSnapshotCurrent(context, { ...state, parameters: { ...defaults, mass: 2e-6 } })).toBe(false);
    expect(isSnapshotCurrent(context, { ...state, activePresetId: 'positive-charge' })).toBe(false);
    expect(isSnapshotCurrent(context, { ...state, currentLessonStepId: 'reverse-charge' })).toBe(false);
  });
  it('rejects empty and oversized questions', () => {
    expect(() => captureTutorRequest(' ', state)).toThrow();
    expect(() => captureTutorRequest('x'.repeat(2001), state)).toThrow();
  });
});
