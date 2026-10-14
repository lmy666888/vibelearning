import { beforeEach, expect, it } from 'vitest';
import { useSimulationStore as store, defaults } from './simulationStore';
import { experimentPresets } from '../simulations/physics/uniform-electric-field/presets';

beforeEach(() => {
  store.setState({ parameters: defaults, status: 'paused', time: 0, error: null,
    activePresetId: null, baseline: null, currentLessonStepId: 'observe-positive' });
});
it.each(experimentPresets)('applies $id with one atomic notification', preset => {
  store.getState().play(); store.getState().advance(0.04);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications++; });
  store.getState().applyPreset(preset.id); unsubscribe();
  expect(notifications).toBe(1);
  expect(store.getState()).toMatchObject({ parameters: preset.parameters, time: 0, status: 'paused', activePresetId: preset.id });
});
it('clears preset identity on a manual parameter edit', () => {
  store.getState().applyPreset('negative-charge');
  store.getState().updateParameters({ ...store.getState().parameters, mass: 2e-6 });
  expect(store.getState().activePresetId).toBeNull();
});
it('saves a detached frozen baseline through edits and animation', () => {
  const input = { ...defaults, field: { ...defaults.field } };
  store.getState().updateParameters(input); store.getState().saveBaseline();
  const baseline = store.getState().baseline!;
  input.field.y = 999;
  store.getState().applyPreset('stronger-field'); store.getState().play(); store.getState().advance(0.04);
  expect(baseline.field.y).toBe(100);
  expect(baseline).not.toBe(store.getState().parameters);
  expect(Object.isFrozen(baseline.field)).toBe(true);
  expect(() => { baseline.field.y = 999; }).toThrow();
  expect(store.getState().baseline).toBe(baseline);
});
it('clears and replaces baseline explicitly', () => {
  store.getState().saveBaseline(); store.getState().applyPreset('no-field'); store.getState().saveBaseline();
  expect(store.getState().baseline?.field.y).toBe(0);
  store.getState().clearBaseline(); expect(store.getState().baseline).toBeNull();
});
it('lesson navigation preserves running parameters, time and preset identity', () => {
  store.getState().applyPreset('negative-charge'); store.getState().play(); store.getState().advance(0.04);
  const before = store.getState(); store.getState().navigateLesson(1);
  expect(store.getState().parameters).toBe(before.parameters);
  expect(store.getState().time).toBe(before.time);
  expect(store.getState().status).toBe('running');
  expect(store.getState().activePresetId).toBe('negative-charge');
  expect(store.getState().currentLessonStepId).toBe('reverse-charge');
});
it('invalid preset cannot partially change store', () => {
  const before = store.getState();
  expect(() => store.getState().applyPreset('missing' as never)).toThrow();
  expect(store.getState()).toBe(before);
});
