import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/example.spec.ts'], // Ignore example test file
  fullyParallel: true, // Enable full parallel execution across all test files
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 5, // 11 workers to run all tests in parallel (1 login + 5 create + 5 searchMintSell)
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 600000, // 10 minutes global timeout (increased for parallel execution with delays)
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on', // Always capture screenshots
    video: 'on-first-retry', // Record video on retry
  },
  outputDir: 'test-results/', // Ensure screenshots go to test-results

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment below to enable Firefox and Webkit (run: npx playwright install)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
