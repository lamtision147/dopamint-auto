import { test, expect } from '@playwright/test';

test.describe('Example Tests', () => {
  test('should have correct title', async ({ page }) => {
    await page.goto('https://playwright.dev/');
    await expect(page).toHaveTitle(/Playwright/);
  });

  test('should navigate to docs page', async ({ page }) => {
    await page.goto('https://playwright.dev/');
    await page.getByRole('link', { name: 'Get started' }).click();
    await expect(page).toHaveURL(/.*intro/);
  });

  test('should search documentation', async ({ page }) => {
    await page.goto('https://playwright.dev/');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByPlaceholder('Search docs').fill('locator');
    await expect(page.getByRole('listbox').first()).toBeVisible();
  });
});
