import { calculateParticleState, calculateVectorMagnitude, finite } from './physics';
import type { SimulationParameters } from './types';

export interface Difference {
  /** Signed current minus baseline, in the displayed unit. Null means overflow. */
  delta: number | null;
  /** 100 * (current - baseline) / abs(baseline); null for a zero baseline or overflow. */
  percent: number | null;
  reason: 'zero-baseline' | 'numeric-range' | null;
}
export function calculateDifference(baseline: number, current: number): Difference {
  finite(baseline); finite(current);
  const difference = current - baseline;
  const delta = Number.isFinite(difference) ? difference : null;
  if (baseline === 0) return { delta, percent: null, reason: 'zero-baseline' };
  const percentage = delta === null
    ? (current / Math.abs(baseline) - Math.sign(baseline)) * 100
    : (delta / Math.abs(baseline)) * 100;
  const percent = Number.isFinite(percentage) ? percentage : null;
  return { delta, percent, reason: delta === null || percent === null ? 'numeric-range' : null };
}
export interface ComparisonRow extends Difference {
  id: string;
  label: string;
  unit: string;
  kind: 'component' | 'magnitude' | 'scalar';
  baseline: number;
  current: number;
}
function quantities(parameters: SimulationParameters): number[] {
  const state = calculateParticleState(parameters, 0);
  return [parameters.charge / 1e-9, parameters.mass / 1e-6,
    parameters.field.x, parameters.field.y, parameters.initialVelocity.x, parameters.initialVelocity.y,
    state.force.x, state.force.y, state.acceleration.x, state.acceleration.y,
    calculateVectorMagnitude(state.acceleration)];
}
const definitions = [
  ['charge', 'Charge q', 'nC', 'scalar'], ['mass', 'Mass m', 'mg', 'scalar'],
  ['ex', 'Electric field Ex', 'N/C', 'component'], ['ey', 'Electric field Ey', 'N/C', 'component'],
  ['vx', 'Initial velocity vx', 'm/s', 'component'], ['vy', 'Initial velocity vy', 'm/s', 'component'],
  ['fx', 'Electric force Fx', 'N', 'component'], ['fy', 'Electric force Fy', 'N', 'component'],
  ['ax', 'Acceleration ax', 'm/s²', 'component'], ['ay', 'Acceleration ay', 'm/s²', 'component'],
  ['acceleration-magnitude', 'Acceleration magnitude |a|', 'm/s²', 'magnitude'],
] as const;
export function compareExperiments(baseline: SimulationParameters, current: SimulationParameters): ComparisonRow[] {
  const before = quantities(baseline), after = quantities(current);
  return definitions.map(([id, label, unit, kind], index) => ({
    id, label, unit, kind, baseline: before[index], current: after[index],
    ...calculateDifference(before[index], after[index]),
  }));
}
