import { BrowserContext, test as baseTest, expect, Page, chromium } from "@playwright/test";
import { setupMetaMask } from '../dapp/metamaskSetup';
import { DopamintLoginPage } from '../pages/loginDopamint';
import dappwright, { Dappwright } from "@tenkeylabs/dappwright";
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.test
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Get output directory (spec-specific or default)
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

// Email for login
const LOGIN_EMAIL = process.env.GMAIL_EMAIL || 'vutesttran99@gmail.com';

// Google OAuth credentials
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL || 'vutesttran99@gmail.com';
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD || '';

// Delay between test cases (15 seconds) - Worker 0 starts immediately
const TEST_CASE_DELAY_MS = 15000;

// ============================================================
// Test with MetaMask (for Case 1)
// ============================================================
const testWithMetaMask = baseTest.extend<{
  context: BrowserContext;
  wallet: Dappwright;
}>({
  context: async ({}, use, testInfo) => {
    // Worker 0 starts immediately, others delay 10s each
    const delay = testInfo.parallelIndex * TEST_CASE_DELAY_MS;
    if (delay > 0) {
      console.log(`⏳ [Test Delay] Worker ${testInfo.parallelIndex}: Waiting ${delay / 1000}s before starting...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`✅ [Test Delay] Worker ${testInfo.parallelIndex}: Delay completed, starting test now...`);
    } else {
      console.log(`🚀 [Test Delay] Worker 0: Starting immediately (no delay)`);
    }

    // Each worker gets its own isolated MetaMask profile with delay between workers
    const workerIndex = testInfo.parallelIndex;
    const { wallet, context } = await setupMetaMask(workerIndex);
    await use(context);
    // Cleanup after test
    await context.close().catch(() => {});
  },

  wallet: async ({ context }, use) => {
    const metamask = await dappwright.getWallet("metamask", context);
    await use(metamask);
  },
});

// ============================================================
// Test without MetaMask (for Case 2 - Email Login)
// ============================================================
const testWithEmail = baseTest.extend<{
  context: BrowserContext;
}>({
  context: async ({}, use, testInfo) => {
    // Worker 0 starts immediately, others delay 10s each
    const delay = testInfo.parallelIndex * TEST_CASE_DELAY_MS;
    if (delay > 0) {
      console.log(`⏳ [Test Delay] Worker ${testInfo.parallelIndex}: Waiting ${delay / 1000}s before starting...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`✅ [Test Delay] Worker ${testInfo.parallelIndex}: Delay completed, starting test now...`);
    } else {
      console.log(`🚀 [Test Delay] Worker 0: Starting immediately (no delay)`);
    }

    // Launch browser without MetaMask extension
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    await use(context);
    // Cleanup
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  },
});

// ============================================================
// Test Cases
// ============================================================
testWithMetaMask.describe('Login with MetaMask', () => {
  testWithMetaMask.describe.configure({ timeout: 120000 });

  testWithMetaMask("Case 1: Login with MetaMask", async ({ wallet, page, context }) => {
    // Start login process
    const dopamintPage = new DopamintLoginPage(context, wallet);
    const dappPage = await dopamintPage.navigateAndLogin();
    await dopamintPage.closeAllPopups();
    await dopamintPage.loginWithMetaMask();
    await dopamintPage.verifyLoginButtonHidden();

    await dappPage.screenshot({ path: `${outputDir}/dopamint-metamask-connected.png` });
    console.log('\n✅ TEST COMPLETED! Screenshot saved: dopamint-metamask-connected.png');

    await page.waitForTimeout(5000);
  });

  testWithMetaMask.afterEach(async ({ context }, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log('Test FAILED - capturing debug screenshots...');
      const pages = context.pages();
      for (let i = 0; i < pages.length; i++) {
        try {
          await pages[i].screenshot({
            path: `${outputDir}/FAILED-metamask-page-${i}.png`,
            fullPage: true
          });
          console.log(`Captured debug screenshot of page ${i}`);
        } catch (e) {
          // Page may be closed
        }
      }
    }
    console.log(`Test "${testInfo.title}" has ended with status: ${testInfo.status}`);
  });
});

