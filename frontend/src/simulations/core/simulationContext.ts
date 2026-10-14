import { calculateParticleState } from '../physics/uniform-electric-field/physics';
import type { SimulationParameters } from '../physics/uniform-electric-field/types';
import type { ParticleState, Vector2 } from './types';
import type { PresetId } from '../physics/uniform-electric-field/presets';
import type { LessonStepId } from '../../learning/lessons/uniformElectricField';

export interface SimulationContextInput {
  parameters: SimulationParameters;
  time: number;
  activePresetId?: PresetId | null;
  currentLessonStepId?: LessonStepId | null;
}
export interface SimulationContext {
  schemaVersion: 1;
  simulationId: 'uniform-electric-field-2d';
  unitSystem: 'SI';
  parameters: SimulationParameters;
  time: number;
  particleState: ParticleState;
  force: Vector2;
  acceleration: Vector2;
  activePresetId: PresetId | null;
  currentLessonStepId: LessonStepId | null;
}
/** Pure, detached transport object. No store access, network requests, or UI state. */
export function buildSimulationContext(input: SimulationContextInput): SimulationContext {
  const parameters: SimulationParameters = {
    charge: input.parameters.charge, mass: input.parameters.mass,
    field: { x: input.parameters.field.x, y: input.parameters.field.y },
    initialPosition: { x: input.parameters.initialPosition.x, y: input.parameters.initialPosition.y },
    initialVelocity: { x: input.parameters.initialVelocity.x, y: input.parameters.initialVelocity.y },
  };
  const particleState = calculateParticleState(parameters, input.time);
  return {
    schemaVersion: 1, simulationId: 'uniform-electric-field-2d', unitSystem: 'SI',
    parameters, time: input.time, particleState,
    force: { ...particleState.force }, acceleration: { ...particleState.acceleration },
    activePresetId: input.activePresetId ?? null, currentLessonStepId: input.currentLessonStepId ?? null,
  };
}
