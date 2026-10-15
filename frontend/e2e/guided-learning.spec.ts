import { test,expect } from '@playwright/test';
import { lessonFixture,feedbackFixture } from '../src/test/lessonFixture';
test.beforeEach(async({page})=>{
 await page.route('**/api/health',r=>r.fulfill({json:{status:'ok',service:'vibelearning-api'}}));
 await page.route('**/api/ai/generate-lesson',r=>r.fulfill({json:lessonFixture(r.request().postDataJSON().simulation_context.parameters)}));
 await page.route('**/api/ai/evaluate-observation',r=>{const body=r.request().postDataJSON();return r.fulfill({json:feedbackFixture(body.lesson,Number(body.step_id.split('-')[1])-1)});});
 await page.goto('/');await page.getByRole('button',{name:'Guided Learning',exact:true}).click();
 await page.getByLabel('Learning goal',{exact:true}).fill('Teach me why positive and negative charges accelerate in opposite directions.');
 await page.getByRole('button',{name:'Generate lesson',exact:true}).click();await expect(page.getByRole('heading',{name:'Explore electric force',exact:true})).toBeVisible();
});
async function confirm(page:import('@playwright/test').Page){await page.getByRole('button',{name:'Preview step setup',exact:true}).click();await page.getByRole('button',{name:'Confirm step setup',exact:true}).click();}
async function observe(page:import('@playwright/test').Page){await page.getByRole('button',{name:'▶ 播放',exact:true}).click();await expect(page.getByTestId('simulation-time').locator('strong')).not.toHaveText('0.000 s');await page.getByRole('button',{name:'Finish observing',exact:true}).click();await page.getByLabel('Student observation answer',{exact:true}).fill('The signed acceleration matches the predicted force direction.');await page.getByRole('button',{name:'Submit observation',exact:true}).click();await expect(page.getByRole('article',{name:'Observation feedback',exact:true})).toContainText('correct');}
test('three-step lesson previews, confirms, observes, cancels a later step and completes; free experiment still works',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'Preview step setup',exact:true}).click();await expect(page.getByRole('article',{name:'Lesson step proposal',exact:true})).toContainText('+0.4000');await expect(page.locator('#ey')).toHaveValue('100');
 await page.getByRole('button',{name:'Confirm step setup',exact:true}).click();await expect(page.locator('#ey')).toHaveValue('200');await observe(page);await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
 await page.getByRole('button',{name:'Preview step setup',exact:true}).click();await page.getByRole('button',{name:'Cancel step changes',exact:true}).click();await expect(page.locator('#charge')).toHaveValue('2');await expect(page.getByText('Step changes cancelled. Experiment unchanged.',{exact:true})).toBeVisible();
 await confirm(page);await expect(page.locator('#charge')).toHaveValue('-2');await observe(page);await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
 await confirm(page);await expect(page.locator('#ey')).toHaveValue('400');await observe(page);await page.getByRole('button',{name:'Complete lesson',exact:true}).click();await expect(page.getByText(/Lesson completed./)).toBeVisible();
 await page.getByRole('button',{name:'Free Experiment',exact:true}).click();await page.locator('#charge').fill('3');await expect(page.locator('#charge')).toHaveValue('3');expect(errors).toEqual([]);
});
test('stale previews fail, earlier-step rollback needs confirmation, and no manual edit is silently overwritten',async({page})=>{
 await page.getByRole('button',{name:'Preview step setup',exact:true}).click();await page.locator('#mass').fill('2');await expect(page.getByRole('button',{name:'Confirm step setup',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Cancel step changes',exact:true}).click();
 await confirm(page);await expect(page.locator('#mass')).toHaveValue('1');await observe(page);await page.getByRole('button',{name:'Next lesson step',exact:true}).click();await confirm(page);await expect(page.locator('#charge')).toHaveValue('-2');
 await page.getByRole('button',{name:'Previous lesson step',exact:true}).click();await expect(page.locator('#charge')).toHaveValue('-2');await confirm(page);await expect(page.locator('#charge')).toHaveValue('2');await expect(page.locator('#ey')).toHaveValue('200');
});
