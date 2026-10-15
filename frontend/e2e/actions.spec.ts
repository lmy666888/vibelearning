import { test, expect } from '@playwright/test';
import { proposalFor } from '../src/test/actionFixture';
import type { PlanRequest } from '../src/services/actions';
test.beforeEach(async ({page}) => {
  await page.route('**/api/health',route=>route.fulfill({json:{status:'ok',service:'vibelearning-api'}}));
  await page.goto('/');
});
async function submit(page: import('@playwright/test').Page) {
  await page.getByRole('button',{name:'Request an experiment change',exact:true}).click();
  await page.getByLabel('Experiment change instruction').fill('Double the vertical electric field.');
  await page.getByRole('button',{name:'Preview experiment change',exact:true}).click();
}
test('proposal previews without mutation, confirm applies and resets a running experiment',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/ai/plan-action',route=>route.fulfill({json:proposalFor(route.request().postDataJSON() as PlanRequest)}));
  await submit(page);
  const card=page.getByRole('article',{name:'AI action proposal'});
  await expect(card).toContainText('Confirmation required');
  await expect(card).toContainText('+0.2000');await expect(card).toContainText('+0.4000');
  await expect(page.locator('#ey')).toHaveValue('100');
  await page.getByRole('button',{name:'▶ 播放',exact:true}).click();
  await expect(page.getByTestId('simulation-time').locator('strong')).not.toHaveText('0.000 s');
  await card.getByRole('button',{name:'Confirm experiment change',exact:true}).click();
  await expect(page.locator('#ey')).toHaveValue('200');
  await expect(page.getByTestId('simulation-time').locator('strong')).toHaveText('0.000 s');
  await expect(page.getByRole('button',{name:'▶ 播放',exact:true})).toBeVisible();
  await expect(page.getByText(/Experiment updated/)).toBeVisible();
  expect(errors).toEqual([]);
});
test('cancel leaves experiment unchanged',async({page})=>{
  await page.route('**/api/ai/plan-action',route=>route.fulfill({json:proposalFor(route.request().postDataJSON())}));
  await submit(page);await page.getByRole('button',{name:'Cancel proposal',exact:true}).click();
  await expect(page.locator('#ey')).toHaveValue('100');await expect(page.getByText(/Proposal cancelled/)).toBeVisible();
  await expect(page.getByRole('article',{name:'AI action proposal'})).toHaveCount(0);
});
test('parameter edit then revert makes proposal stale',async({page})=>{
  await page.route('**/api/ai/plan-action',route=>route.fulfill({json:proposalFor(route.request().postDataJSON())}));
  await submit(page);await expect(page.getByRole('article',{name:'AI action proposal'})).toBeVisible();
  await page.locator('#charge').fill('-2');await page.locator('#charge').fill('2');
  await expect(page.getByText(/Stale proposal:/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirm experiment change',exact:true})).toBeDisabled();
  await expect(page.locator('#ey')).toHaveValue('100');
});
test('late proposal cannot apply after parameters change during planning; playback stays responsive',async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/ai/plan-action',async route=>{const data=route.request().postDataJSON();await gate;await route.fulfill({json:proposalFor(data)});});
  await submit(page);await expect(page.getByRole('button',{name:'Planning…',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'▶ 播放',exact:true}).click();
  await expect(page.getByTestId('simulation-time').locator('strong')).not.toHaveText('0.000 s');
  await page.locator('#ey').fill('150');release();
  await expect(page.getByText(/Stale proposal:/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirm experiment change',exact:true})).toBeDisabled();
});
test('clarification and safe provider error preserve state',async({page})=>{
  let attempts=0;
  await page.route('**/api/ai/plan-action',route=>++attempts===1?route.fulfill({json:{status:'clarification_needed',explanation:'Which component and amount?'}}):route.fulfill({status:502,json:{detail:{code:'provider_error',message:'private-debug'}}}));
  await submit(page);await expect(page.getByText(/Clarification needed:/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirm experiment change',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Preview experiment change',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.getByRole('alert')).not.toContainText('private-debug');
  await expect(page.locator('#ey')).toHaveValue('100');
});
