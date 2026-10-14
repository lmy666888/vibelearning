import { expect, it } from 'vitest';
import { lessonStepIds, navigateLesson, uniformElectricFieldLesson } from './uniformElectricField';
import { getPreset } from '../../simulations/physics/uniform-electric-field/presets';
it('provides complete structured authored lesson data', () => {
  expect(uniformElectricFieldLesson.steps).toHaveLength(4);
  expect(uniformElectricFieldLesson.title).toBe('Understanding Electric Force');
  expect(new Set(uniformElectricFieldLesson.steps.map(s => s.id)).size).toBe(4);
  for (const step of uniformElectricFieldLesson.steps) {
    expect(step.explanation && step.title && step.question).toBeTruthy();
    expect(getPreset(step.suggestedPresetId)).toBeDefined();
  }
});
it('navigates both directions and clamps at boundaries', () => {
  expect(navigateLesson(lessonStepIds[0], -1)).toBe(lessonStepIds[0]);
  expect(navigateLesson(lessonStepIds[0], 1)).toBe(lessonStepIds[1]);
  expect(navigateLesson(lessonStepIds[1], -1)).toBe(lessonStepIds[0]);
  expect(navigateLesson(lessonStepIds[3], 1)).toBe(lessonStepIds[3]);
});
it('rejects unknown lesson steps', () => expect(() => navigateLesson('missing' as never, 1)).toThrow());
