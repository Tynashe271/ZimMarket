import { defineConfig, devices } from '@playwright/test';

// Browser-driven smoke tests against the running Next.js app.
// One-time setup: `npx playwright install chromium`
// Run with: `npm run test:e2e` (starts `next dev` automatically if it isn't already running)
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3006',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3006',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
