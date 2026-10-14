import type { SimulationParameters } from './types';

export function snapshotParameters(parameters: SimulationParameters): SimulationParameters {
  return Object.freeze({
    ...parameters,
    field: Object.freeze({ ...parameters.field }),
    initialPosition: Object.freeze({ ...parameters.initialPosition }),
    initialVelocity: Object.freeze({ ...parameters.initialVelocity }),
  });
}

export const presetIds = ['positive-charge', 'negative-charge', 'stronger-field', 'no-field'] as const;
export type PresetId = typeof presetIds[number];
export interface ExperimentPreset {
  readonly id: PresetId;
  readonly title: string;
  readonly description: string;
  readonly learningObjective: string;
  readonly parameters: SimulationParameters;
  readonly expectedBehavior: string;
}
const base: SimulationParameters = {
  charge: 2e-9, mass: 1e-6, field: { x: 0, y: 100 },
  initialPosition: { x: 0, y: 0 }, initialVelocity: { x: 5, y: 0 },
};
export const experimentPresets: readonly ExperimentPreset[] = Object.freeze([
  { id: 'positive-charge', title: 'Positive Charge', description: 'A positive particle in an upward electric field.', learningObjective: 'Relate positive charge to force along the field.', parameters: base, expectedBehavior: 'Upward acceleration: ay = +0.200 m/s².' },
  { id: 'negative-charge', title: 'Negative Charge', description: 'Reverse the charge while keeping the field unchanged.', learningObjective: 'Explain how charge polarity reverses force.', parameters: { ...base, charge: -2e-9 }, expectedBehavior: 'Downward acceleration: ay = −0.200 m/s².' },
  { id: 'stronger-field', title: 'Stronger Electric Field', description: 'Double the upward electric field to 200 N/C.', learningObjective: 'Identify the proportional relationship between field and acceleration.', parameters: { ...base, field: { x: 0, y: 200 } }, expectedBehavior: 'Upward acceleration doubles: ay = +0.400 m/s².' },
  { id: 'no-field', title: 'No Electric Field', description: 'Remove the field and retain the initial horizontal velocity.', learningObjective: 'Recognize constant velocity when the net electric force is zero.', parameters: { ...base, field: { x: 0, y: 0 } }, expectedBehavior: 'Zero acceleration; vx remains 5.000 m/s and vy remains zero.' },
].map(preset => Object.freeze({ ...preset, parameters: snapshotParameters(preset.parameters) })) as ExperimentPreset[]);

export function getPreset(id: PresetId): ExperimentPreset {
  const preset = experimentPresets.find(item => item.id === id);
  if (!preset) throw new RangeError('Unknown experiment preset');
  return preset;
}
