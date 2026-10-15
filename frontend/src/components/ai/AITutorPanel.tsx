import { ExperimentActionForm } from './ExperimentActionForm';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSimulationStore } from '../../stores/simulationStore';
import { askTutor, captureTutorRequest, isSnapshotCurrent, TutorRequestError, type Explanation, type TutorRequest } from '../../services/tutor';

export const suggestedQuestions = [
  'Why does charge polarity change the acceleration direction?',
  'What happens if I double the electric field?',
  'Why does particle mass affect acceleration?',
];
interface Result { request: TutorRequest; explanation: Explanation }
export function AITutorPanel() {
  const [mode, setMode] = useState<'explain' | 'plan'>('explain');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [stale, setStale] = useState(false);
  const [submitted, setSubmitted] = useState<TutorRequest | null>(null);
  const snapshot = useRef<TutorRequest | null>(null);
  const staleValue = useRef(false);
  function updateStale(changed: boolean) {
    if (staleValue.current !== changed) { staleValue.current = changed; setStale(changed); }
  }
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const unsubscribe = useSimulationStore.subscribe(state => {
      if (snapshot.current) {
        const changed = !isSnapshotCurrent(snapshot.current.simulation_context, state);
        updateStale(changed);
      }
    });
    return () => { unsubscribe(); pending.current?.abort(); pending.current = null; };
  }, []);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pending.current) return;
    let request: TutorRequest;
    try { request = captureTutorRequest(question, useSimulationStore.getState()); }
    catch (failure) { setError((failure as Error).message); return; }
    const controller = new AbortController();
    pending.current = controller;
    snapshot.current = request;
    setSubmitted(request); setLoading(true); setError(null); setResult(null); updateStale(false);
    try {
      const explanation = await askTutor(request, controller.signal);
      if (pending.current !== controller || controller.signal.aborted) return;
      setResult({ request, explanation });
      updateStale(!isSnapshotCurrent(request.simulation_context, useSimulationStore.getState()));
    } catch (failure) {
      if (pending.current !== controller || controller.signal.aborted) return;
      setError(failure instanceof TutorRequestError ? failure.message
        : 'AI Tutor is unreachable or the request timed out. Check the backend and retry.');
    } finally {
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }
  return <section className="panel ai-tutor" aria-labelledby="ai-tutor-heading">
    <span className="eyebrow">CONTEXT-AWARE PHYSICS EXPLANATIONS</span>
    <h2 id="ai-tutor-heading">AI Tutor</h2>
    <div className="buttons" aria-label="Tutor mode">
      <button aria-pressed={mode === 'explain'} disabled={loading} onClick={() => setMode('explain')}>Ask a physics question</button>
      <button aria-pressed={mode === 'plan'} disabled={loading} onClick={() => setMode('plan')}>Request an experiment change</button>
    </div>
    {mode === 'plan' ? <ExperimentActionForm /> : <>
    <p>Ask about the current simulation. Your question and an SI snapshot are sent to the configured provider through the backend. Generated explanations can be mistaken; the verified readings remain authoritative.</p>
    <div className="suggested-questions" aria-label="Suggested questions">
      {suggestedQuestions.map(text => <button key={text} disabled={loading} onClick={() => setQuestion(text)}>{text}</button>)}
    </div>
    <form onSubmit={submit} aria-busy={loading}>
      <label htmlFor="tutor-question">Your physics question</label>
      <textarea id="tutor-question" value={question} maxLength={2000} rows={3} disabled={loading}
        onChange={event => setQuestion(event.target.value)} placeholder="Why is my particle accelerating downward?" />
      <div className="tutor-actions"><small>{question.length}/2000 · Replies follow your question's language.</small>
        <button type="submit" className="primary" disabled={loading || !question.trim()}>{loading ? 'Asking…' : 'Ask AI Tutor'}</button></div>
    </form>
    {loading && <p role="status">Generating an explanation from the submitted snapshot… Simulation playback remains available.</p>}
    {submitted && <p className="snapshot-summary" data-testid="tutor-snapshot">Submitted snapshot: t = {submitted.simulation_context.time.toFixed(3)} s · preset = {submitted.simulation_context.activePresetId ?? 'custom'} · q = {submitted.simulation_context.parameters.charge.toExponential(3)} C · m = {submitted.simulation_context.parameters.mass.toExponential(3)} kg · E = ({submitted.simulation_context.parameters.field.x}, {submitted.simulation_context.parameters.field.y}) N/C</p>}
    {submitted && stale && <p className="stale-notice" role="status">Earlier simulation snapshot: the experiment, time, or lesson has changed. This explanation refers to the submitted state, not the current state.</p>}
    {error && <div role="alert"><p>{error}</p><button disabled={loading} onClick={() => void submit()}>Retry with current snapshot</button></div>}
    {result && <article className="tutor-result" aria-label="AI explanation" aria-live="polite">
      <h3>Explanation</h3><p className="submitted-question">Question: {result.request.question}</p><p className="tutor-answer">{result.explanation.answer}</p>
      <h4>Key concepts</h4><ul>{result.explanation.key_concepts.map((concept, index) => <li key={index}>{concept}</li>)}</ul>
      <h4>Related equations</h4><ul>{result.explanation.related_equations.map((equation, index) => <li key={index}>{equation}</li>)}</ul>
    </article>}
    </>}
  </section>;
}
