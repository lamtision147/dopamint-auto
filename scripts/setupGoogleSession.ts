/**
 * Script to setup Google login session for Playwright tests
 *
 * This script will:
 * 1. Open browser and navigate to Dopamint
 * 2. Login with Cognito (email/password)
 * 3. Click Google button and wait for you to manually complete Google login
 * 4. Save the session (cookies, localStorage) to a file
 *
 * Usage: npx ts-node scripts/setupGoogleSession.ts
 */

import { chromium, BrowserContext } from '@playwright/test';
import { DOPAMINT_SELECTORS } from '../xpath/dopamintLogin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const DOPAMINT_EMAIL = process.env.DOPAMINT_EMAIL || '';
const DOPAMINT_PASSWORD = process.env.DOPAMINT_PASSWORD || '';
const STORAGE_STATE_PATH = path.resolve(__dirname, '../auth/googleSession.json');

async function setupGoogleSession() {
    console.log('\n========================================');
    console.log('🔐 GOOGLE SESSION SETUP');
    console.log('========================================\n');

    // Ensure auth directory exists
    const authDir = path.dirname(STORAGE_STATE_PATH);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
        console.log(`📁 Created auth directory: ${authDir}`);
    }

    // Launch real Chrome browser (not Chromium) to avoid Google blocking
    console.log('🚀 Launching Chrome browser...');

    // Use persistent context with real Chrome to avoid "browser not secure" error
    const userDataDir = path.resolve(__dirname, '../.chrome-profile');
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: 'chrome',  // Use real Chrome instead of Chromium
        args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',  // Hide automation
        ],
        viewport: null
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

            // Find visible username input (there may be sign-in and sign-up forms)
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
        const signInDialog = page.locator('div:has-text("Sign in")').filter({ hasText: 'Powered by' });
        const socialButtons = signInDialog.locator('button:has(svg)');
        const googleBtn = socialButtons.first();
        await googleBtn.click();

        console.log('\n========================================');
        console.log('⚠️  MANUAL ACTION REQUIRED');
        console.log('========================================');
        console.log('');
        console.log('1. A Google login popup should appear');
        console.log('2. Complete the Google login process manually');
        console.log('3. After successful login, the popup will close');
        console.log('4. Wait until you see "Login button hidden"');
        console.log('5. Then press Enter in this terminal to save session');
        console.log('');
        console.log('========================================\n');

        // Wait for popup and let user handle it
        const popup = await context.waitForEvent('page', { timeout: 120000 }).catch(() => null);

        if (popup) {
            console.log(`📱 Google popup opened: ${popup.url()}`);
            console.log('⏳ Waiting for you to complete Google login...');

            // Wait for popup to close (user completed login)
            await popup.waitForEvent('close', { timeout: 300000 }).catch(() => {});
            console.log('✅ Google popup closed!');
        }

        // Wait for login to complete on main page
        await page.waitForTimeout(3000);
        await page.bringToFront();

        // Check if login was successful
        const loginBtn = page.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
        const isLoginVisible = await loginBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (!isLoginVisible) {
            console.log('✅ Login button hidden - Google login successful!');
        } else {
            console.log('⚠️  Login button still visible. Please complete login manually.');
            console.log('Press Enter when ready to save session...');

            // Wait for user input
            await new Promise<void>((resolve) => {
                process.stdin.once('data', () => resolve());
            });
        }

        // Step 6: Save session
        console.log('\n📍 Step 6: Saving session...');
        await context.storageState({ path: STORAGE_STATE_PATH });
        console.log(`✅ Session saved to: ${STORAGE_STATE_PATH}`);

        console.log('\n========================================');
        console.log('🎉 SETUP COMPLETE!');
        console.log('========================================');
        console.log('');
        console.log('You can now run tests with the saved Google session.');
        console.log('The session file is at: ' + STORAGE_STATE_PATH);
        console.log('');

    } catch (error) {
        console.error('❌ Error during setup:', error);
    } finally {
        await page.waitForTimeout(3000);
        await context.close();
    }
}

// Run the setup
setupGoogleSession().catch(console.error);
