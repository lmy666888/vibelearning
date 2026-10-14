import { test, expect, type Page } from '@playwright/test';

const presets = (page: Page) => page.getByRole('region', { name: 'Experiment Presets', exact: true });
const lesson = (page: Page) => page.getByRole('region', { name: 'Understanding Electric Force', exact: true });
const time = (page: Page) => page.getByTestId('simulation-time').locator('strong');
const acceleration = (page: Page) => page.getByTestId('simulation-acceleration').locator('strong');
const selectPreset = async (page: Page, name: string) => {
  await presets(page).getByRole('button', { name, exact: false }).click();
};

test.beforeEach(async ({ page }) => {
  // Isolate pedagogy and physics tests from local backend availability.
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', service: 'vibelearning-api' } }));
  await page.goto('/');
});

test('application loads with existing controls and an explicitly unavailable AI tutor', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '二维匀强电场' })).toBeVisible();
  for (const id of ['charge', 'mass', 'ex', 'ey', 'vx', 'vy']) await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.getByRole('button', { name: '▶ 播放', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '↺ 重置', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI Tutor — Coming Soon' })).toBeVisible();
});

for (const [name, charge, field, ay] of [
  ['Positive Charge', '2', '100', '0.000, 0.200'],
  ['Negative Charge', '-2', '100', '0.000, -0.200'],
  ['Stronger Electric Field', '2', '200', '0.000, 0.400'],
  ['No Electric Field', '2', '0', '0.000, 0.000'],
]) {
  test(`${name} applies parameters and resets a running experiment`, async ({ page }) => {
    await page.getByRole('button', { name: '▶ 播放', exact: true }).click();
    await expect(time(page)).not.toHaveText('0.000 s');
    await selectPreset(page, name);
    await expect(page.locator('#charge')).toHaveValue(charge);
    await expect(page.locator('#ey')).toHaveValue(field);
    await expect(acceleration(page)).toHaveText(ay);
    await expect(time(page)).toHaveText('0.000 s');
    await expect(page.getByRole('button', { name: '▶ 播放', exact: true })).toBeVisible();
    await expect(presets(page).getByRole('button', { name: new RegExp(`^${name}`) })).toHaveAttribute('aria-pressed', 'true');
  });
}

test('play, pause, resume and reset retain correct time semantics', async ({ page }) => {
  await page.getByRole('button', { name: '▶ 播放', exact: true }).click();
  await expect(time(page)).not.toHaveText('0.000 s');
  await page.getByRole('button', { name: 'Ⅱ 暂停', exact: true }).click();
  await expect(page.getByTestId('simulation-time')).toContainText('已暂停');
  const paused = await time(page).innerText();
  // Assertions on other UI interactions replace arbitrary sleep-based timing checks.
  await page.getByRole('button', { name: 'Save baseline', exact: true }).click();
  await expect(time(page)).toHaveText(paused);
  await page.getByRole('button', { name: '▶ 播放', exact: true }).click();
  await expect(time(page)).not.toHaveText(paused);
  await page.getByRole('button', { name: '↺ 重置', exact: true }).click();
  await expect(time(page)).toHaveText('0.000 s');
});

