import { captureTutorRequest, TutorRequestError } from './tutor';
import type { SimulationContext } from '../simulations/core/simulationContext';
import type { SimulationParameters } from '../simulations/physics/uniform-electric-field/types';
import { controls, checkControlBounds, type ParameterTarget } from '../simulations/physics/uniform-electric-field/controls';
import { calculateParticleState, calculateVectorMagnitude } from '../simulations/physics/uniform-electric-field/physics';
import { getPreset, presetIds, snapshotParameters, type PresetId } from '../simulations/physics/uniform-electric-field/presets';

export type Action = { schema_version: 1 } & (
  { action: 'set_parameter'; target: ParameterTarget; value: number } |
  { action: 'scale_parameter'; target: ParameterTarget; factor: number } |
  { action: 'select_preset'; preset_id: PresetId } |
  { action: 'reset_simulation' }
);
export interface PlanRequest { instruction: string; simulation_context: SimulationContext; snapshot_id: string; parameter_revision: number }
export interface PhysicsPreview { force: { x: number; y: number }; acceleration: { x: number; y: number }; acceleration_magnitude: number }
export interface Proposal {
  status: 'proposal'; action: Action; explanation: string; before: SimulationParameters; after: SimulationParameters;
  before_physics: PhysicsPreview; after_physics: PhysicsPreview;
  snapshot_id: string; parameter_revision: number; requires_confirmation: true;
}
export interface Clarification { status: 'clarification_needed'; explanation: string }
export type PlanResult = Proposal | Clarification;
type CaptureState = Parameters<typeof captureTutorRequest>[1] & { parameterRevision: number };
export function capturePlanRequest(instruction: string, state: CaptureState): PlanRequest {
  const captured = captureTutorRequest(instruction, state);
  return Object.freeze({ instruction: captured.question, simulation_context: captured.simulation_context,
    snapshot_id: crypto.randomUUID(), parameter_revision: state.parameterRevision });
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid action response.');
  return value as Record<string, unknown>;
}
function keys(data: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(data).length !== allowed.length || allowed.some(k => !Object.hasOwn(data, k))) throw new Error('Unexpected action fields.');
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw new Error('Invalid action explanation.');
}
export function validateAction(value: unknown): Action {
  const data = object(value);
  if (data.schema_version !== 1) throw new Error('Unsupported action version.');
  const base = ['schema_version', 'action'];
  if (data.action === 'set_parameter' || data.action === 'scale_parameter') {
    const property = data.action === 'set_parameter' ? 'value' : 'factor';
    keys(data, [...base, 'target', property]);
    if (!controls.some(c => c.target === data.target) || typeof data[property] !== 'number' || !Number.isFinite(data[property])) throw new Error('Invalid parameter or number.');
    if (property === 'factor' && ((data.factor as number) <= 0 || (data.factor as number) > 10)) throw new Error('Scaling factor must be greater than zero and at most 10.');
  } else if (data.action === 'select_preset') {
    keys(data, [...base, 'preset_id']);
    if (!presetIds.includes(data.preset_id as PresetId)) throw new Error('Unknown preset.');
  } else if (data.action === 'reset_simulation') keys(data, base);
  else throw new Error('Unknown action.');
  return structuredClone(data) as Action;
}
export function applyAction(before: SimulationParameters, untrusted: unknown): SimulationParameters {
  const action = validateAction(untrusted);
  const p = structuredClone(before);
  if (action.action === 'select_preset') return snapshotParameters(getPreset(action.preset_id).parameters);
  if (action.action === 'set_parameter' || action.action === 'scale_parameter') {
    const [parent, key] = action.target.split('.');
    const container = (key ? p[parent as 'field' | 'initialVelocity'] : p) as unknown as Record<string, number>;
    const name = key ?? parent;
    container[name] = action.action === 'set_parameter' ? action.value : container[name] * action.factor;
  }
  checkControlBounds(p);
  calculateParticleState(p, 0);
  return snapshotParameters(p);
}
function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= Math.max(1e-20, Math.abs(b)*1e-10);
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(y).every(k => Object.hasOwn(x, k) && same(x[k], y[k]));
  }
  return a === b;
}
export function physicsPreview(p: SimulationParameters): PhysicsPreview {
  const { force, acceleration } = calculateParticleState(p, 0);
  return { force, acceleration, acceleration_magnitude: calculateVectorMagnitude(acceleration) };
}
/** Validate again at confirmation, including the exact captured parameters and deterministic preview. */
export function validateProposal(value: unknown, request: PlanRequest): Proposal {
  const data = object(value);
  keys(data, ['status', 'action', 'explanation', 'before', 'after', 'before_physics', 'after_physics', 'snapshot_id', 'parameter_revision', 'requires_confirmation']);
  text(data.explanation);
  if (data.status !== 'proposal' || data.requires_confirmation !== true || data.snapshot_id !== request.snapshot_id || data.parameter_revision !== request.parameter_revision || !same(data.before, request.simulation_context.parameters)) throw new Error('Proposal does not match its snapshot or confirmation requirement.');
  const action = validateAction(data.action);
  checkControlBounds(request.simulation_context.parameters);
  const after = applyAction(request.simulation_context.parameters, action);
  if (!same(data.after, after) || !same(data.before_physics, physicsPreview(request.simulation_context.parameters)) || !same(data.after_physics, physicsPreview(after))) throw new Error('Proposal physics failed verification.');
  return Object.freeze({ ...(structuredClone(data) as unknown as Proposal), action, before: snapshotParameters(request.simulation_context.parameters), after });
}
export function planIsCurrent(request: PlanRequest, state: CaptureState): boolean {
  return request.parameter_revision === state.parameterRevision && same(request.simulation_context.parameters, state.parameters) && request.simulation_context.activePresetId === (state.activePresetId ?? null);
}
export async function planAction(request: PlanRequest, signal?: AbortSignal): Promise<PlanResult> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/ai/plan-action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(130000)]),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const code = data?.detail?.code;
    const errors: Record<string, string> = { provider_timeout: 'The AI provider timed out. Please retry.', provider_rate_limited: 'The AI provider quota or rate limit was reached. Retry later.', invalid_action: 'The proposed action was invalid or outside experiment limits. Please clarify.', tutor_busy: 'AI Tutor is busy. Retry shortly.', tutor_not_configured: 'AI Tutor is not configured on the backend.' };
    throw new TutorRequestError(errors[code] ?? 'Action planning is unavailable. Check the backend and retry.');
  }
  try {
    const data = object(await response.json());
    if (data.status === 'clarification_needed') { keys(data, ['status', 'explanation']); text(data.explanation); return data as unknown as Clarification; }
    return validateProposal(data, request);
  } catch { throw new TutorRequestError('AI Tutor returned an invalid action response. Please regenerate.'); }
}
