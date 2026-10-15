import { create } from 'zustand';
import type { SimulationParameters } from '../simulations/physics/uniform-electric-field/types';
import { calculateParticleState, validateParameters } from '../simulations/physics/uniform-electric-field/physics';
import { getPreset, snapshotParameters, type PresetId } from '../simulations/physics/uniform-electric-field/presets';
import { lessonStepIds, navigateLesson, type LessonStepId } from '../learning/lessons/uniformElectricField';

import { planIsCurrent, validateProposal, type PlanRequest, type Proposal } from '../services/actions';

export const defaults = snapshotParameters(getPreset('positive-charge').parameters);
interface Store {
  parameters: SimulationParameters;
  parameterRevision: number;
  confirmProposal: (proposal: Proposal, request: PlanRequest) => void;
  status: 'paused' | 'running';
  time: number;
  error: string | null;
  activePresetId: PresetId | null;
  baseline: SimulationParameters | null;
  currentLessonStepId: LessonStepId;
  play: () => void;
  pause: () => void;
  reset: () => void;
  updateParameters: (parameters: SimulationParameters) => void;
  applyPreset: (id: PresetId) => void;
  saveBaseline: () => void;
  clearBaseline: () => void;
  navigateLesson: (direction: -1 | 1) => void;
  advance: (dt: number) => void;
}
function checkedSnapshot(parameters: SimulationParameters) {
  validateParameters(parameters);
  calculateParticleState(parameters, 0);
  return snapshotParameters(parameters);
}
export const useSimulationStore = create<Store>((set, get) => ({
  parameters: defaults, parameterRevision: 0, status: 'paused', time: 0, error: null,
  activePresetId: null, baseline: null, currentLessonStepId: lessonStepIds[0],
  play: () => set({ status: 'running', error: null }),
  pause: () => set({ status: 'paused' }),
  reset: () => set(state => ({ status: 'paused', time: 0, error: null, parameterRevision: state.parameterRevision + 1 })),
  updateParameters: parameters => set(state => ({ parameterRevision: state.parameterRevision + 1, parameters: checkedSnapshot(parameters), time: 0, status: 'paused', error: null, activePresetId: null })),
  applyPreset: id => set(state => ({ parameterRevision: state.parameterRevision + 1, parameters: checkedSnapshot(getPreset(id).parameters), time: 0, status: 'paused', error: null, activePresetId: id })),
  confirmProposal: (proposal, request) => set(state => {
    if (!planIsCurrent(request, state)) throw new Error('Stale proposal. Regenerate with the current experiment.');
    const validated = validateProposal(proposal, request);
    return { parameters: checkedSnapshot(validated.after), parameterRevision: state.parameterRevision + 1,
      time: 0, status: 'paused', error: null,
      activePresetId: validated.action.action === 'select_preset' ? validated.action.preset_id : validated.action.action === 'reset_simulation' ? state.activePresetId : null };
  }),
  saveBaseline: () => set({ baseline: checkedSnapshot(get().parameters) }),
  clearBaseline: () => set({ baseline: null }),
  navigateLesson: direction => set({ currentLessonStepId: navigateLesson(get().currentLessonStepId, direction) }),
  advance: dt => {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid time step');
    const state = get();
    if (state.status !== 'running') return;
    const time = state.time + Math.min(dt, 0.05);
    try {
      calculateParticleState(state.parameters, time);
      set({ time });
    } catch {
      set({ status: 'paused', error: 'Numeric range exceeded. Adjust parameters or reset.' });
    }
  },
}));
