import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Always use 1 worker for MetaMask tests
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 180000, // 3 minutes global timeout
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
