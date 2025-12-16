import { BrowserContext, Page, expect } from "@playwright/test";
import { Dappwright } from "@tenkeylabs/dappwright";
import { DOPAMINT_SELECTORS } from '../xpath/dopamintLogin';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

export class DopamintLoginPage {
    readonly context: BrowserContext;
    readonly wallet: Dappwright;
    page: Page | undefined;
    
    private readonly baseUrl = 'https://dev.dopamint.ai/';
    private readonly email = process.env.DOPAMINT_EMAIL!;
    private readonly password = process.env.DOPAMINT_PASSWORD!;

    constructor(context: BrowserContext, wallet: Dappwright) {
        this.context = context;
        this.wallet = wallet;
    }

    async navigateAndLogin(): Promise<Page> {
        console.log('\n=== STEP 2: Navigate to website and enter email/password to sign in ===');

        // Reuse existing page if available (to avoid blank tab)
        if (this.context.pages().length > 0) {
            this.page = this.context.pages()[0];
            await this.page.bringToFront();
        } else {
            this.page = await this.context.newPage();
        }

        const dappPage = this.page;

        await dappPage.goto(this.baseUrl);
        await dappPage.waitForTimeout(3000);

        // Login if redirected to auth page
        if (dappPage.url().includes('amazoncognito.com/login')) {
            console.log('Logging into Dopamint...');
            await dappPage.locator(DOPAMINT_SELECTORS.EMAIL_INPUT).fill(this.email);
            await dappPage.locator(DOPAMINT_SELECTORS.PASSWORD_INPUT).fill(this.password);
            await dappPage.locator(DOPAMINT_SELECTORS.SUBMIT_BUTTON).click();
            await dappPage.waitForURL(this.baseUrl + '**', { timeout: 30000 });
            console.log('✅ Email/password login successful!');
        }

        await dappPage.waitForLoadState('networkidle');

        // Verify we're on the main page
        await expect(dappPage.locator(DOPAMINT_SELECTORS.MARKETPLACE_TEXT).first()).toBeVisible({ timeout: 15000 });
        console.log('Dopamint homepage loaded successfully!');

        return dappPage;
    }

    async closeAllPopups(): Promise<void> {
        if (!this.page) throw new Error("Page not initialized. Call navigateAndLogin first.");
        const dappPage = this.page;

        console.log('\n=== STEP 3: Close all open popups ===');

        // Handle popup 1: Terms of Service
        const termsPopupButton = dappPage.locator(DOPAMINT_SELECTORS.TERMS_POPUP_BUTTON);
        if (await termsPopupButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('Closing Terms of Service popup...');
            await termsPopupButton.click();
            await dappPage.waitForTimeout(1000);
        }

        await dappPage.waitForTimeout(2000);

        // Handle popup 2: Close any dialog with X button
        for (const selector of DOPAMINT_SELECTORS.CLOSE_DIALOG_BUTTONS) {
            const closeBtn = dappPage.locator(selector).first();
            if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                console.log(`Closing popup with selector: ${selector}`);
                await closeBtn.click({ force: true });
                await dappPage.waitForTimeout(1000);
                break;
            }
        }

        // If overlay still exists, press Escape
        await dappPage.keyboard.press('Escape');
        await dappPage.waitForTimeout(500);

