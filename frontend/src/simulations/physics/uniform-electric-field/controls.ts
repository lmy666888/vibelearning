import definitions from '../../../../../shared/simulation-controls.json' with { type: 'json' };
import type { SimulationParameters } from './types';
export type ParameterTarget = 'charge' | 'mass' | 'field.x' | 'field.y' | 'initialVelocity.x' | 'initialVelocity.y';
export const controls = definitions as (typeof definitions[number] & { target: ParameterTarget })[];
export function parameterValue(p: SimulationParameters, target: ParameterTarget): number {
  switch (target) {
    case 'charge': return p.charge;
    case 'mass': return p.mass;
    case 'field.x': return p.field.x;
    case 'field.y': return p.field.y;
    case 'initialVelocity.x': return p.initialVelocity.x;
    case 'initialVelocity.y': return p.initialVelocity.y;
  }
}
export function checkControlBounds(p: SimulationParameters) {
  for (const c of controls) {
    const v = parameterValue(p, c.target);
    if (!Number.isFinite(v) || v < c.min * c.scale || v > c.max * c.scale) throw new RangeError(`${c.target} is outside experiment limits.`);
  }
}
