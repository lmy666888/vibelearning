import { beforeEach, expect, it } from 'vitest';
import { useLearningStore as flow } from './learningStore';
import { useSimulationStore as simulation, defaults } from './simulationStore';
import { lessonFixture, feedbackFixture } from '../test/lessonFixture';
import { validateLesson, applyStep, validateFeedback } from '../services/learning';
import { capturePlanRequest } from '../services/actions';
beforeEach(()=>{flow.setState({session:{status:'idle'}});simulation.getState().updateParameters(defaults);});
function load(){const id=flow.getState().start();flow.getState().loaded(id,lessonFixture());}
function correct(){const s=flow.getState().session;if(!('plan'in s))throw new Error('No lesson');flow.getState().observe();flow.getState().answer('It accelerates as predicted.');const {token}=flow.getState().evaluating();flow.getState().feedback(token,feedbackFixture(s.plan,s.index));}
it('validates sequential +0.4,-0.4,-0.8 predictions from action calculations',()=>{
 const p=validateLesson(lessonFixture());expect(p.steps.map(s=>s.predicted_physics.acceleration.y)).toEqual([expect.closeTo(.4),expect.closeTo(-.4),expect.closeTo(-.8)]);expect(Object.isFrozen(p.steps[0].after.field)).toBe(true);
});
it('has controlled idle/generating/ready transitions and rejects stale generation tokens',()=>{
 expect(()=>flow.getState().preview()).toThrow();const id=flow.getState().start();flow.getState().loaded('old',lessonFixture());expect(flow.getState().session.status).toBe('generating');
 flow.getState().loaded(id,lessonFixture());expect(flow.getState().session.status).toBe('ready');expect(()=>flow.getState().start()).toThrow();expect(()=>flow.getState().next()).toThrow();expect(()=>flow.getState().select(2)).toThrow();
});
it('does not mutate on preview/cancel and confirms all actions in a single paused/reset update',()=>{
 load();const state=simulation.getState();flow.getState().preview();expect(simulation.getState()).toBe(state);flow.getState().cancelPreview();expect(simulation.getState()).toBe(state);
 flow.getState().preview();let updates=0;const unsub=simulation.subscribe(()=>updates++);flow.getState().confirm();unsub();expect(updates).toBe(1);expect(simulation.getState()).toMatchObject({status:'paused',time:0});expect(simulation.getState().parameters.field.y).toBe(200);expect(flow.getState().session.status).toBe('experimenting');
});
it('stale/ABA changes and invalid multi-action lessons never partially apply',()=>{
 load();flow.getState().preview();simulation.getState().updateParameters({...defaults,charge:-2e-9});simulation.getState().updateParameters(defaults);const state=simulation.getState();expect(()=>flow.getState().confirm()).toThrow(/Stale/);expect(simulation.getState()).toBe(state);
 const plan=structuredClone(lessonFixture());plan.steps[0].experiment_actions[1]={schema_version:1,action:'set_parameter',target:'mass',value:0};
 expect(()=>simulation.getState().confirmLessonStep(plan,0,capturePlanRequest('Apply.',simulation.getState()))).toThrow();expect(simulation.getState()).toBe(state);
});
it('records answers, allows retry, progresses to completion without a mastery claim',()=>{
 load();for(let i=0;i<3;i++){flow.getState().preview();flow.getState().confirm();correct();flow.getState().next();}
 const s=flow.getState().session;expect(s.status).toBe('completed');if('plan'in s)expect(s.progress).toEqual([0,1,2]);
});
it('incorrect feedback does not unlock the next step and supports retry',()=>{
 load();flow.getState().preview();flow.getState().confirm();flow.getState().observe();flow.getState().answer('The force is unrelated.');let {token}=flow.getState().evaluating();const p=lessonFixture();flow.getState().feedback(token,feedbackFixture(p,0,false));expect(()=>flow.getState().next()).toThrow();flow.getState().retryAnswer();expect(flow.getState().session.status).toBe('awaiting_observation');
});
it('returning to an earlier step restores validated parameters only after confirmation',()=>{
 load();flow.getState().preview();flow.getState().confirm();correct();flow.getState().next();flow.getState().preview();flow.getState().confirm();expect(simulation.getState().parameters.charge).toBe(-2e-9);
 flow.getState().select(0);expect(simulation.getState().parameters.charge).toBe(-2e-9);flow.getState().preview();flow.getState().confirm();expect(simulation.getState().parameters.charge).toBe(2e-9);
});
it('rejects late feedback if experiment was changed while evaluating',()=>{
 load();flow.getState().preview();flow.getState().confirm();flow.getState().observe();flow.getState().answer('Upward.');const {token}=flow.getState().evaluating();simulation.getState().reset();flow.getState().feedback(token,feedbackFixture(lessonFixture(),0));expect(flow.getState().session.status).toBe('error');flow.getState().recover();expect(flow.getState().session.status).toBe('ready');
});
it('restart/exit never change the experiment and discarded late responses cannot reactivate a lesson',()=>{
 load();const state=simulation.getState();flow.getState().restart();expect(simulation.getState()).toBe(state);flow.getState().exit();expect(simulation.getState()).toBe(state);flow.getState().loaded('old',lessonFixture());expect(flow.getState().session.status).toBe('cancelled');
});
it.each([p=>{p.schema_version=2;},p=>{p.steps[0].requires_confirmation=false;},p=>{p.steps[2].after.field.y=100;},p=>{p.steps[0].title='中文标题';},p=>{p.steps[0].experiment_actions.push(p.steps[0].experiment_actions[0]);} ] as ((p:any)=>void)[])('rejects malformed plans, language inconsistency and contradictory writes',change=>{const p=structuredClone(lessonFixture());change(p);expect(()=>validateLesson(p)).toThrow();});
it('rejects an invalid intermediate action even when a later action might restore validity',()=>{
 expect(()=>applyStep(defaults,[{schema_version:1,action:'set_parameter',target:'mass',value:0},{schema_version:1,action:'set_parameter',target:'mass',value:1e-6}])).toThrow();
});
it('validates feedback language, identity and authoritative numbers',()=>{
 const p=lessonFixture();for(const modified of [{...feedbackFixture(p,0),feedback:'中文反馈'}, {...feedbackFixture(p,0),step_id:'step-5'}, {...feedbackFixture(p,0),assessment:'incorrect'},{...feedbackFixture(p,0),authoritative_physics:{...p.steps[0].predicted_physics,acceleration_magnitude:999}}])expect(()=>validateFeedback(modified,p,0)).toThrow();
});
it('respects an explicit retry recommendation even when assessment is correct',()=>{
 load();flow.getState().preview();flow.getState().confirm();flow.getState().observe();flow.getState().answer('Upward.');const {token}=flow.getState().evaluating();flow.getState().feedback(token,{...feedbackFixture(lessonFixture(),0),next_action:'retry'});
 expect(()=>flow.getState().next()).toThrow();expect(()=>flow.getState().select(1)).toThrow();
});
