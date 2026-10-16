import type {Page} from '@playwright/test';
import {experiment} from '../src/experiments/registry';
import {applyActions,preview,type Action} from '../src/experiments/actions';
import {platformLesson,platformFeedback} from '../src/test/platformFixture';
export async function scientificAI(page:Page,action:(id:string)=>Action){
 await page.route('**/api/v2/ai/explain',r=>r.fulfill({json:{answer:'The observation follows the verified scientific model and its stated assumptions.',key_concepts:['Scientific model'],related_equations:[]}}));
 await page.route('**/api/v2/ai/plan-action',r=>{const c=r.request().postDataJSON().context,e=experiment(c.experiment_id),a=action(e.id),after=applyActions(e,c.parameters,[a]);return r.fulfill({json:{status:'proposal',action:a,explanation:'Review the validated parameter change.',experiment_id:e.id,experiment_version:e.version,before:c.parameters,after,before_observables:c.observables,after_observables:preview(e,after),snapshot_id:c.snapshot_id,revision:c.revision,requires_confirmation:true}});});
 await page.route('**/api/v2/ai/generate-lesson',r=>{const c=r.request().postDataJSON().context;return r.fulfill({json:platformLesson(c.experiment_id,c.parameters)});});
 await page.route('**/api/v2/ai/evaluate-observation',r=>{const b=r.request().postDataJSON();return r.fulfill({json:platformFeedback(b.context,b.lesson,b.step_id)});});
}