        console.log('✅ All popups closed!');
    }

    async loginWithMetaMask(): Promise<void> {
        if (!this.page) throw new Error("Page not initialized. Call navigateAndLogin first.");
        const dappPage = this.page;
        const wallet = this.wallet;
        const context = this.context;

        console.log('\n=== STEP 4: Click Login button, select MetaMask wallet, and confirm sign in ===');

        // Click Login button
        const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
        if (!await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            throw new Error('Login button not found');
        }

        console.log('Clicking Login button...');
        await loginButton.click();
        await dappPage.waitForTimeout(2000);

        // Click "Sign in with wallet" button
        const signInWithWalletButton = dappPage.locator(DOPAMINT_SELECTORS.SIGN_IN_WITH_WALLET);
        if (!await signInWithWalletButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            throw new Error('Sign in with wallet button not found');
        }

        console.log('Clicking Sign in with wallet...');
        await signInWithWalletButton.click();
        await dappPage.waitForTimeout(3000);

        // Select MetaMask option
        const metamaskOption = dappPage.locator(DOPAMINT_SELECTORS.METAMASK_OPTION).first();
        if (!await metamaskOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            throw new Error('MetaMask option not found');
        }

        console.log('Selecting MetaMask...');
        await metamaskOption.click();

        // Handle MetaMask Connect - Manual approach for xvfb environment
        console.log('Waiting for MetaMask Connect popup...');

        // Wait for MetaMask popup to appear
        await dappPage.waitForTimeout(3000);

        // Helper function to find MetaMask popup
        const findMetaMaskPopup = async (): Promise<Page | null> => {
            console.log(`Searching for MetaMask popup... Total pages: ${context.pages().length}`);
            for (const page of context.pages()) {
                const url = page.url();
                console.log(`  - Checking: ${url}`);
                // MetaMask popup URLs contain chrome-extension:// and either notification.html or popup.html
                if (url.includes('chrome-extension://') &&
                    (url.includes('notification.html') || url.includes('popup.html') || url.includes('confirm'))) {
                    console.log(`  ✓ Found MetaMask popup: ${url}`);
                    return page;
                }
            }
            // Fallback: any chrome-extension page that's not home.html
            for (const page of context.pages()) {
                const url = page.url();
                if (url.includes('chrome-extension://') && !url.includes('home.html')) {
                    console.log(`  ✓ Found MetaMask page (fallback): ${url}`);
                    return page;
                }
            }
            return null;
        };

        // Helper function to click MetaMask buttons
        const clickMetaMaskButton = async (popup: Page, buttonTexts: string[]): Promise<boolean> => {
            // Verify this is a MetaMask page
            const popupUrl = popup.url();
            if (!popupUrl.includes('chrome-extension://')) {
                console.log(`⚠️ Not a MetaMask popup! URL: ${popupUrl}`);
                return false;
            }

            console.log(`Looking for buttons on: ${popupUrl}`);

            for (const text of buttonTexts) {
                try {
                    // Try button with exact text
                    const btn = popup.locator(`button:has-text("${text}")`).first();
                    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                        const isDisabled = await btn.isDisabled().catch(() => false);
                        if (!isDisabled) {
                            console.log(`✓ Clicking MetaMask button: "${text}"`);
                            await btn.click();
                            return true;
                        } else {
                            console.log(`  Button "${text}" found but disabled`);
                        }
                    }
                } catch (e) {
                    // Continue to next button
                }
            }

            // Debug: list all visible buttons
            try {
                const allButtons = await popup.locator('button').all();
                console.log(`  Found ${allButtons.length} buttons on page:`);
                for (let i = 0; i < Math.min(allButtons.length, 5); i++) {
                    const btnText = await allButtons[i].textContent().catch(() => '');
                    console.log(`    - Button ${i}: "${btnText?.trim()}"`);
                }
            } catch (e) {
                // Ignore
            }

            return false;
        };

        // STEP 1: Handle Connect/Approve popup
        console.log('\n=== METAMASK STEP 1: Connect Approval ===');

        // Wait for popup with retry
        let metamaskPopup: Page | null = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`Attempt ${attempt}/5: Looking for MetaMask popup...`);
            metamaskPopup = await findMetaMaskPopup();
            if (metamaskPopup) break;

            // Wait for new page event
            if (attempt < 5) {
                const newPage = await context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
                if (newPage) {
                    console.log(`New page opened: ${newPage.url()}`);
                    if (newPage.url().includes('chrome-extension://')) {
                        metamaskPopup = newPage;
                        break;
                    }
                }
                await dappPage.waitForTimeout(1000);
            }
        }

        if (metamaskPopup) {
            await metamaskPopup.waitForLoadState();
            await metamaskPopup.bringToFront();

            // Try clicking Next/Connect buttons
            const connectButtons = ['Next', 'Tiếp theo', 'Connect', 'Kết nối', 'Confirm', 'Xác nhận'];
            let clicked = await clickMetaMaskButton(metamaskPopup, connectButtons);

            if (clicked) {
                console.log('✅ Clicked first button, waiting for next step...');

                try {
                    await metamaskPopup.waitForTimeout(2000);

                    // Check if popup is still open for second confirmation
                    if (!metamaskPopup.isClosed()) {
                        clicked = await clickMetaMaskButton(metamaskPopup, connectButtons);
                        if (clicked) {
                            console.log('✅ Clicked second button');
                        }
                    } else {
                        console.log('Popup closed after first click (expected)');
                    }
                } catch (e) {
                    console.log('Popup closed after click (expected behavior)');
                }
            } else {
                console.log('⚠️ Could not find Connect button');
                const content = await metamaskPopup.textContent('body').catch(() => '');
                console.log('Popup content:', content?.substring(0, 300));
            }

            // Wait a bit, but handle if popup is closed
            try {
                if (!metamaskPopup.isClosed()) {
                    await metamaskPopup.waitForTimeout(2000);
                }
            } catch (e) {
                // Popup closed, continue
            }
        } else {
            console.log('⚠️ No MetaMask popup found for Connect step');
            // Fallback to dappwright
            try {
                await wallet.approve();
                console.log('✅ wallet.approve() succeeded');
            } catch (e) {
                console.log('⚠️ wallet.approve() failed:', e);
            }
        }

        // STEP 2: Check if additional Sign popup appears (may not be needed if signature was in STEP 1)
        console.log('\n=== METAMASK STEP 2: Check for additional Sign popup ===');
        await dappPage.waitForTimeout(2000);

        // Check if there's another popup (signature might be separate)
        let signPopup = await findMetaMaskPopup();

        if (signPopup) {
            console.log('Found additional Sign popup!');
            await signPopup.waitForLoadState();
            await signPopup.bringToFront();
            await signPopup.waitForTimeout(1000);

            // Scroll down to enable Sign button
            console.log('Scrolling down...');
            try {
                await signPopup.mouse.move(200, 300);
                await signPopup.mouse.wheel(0, 1000);
                await signPopup.keyboard.press('End');
            } catch (e) {
                // Ignore scroll errors
            }

            await signPopup.waitForTimeout(500);

            // Try to click Sign/Confirm button
            const signButtons = ['Sign', 'Ký', 'Confirm', 'Xác nhận', 'Approve', 'Chấp nhận'];
            const clicked = await clickMetaMaskButton(signPopup, signButtons);

            if (clicked) {
                console.log('✅ Additional Sign button clicked!');
            } else {
                console.log('No Sign button found (may already be signed)');
            }
        } else {
            // No additional popup - signature was likely done in STEP 1 (this is normal!)
            console.log('✅ No additional Sign popup (signature completed in Connect step)');
        }

        console.log('✅ MetaMask interaction completed!');
    }

    async verifyLoginButtonHidden(): Promise<void> {
        if (!this.page) throw new Error("Page not initialized. Call navigateAndLogin first.");
        const dappPage = this.page;

        console.log('\n=== STEP 5: Verify website UI no longer shows Login button ===');

        console.log('Waiting for page to update after wallet connection...');
        await dappPage.waitForTimeout(5000);

        const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
        const isLoginVisible = await loginButton.isVisible({ timeout: 3000 }).catch(() => false);

        if (isLoginVisible) {
            throw new Error('Login button still visible after wallet connection');
        }

        console.log('✅ Verification successful: Login button is NOT visible - wallet connected!');

        await expect(loginButton).not.toBeVisible({ timeout: 5000 });
        console.log('✅ Test assertion passed: Login button is NOT visible!');
    }
}