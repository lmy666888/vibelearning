import {AIUsageFeedback} from '../ai/AIUsageFeedback';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLearningStore } from '../../stores/learningStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { useLanguageStore } from '../../stores/languageStore';
import { capturePlanRequest, planIsCurrent, same } from '../../services/actions';
import { generateLesson, evaluateObservation } from '../../services/learning';
import { PhysicsPreviewTable } from '../ai/PhysicsPreviewTable';
export function AIGuidedLearning(){
  const s=useLearningStore(v=>v.session), flow=useLearningStore.getState();
  const revision=useSimulationStore(v=>v.parameterRevision),language=useLanguageStore(v=>v.language);
  const [goal,setGoal]=useState(''),[notice,setNotice]=useState('');
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>{pending.current?.abort();pending.current=null;const current=useLearningStore.getState().session;if(current.status==='generating'||current.status==='evaluating')useLearningStore.getState().fail('Request cancelled when leaving guided learning. Retry when ready.');},[]);
  async function generate(event:FormEvent){event.preventDefault();if(pending.current)return;
    let request;try{request=capturePlanRequest(goal,useSimulationStore.getState());}catch{setNotice('Enter a learning goal between 1 and 2000 characters.');return;}
    const token=flow.start(),controller=new AbortController();pending.current=controller;setNotice('');
    try{const result=await generateLesson(goal,language,request,controller.signal);if(pending.current!==controller||controller.signal.aborted)return;
      if(result.status==='unsupported_capability')flow.fail(result.reason);else flow.loaded(token,result);
    }catch(error){if(pending.current===controller&&!controller.signal.aborted)flow.fail(error instanceof Error?error.message:'Lesson generation failed.');}
    finally{if(pending.current===controller)pending.current=null;}
  }
  function perform(action:()=>void){try{setNotice('');action();}catch(error){setNotice((error as Error).message);}}
  async function evaluate(){if(pending.current||s.status!=='awaiting_observation')return;
    try{const {token,request}=flow.evaluating(),controller=new AbortController();pending.current=controller;
      try{const value=await evaluateObservation(s.plan,s.index,s.answers[s.plan.steps[s.index].step_id],request,controller.signal);
        if(pending.current===controller&&!controller.signal.aborted)flow.feedback(token,value);
      }catch(error){if(pending.current===controller&&!controller.signal.aborted)flow.fail(error instanceof Error?error.message:'Feedback failed.');}
      finally{if(pending.current===controller)pending.current=null;}
    }catch(error){setNotice((error as Error).message);}
  }
  const active='plan'in s,step=active?s.plan.steps[s.index]:null;
  const busy=s.status==='generating'||s.status==='evaluating';
  const stale=active&&s.appliedRevision!==null&&s.appliedRevision!==revision;
  const previewStale=s.status==='awaiting_confirmation'&&!planIsCurrent(s.request,useSimulationStore.getState());
  return <section className="panel learning-panel ai-guided" aria-label="AI Guided Learning"><AIUsageFeedback/>
    <span className="eyebrow">AI-GUIDED LEARNING · HUMAN-CONFIRMED EXPERIMENTS</span><h2>Guided Learning</h2>
    <p>One step at a time. Physics readings are deterministic; generated guidance can be mistaken. Your progress describes this session, not mastery.</p>
    {(!active&&s.status!=='generating'&&s.status!=='error')&&<form onSubmit={generate}><label htmlFor="learning-goal">Learning goal</label><textarea id="learning-goal" rows={3} value={goal} maxLength={2000} onChange={e=>setGoal(e.target.value)} placeholder="Teach me why positive and negative charges accelerate in opposite directions."/><button className="primary" disabled={!goal.trim()} type="submit">Generate lesson</button></form>}
    {s.status==='generating'&&<p role="status">Generating a bounded lesson… Simulation remains available.</p>}
    {s.status==='error'&&<div role="alert"><p>{s.message}</p><button onClick={flow.recover}>Return and retry</button></div>}
    {active&&step&&<>
      <h3>{s.plan.title}</h3><p>Lesson language: {s.plan.language} · Step {s.index+1} of {s.plan.steps.length}</p>
      {s.plan.language!==language&&<p role="status">Existing lesson keeps its original language. Exit and generate a new lesson to use the new preference.</p>}
      <ul>{s.plan.learning_objectives.map(t=><li key={t}>{t}</li>)}</ul>
      <ol className="lesson-stepper">{s.plan.steps.map((item,i)=><li key={item.step_id}><button disabled={busy||s.status==='awaiting_confirmation'||i>0&&!s.progress.includes(i-1)} aria-current={s.index===i?'step':undefined} onClick={()=>perform(()=>flow.select(i))}>{s.progress.includes(i)?'✓ ':''}{item.title}</button></li>)}</ol>
      <h3>{step.title}</h3><p><strong>Objective:</strong> {step.objective}</p><p>{step.expected_behavior}</p>
      <p>Completion: submit an observation and receive a correct assessment; you can retry.</p>
      {stale&&<p role="status" className="stale-notice">Experiment changed. Preview and confirm this step again before observing or continuing.</p>}
      {['ready','experimenting','awaiting_observation','feedback'].includes(s.status)&&<button onClick={()=>perform(flow.preview)}>Preview step setup</button>}
      {s.status==='awaiting_confirmation'&&<article aria-label="Lesson step proposal"><p>Review all {step.experiment_actions.length} action(s). Nothing changes before confirmation.</p>
        {!same(s.request.simulation_context.parameters,step.before)&&<p>Current parameters differ from the planned starting state. Confirming restores the validated setup shown below.</p>}
        <PhysicsPreviewTable before={s.request.simulation_context.parameters} after={step.after}/>
        <p>Confirmation required. Applies all changes together, pauses playback and resets time/trajectory to zero.</p>
        {previewStale&&<p role="status" className="stale-notice">Stale lesson preview. Cancel and preview again.</p>}
        <div className="buttons"><button className="primary" disabled={previewStale} onClick={()=>perform(flow.confirm)}>Confirm step setup</button><button onClick={()=>{perform(flow.cancelPreview);setNotice('Step changes cancelled. Experiment unchanged.');}}>Cancel step changes</button></div>
      </article>}
      {s.status==='experimenting'&&<><p role="status">Setup applied. Use Play/Pause to observe the existing simulation.</p><button disabled={stale} onClick={()=>perform(flow.observe)}>Finish observing</button></>}
      {s.status==='awaiting_observation'&&<form onSubmit={e=>{e.preventDefault();void evaluate();}}><label htmlFor="observation-answer">{step.observation_question}</label><textarea id="observation-answer" aria-label="Student observation answer" rows={3} maxLength={2000} value={s.answers[step.step_id]??''} onChange={e=>flow.answer(e.target.value)}/><button className="primary" disabled={stale||!s.answers[step.step_id]?.trim()} type="submit">Submit observation</button></form>}
      {s.status==='evaluating'&&<p role="status">Evaluating your observation against verified physics…</p>}
      {s.status==='feedback'&&<article aria-label="Observation feedback"><h3>{s.response.assessment}</h3><p>{s.response.feedback}</p><p>{s.response.explanation}</p>{s.response.hint&&<p>Hint: {s.response.hint}</p>}<p>{step.explanation}</p><button onClick={()=>perform(flow.retryAnswer)}>Retry observation</button>{s.response.assessment==='correct'&&s.response.next_action==='continue'&&<button className="primary" disabled={stale} onClick={()=>perform(flow.next)}>{s.index===s.plan.steps.length-1?'Complete lesson':'Next lesson step'}</button>}</article>}
      {s.status==='completed'&&<p role="status">Lesson completed. You explored the steps and answered observations; continue practicing to strengthen your understanding.</p>}
      <div className="buttons"><button disabled={busy||s.status==='awaiting_confirmation'||s.index===0} onClick={()=>perform(()=>flow.select(s.index-1))}>Previous lesson step</button><button disabled={busy||s.status==='awaiting_confirmation'} onClick={()=>perform(flow.restart)}>Restart lesson</button></div>
    </>}
    {s.status!=='idle'&&s.status!=='cancelled'&&<button onClick={()=>{pending.current?.abort();pending.current=null;flow.exit();setNotice('Lesson exited. Experiment unchanged.');}}>Exit lesson</button>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
