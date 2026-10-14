import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', fullyParallel: true, workers: 2, retries: 0,
  timeout: 20000, expect: { timeout: 5000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5174', url: 'http://127.0.0.1:5174',
    reuseExistingServer: false, timeout: 30000,
  },
});