test('baseline comparison updates with edits and stays fixed during animation', async ({ page }) => {
  await selectPreset(page, 'Positive Charge');
  await page.getByRole('button', { name: 'Save baseline', exact: true }).click();
  await expect(page.getByText('Baseline saved.', { exact: false })).toBeVisible();
  await page.locator('#ey').fill('200');
  const ay = page.getByTestId('comparison-ay');
  await expect(ay).toContainText('0.200'); await expect(ay).toContainText('0.400');
  await expect(ay).toContainText('+100.000%');
  await expect(page.getByTestId('comparison-ex')).toContainText('N/A — zero baseline');
  await expect(presets(page).getByRole('button', { pressed: true })).toHaveCount(0);
  const rows = (await page.getByRole('table').textContent())!;
  await page.getByRole('button', { name: '▶ 播放', exact: true }).click();
  await expect(time(page)).not.toHaveText('0.000 s');
  await expect(page.getByRole('table')).toHaveText(rows);
  await page.getByRole('button', { name: 'Clear baseline', exact: true }).click();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('lesson navigation preserves custom parameters until applying a suggested preset', async ({ page }) => {
  const panel = lesson(page);
  await expect(panel.getByRole('button', { name: 'Previous step', exact: true })).toBeDisabled();
  await page.locator('#ey').fill('150');
  await panel.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Reverse the charge', exact: true })).toBeVisible();
  await expect(page.locator('#ey')).toHaveValue('150');
  await panel.getByRole('button', { name: 'Apply suggested preset: Negative Charge', exact: true }).click();
  await expect(page.locator('#charge')).toHaveValue('-2');
  await expect(acceleration(page)).toHaveText('0.000, -0.200');
  await panel.getByRole('button', { name: 'Previous step', exact: true }).click();
  await expect(page.locator('#charge')).toHaveValue('-2');
  await panel.getByRole('button', { name: 'Next step', exact: true }).click();
  await panel.getByRole('button', { name: 'Next step', exact: true }).click();
  await panel.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Next step', exact: true })).toBeDisabled();
  await expect(panel.getByRole('heading', { name: 'Explain why acceleration changes', exact: true })).toBeVisible();
});

test('negative component reversal differs from acceleration magnitude', async ({ page }) => {
  await selectPreset(page, 'Negative Charge');
  await page.getByRole('button', { name: 'Save baseline', exact: true }).click();
  await selectPreset(page, 'Positive Charge');
  await expect(page.getByTestId('comparison-ay')).toContainText('+200.000%');
  await expect(page.getByTestId('comparison-acceleration-magnitude')).toContainText('0.000%');
});

test('invalid mass is rejected and selecting a preset clears its error', async ({ page }) => {
  await page.locator('#mass').fill('0');
  await expect(page.locator('#mass')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toBeVisible();
  await selectPreset(page, 'Positive Charge');
  await expect(page.locator('#mass')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('canvas responds to resizing and retina density without horizontal page overflow', async ({ page, browser }) => {
  for (const width of [1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator('canvas').evaluate(canvas => {
      const node = canvas as HTMLCanvasElement;
      return Math.abs(node.width - Math.round(node.getBoundingClientRect().width * devicePixelRatio)) <= 1;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const retina = await browser.newContext({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 2 });
  try {
    const p = await retina.newPage();
    await p.route('**/api/health', route => route.fulfill({ json: { status: 'ok', service: 'vibelearning-api' } }));
    await p.goto('/');
    await expect.poll(() => p.locator('canvas').evaluate(canvas => {
      const node = canvas as HTMLCanvasElement;
      return Math.abs(node.width - Math.round(node.getBoundingClientRect().width * 2)) <= 1;
    })).toBe(true);
  } finally { await retina.close(); }
});

test('backend unavailable does not stop the simulation', async ({ page }) => {
  await page.unroute('**/api/health');
  await page.route('**/api/health', route => route.abort('connectionrefused'));
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'API 离线' })).toBeVisible();
  await page.getByRole('button', { name: '▶ 播放', exact: true }).click();
  await expect(time(page)).not.toHaveText('0.000 s');
});


test('numeric draft supports keyboard entry of negative charge', async ({ page }) => {
  const charge = page.locator('#charge');
  await charge.fill('');
  await charge.pressSequentially('-2');
  await expect(charge).toHaveValue('-2');
  await expect(charge).toHaveAttribute('aria-invalid', 'false');
  await expect(acceleration(page)).toHaveText('0.000, -0.200');
});

test('canvas follows DPR changes without a CSS dimension change', async ({ page }) => {
  const canvas = page.locator('canvas');
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  const viewport = page.viewportSize()!;
  const session = await page.context().newCDPSession(page);
  try {
    for (const factor of [2, 1.5, 1]) {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: factor, mobile: false,
      });
      await expect.poll(() => canvas.evaluate((element, expected) => {
        const c = element as HTMLCanvasElement;
        return Math.abs(devicePixelRatio - expected) < 0.01 &&
          Math.abs(c.width - Math.round(c.getBoundingClientRect().width * expected)) <= 1;
      }, factor)).toBe(true);
      expect((await canvas.boundingBox())!.width).toBeCloseTo(rect!.width, 0);
    }
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride');
    await session.detach();
  }
});