testWithEmail.describe('Login with Email', () => {
  testWithEmail.describe.configure({ timeout: 180000 }); // 3 minutes for OTP wait

  testWithEmail("Case 2: Login with Email Address", async ({ context }) => {
    console.log(`\n📧 Testing Email Login with: ${LOGIN_EMAIL}`);

    // Start login process (no wallet needed)
    const dopamintPage = new DopamintLoginPage(context, null);
    const dappPage = await dopamintPage.navigateAndLogin();
    await dopamintPage.closeAllPopups();
    await dopamintPage.loginWithEmail(LOGIN_EMAIL);
    await dopamintPage.verifyLoginButtonHidden();

    await dappPage.screenshot({ path: `${outputDir}/dopamint-email-connected.png` });
    console.log('\n✅ TEST COMPLETED! Screenshot saved: dopamint-email-connected.png');

    await dappPage.waitForTimeout(5000);
  });

  testWithEmail.afterEach(async ({ context }, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log('Test FAILED - capturing debug screenshots...');
      const pages = context.pages();
      for (let i = 0; i < pages.length; i++) {
        try {
          await pages[i].screenshot({
            path: `${outputDir}/FAILED-email-page-${i}.png`,
            fullPage: true
          });
          console.log(`Captured debug screenshot of page ${i}`);
        } catch (e) {
          // Page may be closed
        }
      }
    }
    console.log(`Test "${testInfo.title}" has ended with status: ${testInfo.status}`);
  });
});

// ============================================================
// Test with Chrome (for Case 3 - Google OAuth Login)
// Google blocks Chromium, so we need real Chrome browser
// Uses fresh profile each time to test full login flow
// ============================================================
const CHROME_PROFILE_DIR = path.resolve(__dirname, '../.chrome-profile-login');

const testWithGoogle = baseTest.extend<{
  context: BrowserContext;
}>({
  context: async ({}, use, testInfo) => {
    // Worker 0 starts immediately, others delay 10s each
    const delay = testInfo.parallelIndex * TEST_CASE_DELAY_MS;
    if (delay > 0) {
      console.log(`⏳ [Test Delay] Worker ${testInfo.parallelIndex}: Waiting ${delay / 1000}s before starting...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`✅ [Test Delay] Worker ${testInfo.parallelIndex}: Delay completed, starting test now...`);
    } else {
      console.log(`🚀 [Test Delay] Worker 0: Starting immediately (no delay)`);
    }

    // Try to delete old Chrome profile for fresh login (ignore errors if locked)
    if (fs.existsSync(CHROME_PROFILE_DIR)) {
      console.log('🗑️ Attempting to delete old Chrome profile...');
      try {
        fs.rmSync(CHROME_PROFILE_DIR, { recursive: true, force: true });
        console.log('✅ Chrome profile deleted');
      } catch (e) {
        console.log('⚠️ Could not delete Chrome profile (may be in use), continuing with existing profile...');
      }
    }

    // Launch real Chrome browser (not Chromium) to avoid Google blocking
// Trong launchPersistentContext cho Case 3
const context = await chromium.launchPersistentContext(CHROME_PROFILE_DIR, {
  headless: false,  // Headful trên local, headless trên CI nếu buộc phải
  channel: 'chrome',
  args: [
    '--start-maximized',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter',
    '--allow-running-insecure-content',
    '--disable-extensions-except=/path/to/metamask', // Nếu cần
    '--disable-infobars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-web-security', // Cẩn thận, chỉ dùng nếu cần
    '--disable-site-isolation-trials',
    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
    '--disable-ipc-flooding-protection',
  ],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'en-US',
  timezoneId: 'America/New_York',
  permissions: ['geolocation'],
});
    await use(context);
    // Cleanup
    await context.close().catch(() => {});
  },
});

testWithGoogle.describe('Login with Google', () => {
  testWithGoogle.describe.configure({ timeout: 180000 }); // 3 minutes for Google OAuth

  testWithGoogle("Case 3: Login with Google OAuth", async ({ context }) => {
    console.log(`\n🔐 Testing Google OAuth Login with: ${GOOGLE_EMAIL}`);

    if (!GOOGLE_PASSWORD) {
      throw new Error('GOOGLE_PASSWORD not set in .env.test');
    }

    // Start login process (no wallet needed)
    const dopamintPage = new DopamintLoginPage(context, null);
    const dappPage = await dopamintPage.navigateAndLogin();
    await dopamintPage.closeAllPopups();
    await dopamintPage.loginWithGoogle(GOOGLE_EMAIL, GOOGLE_PASSWORD);
    await dopamintPage.verifyLoginButtonHidden();

    await dappPage.screenshot({ path: `${outputDir}/dopamint-google-connected.png` });
    console.log('\n✅ TEST COMPLETED! Screenshot saved: dopamint-google-connected.png');

    await dappPage.waitForTimeout(5000);
  });

  testWithGoogle.afterEach(async ({ context }, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log('Test FAILED - capturing debug screenshots...');
      const pages = context.pages();
      for (let i = 0; i < pages.length; i++) {
        try {
          await pages[i].screenshot({
            path: `${outputDir}/FAILED-google-page-${i}.png`,
            fullPage: true
          });
          console.log(`Captured debug screenshot of page ${i}`);
        } catch (e) {
          // Page may be closed
        }
      }
    }
    console.log(`Test "${testInfo.title}" has ended with status: ${testInfo.status}`);
  });
});
