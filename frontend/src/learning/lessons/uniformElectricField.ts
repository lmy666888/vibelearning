import type { PresetId } from '../../simulations/physics/uniform-electric-field/presets';

export const lessonStepIds = ['observe-positive', 'reverse-charge', 'increase-field', 'explain-acceleration'] as const;
export type LessonStepId = typeof lessonStepIds[number];
export interface LessonStep {
  readonly id: LessonStepId;
  readonly title: string;
  readonly explanation: string;
  readonly suggestedPresetId: PresetId;
  readonly question: string;
}
export interface GuidedLesson {
  readonly id: string;
  readonly title: string;
  readonly learningObjective: string;
  readonly steps: readonly LessonStep[];
}
export const uniformElectricFieldLesson: GuidedLesson = {
  id: 'understanding-electric-force',
  title: 'Understanding Electric Force',
  learningObjective: 'Understand how electric charge and electric field determine force and acceleration.',
  steps: [
    { id: 'observe-positive', title: 'Observe a positive charge', explanation: 'Apply the positive charge experiment and press Play. The initial horizontal velocity remains constant while the upward electric force increases vertical velocity.', suggestedPresetId: 'positive-charge', question: 'Why does the trajectory curve upward even though the initial vertical velocity is zero?' },
    { id: 'reverse-charge', title: 'Reverse the charge', explanation: 'Keep mass and field unchanged, then apply the negative charge experiment. A negative charge experiences force opposite to the electric field.', suggestedPresetId: 'negative-charge', question: 'Which velocity component changes direction, and which remains unchanged?' },
    { id: 'increase-field', title: 'Increase the electric field', explanation: 'Compare the positive charge experiment with a field twice as strong. At fixed charge and mass, doubling the field doubles force and acceleration.', suggestedPresetId: 'stronger-field', question: 'How does the vertical displacement after the same elapsed time compare with the positive charge experiment?' },
    { id: 'explain-acceleration', title: 'Explain why acceleration changes', explanation: 'Use F = qE and a = F/m. Charge sign determines direction; charge magnitude and field strength scale force, while greater mass reduces acceleration. Without a field, this model has no net force.', suggestedPresetId: 'no-field', question: 'Why does the particle keep moving when the electric field is removed?' },
  ],
};

export function navigateLesson(current: LessonStepId, direction: -1 | 1): LessonStepId {
  const index = lessonStepIds.indexOf(current);
  if (index < 0) throw new RangeError('Unknown lesson step');
  return lessonStepIds[Math.max(0, Math.min(lessonStepIds.length - 1, index + direction))];
}
