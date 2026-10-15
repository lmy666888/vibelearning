// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AITutorPanel, suggestedQuestions } from './AITutorPanel';
import { useSimulationStore, defaults } from '../../stores/simulationStore';

const answer = { answer: 'The force is opposite to the upward field because the charge is negative.', key_concepts: ['Electric Force'], related_equations: ['F = qE'] };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function enterQuestion(question = 'Why is my particle accelerating downward?') {
  fireEvent.change(screen.getByLabelText('Your physics question'), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI Tutor' }));
}
beforeEach(() => {
  useSimulationStore.setState({ parameters: defaults, time: 0, status: 'paused', activePresetId: null, currentLessonStepId: 'observe-positive' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('context-aware tutor form', () => {
  it('selects a suggestion without sending a request', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); render(<AITutorPanel />);
    fireEvent.click(screen.getByRole('button', { name: suggestedQuestions[0] }));
    expect((screen.getByLabelText('Your physics question') as HTMLTextAreaElement).value).toBe(suggestedQuestions[0]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('submits an immutable context snapshot, loads, and renders a validated response', async () => {
    const response = deferred<Response>();
    const fetch = vi.fn((_url: string, _init: RequestInit) => response.promise); vi.stubGlobal('fetch', fetch); render(<AITutorPanel />);
    enterQuestion('为什么粒子向下加速？');
    expect(screen.getByRole('button', { name: 'Asking…' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Generating');
    const payload = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(payload.question).toBe('为什么粒子向下加速？');
    expect(payload.simulation_context.schemaVersion).toBe(1);
    act(() => useSimulationStore.getState().applyPreset('negative-charge'));
    expect(payload.simulation_context.parameters.charge).toBe(2e-9);
    await act(async () => response.resolve(new Response(JSON.stringify(answer))));
    expect(await screen.findByRole('article', { name: 'AI explanation' })).toBeTruthy();
    expect(screen.getByText(answer.answer)).toBeTruthy();
    expect(screen.getByText('F = qE')).toBeTruthy();
    expect(screen.getByText(/Earlier simulation snapshot:/)).toBeTruthy();
  });
  it('avoids duplicate submissions and permits playback while pending', async () => {
    const response = deferred<Response>(); const fetch = vi.fn((_url: string, _init: RequestInit) => response.promise); vi.stubGlobal('fetch', fetch);
    render(<AITutorPanel />); enterQuestion();
    fireEvent.submit(screen.getByLabelText('Your physics question').closest('form')!);
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => { useSimulationStore.getState().play(); useSimulationStore.getState().advance(0.03); });
    expect(useSimulationStore.getState().time).toBeCloseTo(0.03);
    await act(async () => response.resolve(new Response(JSON.stringify(answer))));
    expect(await screen.findByText(/Earlier simulation snapshot:/)).toBeTruthy();
  });
  it('displays safe API errors and retries with current snapshot', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ detail: { code: 'provider_timeout', message: 'private-debug' } }), { status: 504 })).mockResolvedValueOnce(new Response(JSON.stringify(answer)));
    vi.stubGlobal('fetch', fetch); render(<AITutorPanel />); enterQuestion();
    const error = await screen.findByRole('alert'); expect(error.textContent).toContain('timed out'); expect(error.textContent).not.toContain('private-debug');
    act(() => useSimulationStore.getState().applyPreset('negative-charge'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry with current snapshot' }));
    await screen.findByText(answer.answer);
    expect(JSON.parse(fetch.mock.calls[1][1].body).simulation_context.parameters.charge).toBe(-2e-9);
  });
  it('reports a transport failure and rejects malformed response content', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('private-transport-debug')).mockResolvedValueOnce(new Response(JSON.stringify({ answer: '<script>bad</script>' })));
    vi.stubGlobal('fetch', fetch); render(<AITutorPanel />); enterQuestion();
    expect((await screen.findByRole('alert')).textContent).toContain('unreachable');
    expect(screen.queryByText(/private-transport-debug/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry with current snapshot' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('invalid response'));
    expect(screen.queryByRole('article')).toBeNull();
  });
  it('aborts pending work when unmounted', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url, init) => { signal = init.signal; return new Promise(() => {}); }));
    const { unmount } = render(<AITutorPanel />); enterQuestion(); unmount();
    expect(signal?.aborted).toBe(true);
  });
});
