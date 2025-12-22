import { BrowserContext, test as baseTest, expect, Page } from "@playwright/test";
import { setupMetaMask, TEST_FILE_OFFSETS } from '../dapp/metamaskSetup';
import { DopamintLoginPage } from '../pages/loginDopamint';
import dappwright, { Dappwright } from "@tenkeylabs/dappwright";
import fs from 'fs'; // Import module file system
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.test
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Get output directory (spec-specific or default)
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

const DOPAMINT_EMAIL = process.env.DOPAMINT_EMAIL!;
const DOPAMINT_PASSWORD = process.env.DOPAMINT_PASSWORD!;
const baseUrl = 'https://dev.dopamint.ai/';

export const test = baseTest.extend<{
  context: BrowserContext;
  wallet: Dappwright;
}>({
  context: async ({}, use) => {
    // Use LOGIN file offset (0) for staggered parallel execution across all test files
    const { wallet, context } = await setupMetaMask(0, TEST_FILE_OFFSETS.LOGIN);
    await use(context);
  },

  wallet: async ({ context }, use) => {
    const metamask = await dappwright.getWallet("metamask", context);
    await use(metamask);
  },
});

const saveToLogFile = (actualStatus: string, depositTx: string) => {
  // Get current time in GMT+7 timezone
  const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });

  const logEntry = `Timestamp: ${currentTime}, Status: ${actualStatus}, Deposit Tx: ${depositTx}\n`;
  fs.appendFileSync('pitDeposit.txt', logEntry); // Append the log entry to the file
};

test.describe('Login', () => {
    test.describe.configure({ timeout: 120000 });
  test("Case 1: Login with metamask", async ({ wallet, page, context }) => {

      // Start login process
      const dopamintPage = new DopamintLoginPage(context, wallet);
      const dappPage = await dopamintPage.navigateAndLogin();
      await dopamintPage.closeAllPopups();
      await dopamintPage.loginWithMetaMask();
      await dopamintPage.verifyLoginButtonHidden();
      
      await dappPage.screenshot({ path: `${outputDir}/dopamint-metamask-connected.png` });
    console.log('\n✅ TEST COMPLETED! Screenshot saved.');


      
      //saveToLogFile(actualStatus, depositTx);

      // Check if result matches expected
    //   if (actualStatus === expectedStatus) {
    //     console.log("Transaction successful!");
    //     break; // Exit loop if successful
    //   } else {
    //     console.log(`Attempt ${attempt} failed. Retrying...`);
    //     if (attempt === maxRetries) {
    //       throw new Error(`Transaction failed after ${maxRetries} attempts.`);
    //     }
    //     await page.waitForTimeout(3000); // Wait 3 seconds before retrying
    //   }
    
    
    await page.waitForTimeout(5000); // Wait before ending test
  });

  test.afterEach(async ({ context }, testInfo) => {
    // Only capture debug screenshots on FAILURE
    if (testInfo.status !== 'passed') {
      console.log('Test FAILED - capturing debug screenshots...');
      const pages = context.pages();
      for (let i = 0; i < pages.length; i++) {
        try {
          await pages[i].screenshot({
            path: `test-results/FAILED-page-${i}.png`,
            fullPage: true
          });
          console.log(`Captured debug screenshot of page ${i}`);
        } catch (e) {
          // Page may be closed
        }
      }
    }
    console.log(`Test "${testInfo.title}" has ended.`);
  });
});
