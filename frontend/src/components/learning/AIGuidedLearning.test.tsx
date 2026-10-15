// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { AIGuidedLearning } from './AIGuidedLearning';
import { useLearningStore as flow } from '../../stores/learningStore';
import { useSimulationStore as simulation, defaults } from '../../stores/simulationStore';
import { useLanguageStore } from '../../stores/languageStore';
import { lessonFixture,feedbackFixture } from '../../test/lessonFixture';
beforeEach(()=>{flow.setState({session:{status:'idle'}});simulation.getState().updateParameters(defaults);useLanguageStore.getState().setLanguage('en');});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function generate(){fireEvent.change(screen.getByLabelText('Learning goal'),{target:{value:'Teach me charge polarity.'}});fireEvent.click(screen.getByRole('button',{name:'Generate lesson'}));}
it('generates a lesson, previews, cancels without changes and explicitly confirms',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(lessonFixture()))));render(<AIGuidedLearning/>);generate();
 await screen.findByText('Explore electric force');fireEvent.click(screen.getByRole('button',{name:'Preview step setup'}));
 expect(screen.getByRole('article',{name:'Lesson step proposal'}).textContent).toContain('+0.4000');expect(simulation.getState().parameters.field.y).toBe(100);
 fireEvent.click(screen.getByRole('button',{name:'Cancel step changes'}));expect(simulation.getState().parameters.field.y).toBe(100);
 fireEvent.click(screen.getByRole('button',{name:'Preview step setup'}));fireEvent.click(screen.getByRole('button',{name:'Confirm step setup'}));expect(simulation.getState().parameters.field.y).toBe(200);
});
it('renders feedback and supports observation retry',async()=>{
 const p=lessonFixture();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(p))).mockResolvedValueOnce(new Response(JSON.stringify(feedbackFixture(p,0,false)))));
 render(<AIGuidedLearning/>);generate();await screen.findByText('Explore electric force');
 fireEvent.click(screen.getByRole('button',{name:'Preview step setup'}));fireEvent.click(screen.getByRole('button',{name:'Confirm step setup'}));fireEvent.click(screen.getByRole('button',{name:'Finish observing'}));
 fireEvent.change(screen.getByLabelText('Student observation answer'),{target:{value:'It moves down.'}});fireEvent.click(screen.getByRole('button',{name:'Submit observation'}));
 expect((await screen.findByRole('article',{name:'Observation feedback'})).textContent).toContain('incorrect');expect(screen.queryByRole('button',{name:'Next lesson step'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Retry observation'}));expect(screen.getByLabelText('Student observation answer')).toBeTruthy();
});
it('disables stale confirmation and shows manual edit protection',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(lessonFixture()))));render(<AIGuidedLearning/>);generate();await screen.findByText('Explore electric force');fireEvent.click(screen.getByRole('button',{name:'Preview step setup'}));
 act(()=>simulation.getState().reset());expect(screen.getByRole('button',{name:'Confirm step setup'}).hasAttribute('disabled')).toBe(true);expect(screen.getByText(/Stale lesson preview/)).toBeTruthy();
});
it('shows safe language failure without claiming a lesson exists',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({detail:{code:'language_mismatch',message:'private-debug'}}),{status:502})));render(<AIGuidedLearning/>);generate();expect((await screen.findByRole('alert')).textContent).toContain('language preference');expect(screen.queryByText(/private-debug/)).toBeNull();
});
it('generation is visibly pending, playback works, and unmount aborts the request',()=>{
 let signal:AbortSignal|undefined;vi.stubGlobal('fetch',vi.fn((_u,init)=>{signal=init.signal;return new Promise(()=>{});}));const view=render(<AIGuidedLearning/>);generate();expect(screen.getByText(/Generating a bounded lesson/)).toBeTruthy();act(()=>{simulation.getState().play();simulation.getState().advance(.03);});expect(simulation.getState().time).toBeCloseTo(.03);view.unmount();expect(signal?.aborted).toBe(true);expect(flow.getState().session.status).toBe('error');
});
