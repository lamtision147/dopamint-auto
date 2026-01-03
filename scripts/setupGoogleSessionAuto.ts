/**
 * AUTOMATED Google Session Setup for CI/CodeBuild
 *
 * This script automatically:
 * 1. Opens browser and navigates to Dopamint
 * 2. Logs in with Cognito (email/password)
 * 3. Clicks Google button and completes Google OAuth with auto 2FA
 * 4. Saves the session to a file for use by tests
 *
 * Usage: npx ts-node scripts/setupGoogleSessionAuto.ts
 */

import { chromium } from '@playwright/test';
import { DOPAMINT_SELECTORS } from '../xpath/dopamintLogin';
import { authenticator } from 'otplib';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const DOPAMINT_EMAIL = process.env.DOPAMINT_EMAIL || '';
const DOPAMINT_PASSWORD = process.env.DOPAMINT_PASSWORD || '';
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL || '';
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD || '';
const GOOGLE_2FA_SECRET = process.env.GOOGLE_2FA_SECRET || '';
const STORAGE_STATE_PATH = path.resolve(__dirname, '../auth/googleSession.json');

// Check if running on CI
const IS_CI = process.env.CI === 'true' || process.env.CODEBUILD_BUILD_ID !== undefined;

async function setupGoogleSessionAuto() {
    console.log('\n========================================');
    console.log('🔐 AUTOMATED GOOGLE SESSION SETUP');
    console.log(`📍 Environment: ${IS_CI ? 'CI/CodeBuild' : 'Local'}`);
    console.log('========================================\n');

    // Validate required environment variables
    if (!GOOGLE_EMAIL || !GOOGLE_PASSWORD) {
        throw new Error('GOOGLE_EMAIL and GOOGLE_PASSWORD must be set in .env.test');
    }
    if (!GOOGLE_2FA_SECRET) {
        throw new Error('GOOGLE_2FA_SECRET must be set in .env.test for auto 2FA');
    }

    // Ensure auth directory exists
    const authDir = path.dirname(STORAGE_STATE_PATH);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
        console.log(`📁 Created auth directory: ${authDir}`);
    }

    console.log('🚀 Launching browser...');

    // On CI, use headless Chromium. Locally, use headed Chrome.
    const browser = await chromium.launch({
        headless: IS_CI,
        channel: IS_CI ? undefined : 'chrome',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ],
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    try {
        // Step 1: Navigate to Dopamint
        console.log('\n📍 Step 1: Navigating to Dopamint...');
        await page.goto('https://dev.dopamint.ai/');
        await page.waitForTimeout(2000);

        // Step 2: Login with Cognito if needed
        if (page.url().includes('amazoncognito.com/login')) {
            console.log('🔑 Step 2: Logging into Cognito...');
            const usernameInputs = page.locator('input[name="username"]:visible');
            const passwordInputs = page.locator('input[name="password"]:visible');
            const submitButtons = page.locator('input[type="submit"]:visible');

            await usernameInputs.first().fill(DOPAMINT_EMAIL);
            await passwordInputs.first().fill(DOPAMINT_PASSWORD);
            await submitButtons.first().click();
            await page.waitForURL('https://dev.dopamint.ai/**', { timeout: 30000 });
            console.log('✅ Cognito login successful!');
        }

        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Step 3: Close popups
        console.log('🔄 Step 3: Closing popups...');
        const termsPopup = page.locator(DOPAMINT_SELECTORS.TERMS_POPUP_BUTTON);
        if (await termsPopup.isVisible({ timeout: 2000 }).catch(() => false)) {
            await termsPopup.click();
            await page.waitForTimeout(500);
        }

        for (const selector of DOPAMINT_SELECTORS.CLOSE_DIALOG_BUTTONS) {
            const closeBtn = page.locator(selector).first();
            if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await closeBtn.click({ force: true });
                await page.waitForTimeout(500);
                break;
            }
        }
        await page.keyboard.press('Escape');
        console.log('✅ Popups closed!');

        // Step 4: Click Login button
        console.log('\n📍 Step 4: Opening login dialog...');
        const loginButton = page.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
        await loginButton.click();
        await page.waitForTimeout(1500);

        // Step 5: Click Google button
        console.log('📍 Step 5: Clicking Google button...');
        const googleBtnSelectors = [
            'button[aria-label*="Google" i]',
            'button:has(svg path[fill="#4285F4"])',
            'div[role="dialog"] button:first-child',
        ];

        let googleClicked = false;
        for (const selector of googleBtnSelectors) {
            const btn = page.locator(selector).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await btn.click();
                googleClicked = true;
                console.log(`✅ Clicked Google button: ${selector}`);
                break;
            }
        }

        if (!googleClicked) {
            throw new Error('Google button not found');
        }

        // Step 6: Handle Google OAuth popup
        console.log('\n📍 Step 6: Handling Google OAuth...');
        const [googlePopup] = await Promise.all([
            context.waitForEvent('page', { timeout: 30000 }),
        ]);

        console.log(`📱 Google popup opened: ${googlePopup.url()}`);
        await googlePopup.waitForLoadState('domcontentloaded');
        await googlePopup.waitForTimeout(1500);

        // Enter email
        console.log('📧 Entering email...');
        const emailInput = googlePopup.getByLabel('Email or phone').first();
        await emailInput.waitFor({ timeout: 15000 });
        await emailInput.fill(GOOGLE_EMAIL);
        await googlePopup.getByRole('button', { name: 'Next' }).click();
        console.log('✅ Email entered');

        // Enter password
        await googlePopup.waitForLoadState('networkidle', { timeout: 20000 });
        await googlePopup.waitForTimeout(2000);

        console.log('🔐 Entering password...');
        const passwordInput = googlePopup.getByLabel('Enter your password').or(
            googlePopup.locator('input[type="password"]')
        ).first();
        await passwordInput.waitFor({ timeout: 15000 });
        await passwordInput.fill(GOOGLE_PASSWORD);

        // Click Next
        const nextBtn = googlePopup.getByRole('button', { name: 'Next' }).or(
            googlePopup.locator('#passwordNext')
        ).first();
        await nextBtn.click();
        console.log('✅ Password entered');

        // Wait for 2FA screen
        await googlePopup.waitForTimeout(3000);

        // Check for 2FA
        const popupUrl = googlePopup.isClosed() ? '' : googlePopup.url();
        const is2FAScreen = popupUrl.includes('/challenge/');

        if (is2FAScreen) {
            console.log('🔐 2FA screen detected!');

            // Generate TOTP code
            const totpCode = authenticator.generate(GOOGLE_2FA_SECRET);
            console.log(`🔑 Generated TOTP code: ${totpCode}`);

            // Find and fill TOTP input
            const totpInput = googlePopup.locator('input[type="tel"]').or(
                googlePopup.locator('input[name="totpPin"]')
            ).first();

            if (await totpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await totpInput.fill(totpCode);
                console.log('✅ TOTP code entered');

                // Click verify
                const verifyBtn = googlePopup.getByRole('button', { name: /Next|Verify/i }).first();
                if (await verifyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await verifyBtn.click();
                    console.log('✅ Clicked Verify');
                } else {
                    await totpInput.press('Enter');
                }

                // Wait a bit for verification (popup may close)
                if (!googlePopup.isClosed()) {
                    await googlePopup.waitForTimeout(3000).catch(() => {});
                }
            }
        }

        // Wait for popup to close (if not already closed)
        if (!googlePopup.isClosed()) {
            await googlePopup.waitForEvent('close', { timeout: 30000 }).catch(() => {});
        }
        console.log('✅ Google popup closed!');

        // Wait for main page to update
        await page.waitForTimeout(3000);
        await page.bringToFront();

        // Verify login successful
        const loginBtn = page.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
        const isLoginVisible = await loginBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (isLoginVisible) {
            throw new Error('Login failed - Login button still visible');
        }

        console.log('✅ Google login successful!');

        // Step 7: Save session
        console.log('\n📍 Step 7: Saving session...');
        await context.storageState({ path: STORAGE_STATE_PATH });
        console.log(`✅ Session saved to: ${STORAGE_STATE_PATH}`);

        console.log('\n========================================');
        console.log('🎉 AUTOMATED SETUP COMPLETE!');
        console.log('========================================');
        console.log(`Session file: ${STORAGE_STATE_PATH}`);

    } catch (error) {
        console.error('❌ Error during setup:', error);

        // Save screenshot for debugging
        const screenshotPath = path.resolve(__dirname, '../test-results/setup-error.png');
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        console.log(`📸 Error screenshot: ${screenshotPath}`);

        throw error;
    } finally {
        await browser.close();
    }
}

// Run the setup
setupGoogleSessionAuto().catch((error) => {
    console.error(error);
    process.exit(1);
});
