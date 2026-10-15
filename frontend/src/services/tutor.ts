import {aiFetch} from './aiGovernance';
import { useLanguageStore, type Language } from '../stores/languageStore';
import { buildSimulationContext, type SimulationContextInput, type SimulationContext } from '../simulations/core/simulationContext';

export interface Explanation { answer: string; key_concepts: string[]; related_equations: string[] }
export class TutorRequestError extends Error {}
export interface TutorRequest { preferred_language?: Language; question: string; simulation_context: SimulationContext }
function freezeDeep<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
export function captureTutorRequest(question: string, state: SimulationContextInput): TutorRequest {
  const cleaned = question.trim();
  if (!cleaned || cleaned.length > 2000) throw new Error('Enter a question between 1 and 2000 characters.');
  return freezeDeep({ preferred_language: useLanguageStore.getState().language, question: cleaned, simulation_context: buildSimulationContext(state) });
}
export function isSnapshotCurrent(context: SimulationContext, state: SimulationContextInput): boolean {
  return context.time === state.time && context.activePresetId === (state.activePresetId ?? null) &&
    context.currentLessonStepId === (state.currentLessonStepId ?? null) &&
    JSON.stringify(context.parameters) === JSON.stringify(state.parameters);
}
const messages: Record<string, string> = {
  language_mismatch: 'The AI response did not match the selected language. Please retry or change the language preference.',
  tutor_not_configured: 'AI Tutor is not configured. Configure the provider on the backend; the simulation still works.',
  provider_timeout: 'The AI provider timed out. Please retry.',
  provider_unavailable: 'The AI provider is temporarily unavailable. Please retry.',
  provider_error: 'The AI provider could not complete the request. Please retry later.',
  provider_authentication_error: 'The AI provider rejected backend credentials or permissions. Check the backend configuration.',
  provider_rate_limited: 'The AI provider quota or rate limit was reached. Check project quota and retry later.',
  provider_model_unavailable: 'The configured AI model is unavailable. Check model access and configuration on the backend.',
  invalid_provider_response: 'The AI provider returned an invalid explanation. Please retry.',
  tutor_busy: 'AI Tutor is busy. Please retry in a moment.',
  inconsistent_physics: 'The simulation snapshot failed physics verification. Reset the experiment and retry.',
  local_only: 'AI Tutor is available only on the local development server.',
  origin_denied: 'This frontend origin is not allowed by the backend configuration.',
};
function validExplanation(value: unknown): value is Explanation {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  const list = (items: unknown) => Array.isArray(items) && items.length <= 8 && items.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 160);
  return Object.keys(data).length === 3 && typeof data.answer === 'string' && data.answer.trim().length > 0 && data.answer.length <= 8000 && list(data.key_concepts) && list(data.related_equations);
}
export async function askTutor(request: TutorRequest, signal?: AbortSignal): Promise<Explanation> {
  const response = await aiFetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/ai/explain`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(130000)]),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const code = data?.detail?.code;
    throw new TutorRequestError(messages[code] ?? (response.status === 422 ? 'The simulation request was invalid. Reset and retry.' : 'AI Tutor could not complete the request. Please retry.'));
  }
  const data: unknown = await response.json();
  if (!validExplanation(data)) throw new TutorRequestError('AI Tutor returned an invalid response. Please retry.');
  return data;
}
