import { test, expect } from '@playwright/test';
import type { TutorRequest } from '../src/services/tutor';
const result = { answer: 'A negative charge experiences force opposite to the field. Fy = -4e-7 N, ay = -0.4 m/s².', key_concepts: ['Electric Force', 'Acceleration'], related_equations: ['F = qE', 'a = F/m'] };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', service: 'vibelearning-api' } }));
  await page.goto('/');
});
test('tutor is visible and suggested question selection does not submit', async ({ page }) => {
  const panel = page.getByRole('region', { name: 'AI Tutor', exact: true });
  await expect(panel.getByRole('heading', { name: 'AI Tutor', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'What happens if I double the electric field?', exact: true }).click();
  await expect(page.getByLabel('Your physics question')).toHaveValue('What happens if I double the electric field?');
  await expect(page.getByRole('button', { name: 'Ask AI Tutor', exact: true })).toBeEnabled();
  await expect(page.getByRole('article', { name: 'AI explanation' })).toHaveCount(0);
});
test('successful API response is associated with its submitted context', async ({ page }) => {
  let received!: TutorRequest;
  await page.route('**/api/ai/explain', async route => { received = route.request().postDataJSON(); await route.fulfill({ json: result }); });
  await page.getByLabel('Your physics question').fill('为什么粒子向下加速？');
  await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click();
  await expect(page.getByRole('article', { name: 'AI explanation' })).toContainText(result.answer);
  expect(received.question).toBe('为什么粒子向下加速？');
  expect(received.simulation_context.schemaVersion).toBe(1);
  await expect(page.getByTestId('tutor-snapshot')).toContainText('t = 0.000 s');
});
test('failed API request displays safe error and supports retry', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/ai/explain', route => ++attempts === 1
    ? route.fulfill({ status: 504, json: { detail: { code: 'provider_timeout', message: 'upstream private detail' } } })
    : route.fulfill({ json: result }));
  await page.getByLabel('Your physics question').fill('Why does mass affect acceleration?');
  await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('timed out');
  await expect(page.getByRole('alert')).not.toContainText('private detail');
  await page.getByRole('button', { name: 'Retry with current snapshot', exact: true }).click();
  await expect(page.getByRole('article', { name: 'AI explanation' })).toContainText(result.answer);
  expect(attempts).toBe(2);
});
test('simulation remains responsive and earlier request is clearly marked', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let received!: TutorRequest;
  await page.route('**/api/ai/explain', async route => {
    received = route.request().postDataJSON(); await gate; await route.fulfill({ json: result });
  });
  await page.getByLabel('Your physics question').fill('Explain my current acceleration.');
  await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Asking…', exact: true })).toBeDisabled();
  await page.getByRole('region', { name: 'Experiment Presets', exact: true }).getByRole('button', { name: /^Negative Charge/ }).click();
  await page.getByRole('button', { name: '▶ 播放', exact: true }).click();
  await expect(page.getByTestId('simulation-time').locator('strong')).not.toHaveText('0.000 s');
  await expect(page.getByText(/Earlier simulation snapshot:/)).toBeVisible();
  release();
  await expect(page.getByRole('article', { name: 'AI explanation' })).toContainText(result.answer);
  expect(received.simulation_context.parameters.charge).toBe(2e-9);
  await expect(page.locator('#charge')).toHaveValue('-2');
  await expect(page.getByText(/Earlier simulation snapshot:/)).toBeVisible();
});


test('provider quota failure is clear and leaves simulation usable',async({page})=>{
  await page.route('**/api/ai/explain',route=>route.fulfill({status:429,json:{detail:{code:'provider_rate_limited',message:'private-provider-debug'}}}));
  await page.getByLabel('Your physics question').fill('Why does charge change the force?');
  await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('quota or rate limit');
  await expect(page.getByRole('alert')).not.toContainText('private-provider-debug');
  await page.getByRole('button',{name:'▶ 播放',exact:true}).click();
  await expect(page.getByTestId('simulation-time').locator('strong')).not.toHaveText('0.000 s');
});
