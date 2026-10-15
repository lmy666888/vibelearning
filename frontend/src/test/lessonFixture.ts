import { applyStep, type LessonPlan, type ObservationFeedback } from '../services/learning';
import { physicsPreview, type Action } from '../services/actions';
import { getPreset } from '../simulations/physics/uniform-electric-field/presets';
export function lessonFixture(initial=getPreset('positive-charge').parameters):LessonPlan{
  const actions:Action[][]=[[
    {schema_version:1,action:'set_parameter',target:'charge',value:2e-9},{schema_version:1,action:'set_parameter',target:'field.y',value:200}],
    [{schema_version:1,action:'set_parameter',target:'charge',value:-2e-9}],
    [{schema_version:1,action:'scale_parameter',target:'field.y',factor:2}]];
  let current=initial;
  return {schema_version:1,status:'lesson',lesson_id:'12345678-1234-1234-1234-123456789abc',language:'en',title:'Explore electric force',learning_objectives:['Compare charge polarity'],initial_parameters:initial,metadata:{provider_model:'mock-model',generated_at:'2026-10-14T23:00:00Z'},
    steps:actions.map((experiment_actions,i)=>{const before=current;current=applyStep(current,experiment_actions);return {
      step_id:`step-${i+1}`,title:`Experiment ${i+1}`,objective:'Observe acceleration direction.',experiment_actions,
      expected_behavior:'Compare the signed acceleration.',observation_question:'Which direction does the particle accelerate?',expected_concepts:['Electric force'],
      explanation:'Use F = qE and a = F/m.',completion_criteria:'submit_observation',before,after:current,predicted_physics:physicsPreview(current),requires_confirmation:true,
    };})};
}
export function feedbackFixture(plan:LessonPlan,index:number,correct=true):ObservationFeedback{
  return {assessment:correct?'correct':'incorrect',feedback:correct?'Your direction is correct.':'Compare force with the field again.',explanation:'The sign of charge determines the direction relative to the field.',hint:correct?null:'Use F = qE.',next_action:correct?'continue':'retry',lesson_id:plan.lesson_id,step_id:plan.steps[index].step_id,authoritative_physics:plan.steps[index].predicted_physics};
}
