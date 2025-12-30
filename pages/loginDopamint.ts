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
        await dappPage.waitForTimeout(2000);

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
        if (await termsPopupButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('Closing Terms of Service popup...');
            await termsPopupButton.click();
            await dappPage.waitForTimeout(500);
        }

        await dappPage.waitForTimeout(1000);

        // Handle popup 2: Close any dialog with X button
        for (const selector of DOPAMINT_SELECTORS.CLOSE_DIALOG_BUTTONS) {
            const closeBtn = dappPage.locator(selector).first();
            if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                console.log(`Closing popup with selector: ${selector}`);
                await closeBtn.click({ force: true });
                await dappPage.waitForTimeout(500);
                break;
            }
        }

        // If overlay still exists, press Escape
        await dappPage.keyboard.press('Escape');
        await dappPage.waitForTimeout(300);

        console.log('✅ All popups closed!');
    }

    async loginWithMetaMask(): Promise<void> {
        if (!this.page) throw new Error("Page not initialized. Call navigateAndLogin first.");
        const dappPage = this.page;
        const wallet = this.wallet;
        const context = this.context;

        const closeMetaMaskPages = async (): Promise<void> => {
            for (const p of context.pages()) {
                if (p === dappPage) continue;
                const url = p.url();
                if (!url.includes('chrome-extension://')) continue;
                if (url.includes('home.html')) continue;
                try {
                    await p.close({ runBeforeUnload: true });
                } catch (e) {
                }
            }
        };

        const isLoginButtonHidden = async (): Promise<boolean> => {
            const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
            const isVisible = await loginButton.isVisible({ timeout: 1000 }).catch(() => false);
            return !isVisible;
        };

        const waitForLoginHiddenQuick = async (timeoutMs: number): Promise<boolean> => {
            const deadline = Date.now() + Math.max(0, timeoutMs);
            while (Date.now() < deadline) {
                if (await isLoginButtonHidden()) return true;
                await dappPage.waitForTimeout(250);
            }
            return await isLoginButtonHidden();
        };

        const findMetaMaskPopup = async (): Promise<Page | null> => {
            for (const p of context.pages()) {
                const url = p.url();
                if (url.includes('chrome-extension://') && (url.includes('notification.html') || url.includes('popup.html') || url.includes('confirm')))
                    return p;
            }
            for (const p of context.pages()) {
                const url = p.url();
                if (url.includes('chrome-extension://') && !url.includes('home.html')) return p;
            }
            return null;
        };

        const clickMetaMaskButton = async (popup: Page, buttonTexts: string[], timeoutPerButtonMs: number): Promise<boolean> => {
            const popupUrl = popup.url();
            if (!popupUrl.includes('chrome-extension://')) return false;

            const selectorCandidates: string[] = [
                ...DOPAMINT_SELECTORS.METAMASK_SIGN_BUTTONS,
                'button[data-testid="confirmation-submit-button"]',
                'button[data-testid="confirm-footer-button"]',
                'button[data-testid="page-container-footer-next"]',
                'button[data-testid="page-container-footer-next-button"]'
            ];

            for (const selector of selectorCandidates) {
                const btn = popup.locator(selector).first();
                const visible = await btn.isVisible({ timeout: Math.min(1500, timeoutPerButtonMs) }).catch(() => false);
                if (!visible) continue;
                const isDisabled = await btn.isDisabled().catch(() => false);
                if (isDisabled) {
                    // Try scrolling to enable it (common in MetaMask)
                    await popup.mouse.wheel(0, 1000).catch(() => undefined);
                    await popup.waitForTimeout(500);
                    if (await btn.isDisabled().catch(() => false)) continue;
                }
                await btn.scrollIntoViewIfNeeded().catch(() => undefined);
                await btn.click();
                return true;
            }

            for (const text of buttonTexts) {
                const btn = popup.locator(`button:has-text("${text}")`).first();
                const visible = await btn.isVisible({ timeout: Math.min(1500, timeoutPerButtonMs) }).catch(() => false);
                if (!visible) continue;
                const isDisabled = await btn.isDisabled().catch(() => false);
                if (isDisabled) {
                    // Try scrolling to enable it
                    await popup.mouse.wheel(0, 1000).catch(() => undefined);
                    await popup.waitForTimeout(500);
                    if (await btn.isDisabled().catch(() => false)) continue;
                }
                await btn.scrollIntoViewIfNeeded().catch(() => undefined);
                await btn.click();
                return true;
            }

            return false;
        };

        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`\n=== STEP 4: Login with MetaMask (attempt ${attempt}/${maxAttempts}) ===`);

            await this.closeAllPopups();
            await closeMetaMaskPages();

            const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
            if (!await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                if (await isLoginButtonHidden()) return;
                throw new Error('Login button not found');
            }

            await loginButton.click();
            await dappPage.waitForTimeout(1200);

            const signInWithWalletButton = dappPage.locator(DOPAMINT_SELECTORS.SIGN_IN_WITH_WALLET);
            if (!await signInWithWalletButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                throw new Error('Sign in with wallet button not found');
            }

            await signInWithWalletButton.click();
            await dappPage.waitForTimeout(1500);

            const metamaskOption = dappPage.locator(DOPAMINT_SELECTORS.METAMASK_OPTION).first();
            if (!await metamaskOption.isVisible({ timeout: 3000 }).catch(() => false)) {
                throw new Error('MetaMask option not found');
            }

            const startedAt = Date.now();
            const deadlineTs = startedAt + 10000;

            await metamaskOption.click();

            const remaining = () => Math.max(0, deadlineTs - Date.now());

            let metamaskPopup: Page | null = null;
            while (remaining() > 0) {
                metamaskPopup = await findMetaMaskPopup();
                if (metamaskPopup) break;
                const waitMs = Math.min(500, remaining());
                if (waitMs <= 0) break;
                await context.waitForEvent('page', { timeout: waitMs }).catch(() => null);
            }

            if (metamaskPopup) {
                await metamaskPopup.waitForLoadState().catch(() => undefined);
                await metamaskPopup.bringToFront().catch(() => undefined);
                
                // Ensure we scroll down to make buttons active/visible
                await metamaskPopup.mouse.wheel(0, 1000).catch(() => undefined);
                await metamaskPopup.waitForTimeout(500);

                const connectButtons = ['Next', 'Tiếp theo', 'Connect', 'Kết nối', 'Confirm', 'Xác nhận', 'Approve', 'Chấp nhận'];
                let clicked1 = await clickMetaMaskButton(metamaskPopup, connectButtons, Math.min(2000, remaining()));

                if (clicked1) {
                    await metamaskPopup.waitForTimeout(Math.min(800, remaining())).catch(() => undefined);
                    if (!metamaskPopup.isClosed() && remaining() > 0) {
                        await clickMetaMaskButton(metamaskPopup, connectButtons, Math.min(2000, remaining()));
                    }
                } else {
                    console.log('Connect button not clicked manually, trying wallet.approve()...');
                    await wallet.approve().catch((e) => console.log(`wallet.approve() failed: ${e}`));
                }
            } else {
                console.log('No Connect popup found, trying wallet.approve()...');
                await wallet.approve().catch((e) => console.log(`wallet.approve() failed: ${e}`));
            }

            // Wait a bit for potential Sign popup or auto-close
            await dappPage.waitForTimeout(1000);

            const signPopupDeadline = Date.now() + Math.min(4000, remaining());
            let signPopup: Page | null = null;
            while (Date.now() < signPopupDeadline) {
                signPopup = await findMetaMaskPopup();
                if (signPopup) break;
                await dappPage.waitForTimeout(200);
            }

            if (signPopup && remaining() > 0) {
                await signPopup.waitForLoadState().catch(() => undefined);
                await signPopup.bringToFront().catch(() => undefined);

                // Try to scroll down (often needed for Sign button)
                await signPopup.keyboard.press('End').catch(() => undefined);
                await signPopup.mouse.wheel(0, 1000).catch(() => undefined);
                await signPopup.waitForTimeout(Math.min(500, remaining())).catch(() => undefined);

                const signButtons = ['Sign', 'Ký', 'Confirm', 'Xác nhận', 'Approve', 'Chấp nhận'];
                const clicked = await clickMetaMaskButton(signPopup, signButtons, Math.min(2000, remaining()));
                
                if (!clicked) {
                    console.log('Could not click Sign button manually, trying wallet.sign()...');
                    await wallet.sign().catch(() => console.log('wallet.sign() also failed/timed out'));
                }
            } else {
                // If no popup found but we might still need to sign (sometimes popup is hidden or slow)
                // We try wallet.sign() as a blind fallback if login is not yet successful
                if (!await isLoginButtonHidden()) {
                     console.log('No Sign popup found but still not logged in, trying wallet.sign()...');
                     await wallet.sign().catch(() => undefined);
                }
            }

            const ok = await waitForLoginHiddenQuick(remaining());
            if (ok) {
                console.log('✅ Wallet login confirmed within 10s window');
                return;
            }

            console.log('⚠️ Wallet login not confirmed within 10s window - closing popups and retrying');
            await closeMetaMaskPages();
            await this.closeAllPopups();
            await dappPage.waitForTimeout(1000);
        }

        throw new Error('MetaMask login failed after 3 attempts (popup conflict)');
    }

    async verifyLoginButtonHidden(): Promise<void> {
        if (!this.page) throw new Error("Page not initialized. Call navigateAndLogin first.");
        const dappPage = this.page;
        const wallet = this.wallet;
        const context = this.context;

        console.log('\n=== STEP 5: Verify website UI no longer shows Login button ===');

        console.log('Waiting for page to update after wallet connection...');

        // Phase 1: Quick check with page reload
        const quickRetries = 4;
        const retryDelay = 2500;

        for (let attempt = 1; attempt <= quickRetries; attempt++) {
            console.log(`Attempt ${attempt}/${quickRetries}: Checking login button visibility...`);

            await dappPage.waitForTimeout(retryDelay);

            const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
            const isLoginVisible = await loginButton.isVisible({ timeout: 2000 }).catch(() => false);

            if (!isLoginVisible) {
                console.log('✅ Verification successful: Login button is NOT visible - wallet connected!');
                await expect(loginButton).not.toBeVisible({ timeout: 5000 });
                console.log('✅ Test assertion passed: Login button is NOT visible!');
                return;
            }

            console.log(`Login button still visible, attempt ${attempt}/${quickRetries}`);

            // Check if there are any pending MetaMask popups
            for (const page of context.pages()) {
                const url = page.url();
                if (url.includes('chrome-extension://') && !url.includes('home.html')) {
                    console.log(`Found pending MetaMask popup: ${url}`);
                    try {
                        await page.bringToFront();
                        // Try clicking any visible button
                        const buttons = ['Confirm', 'Sign', 'Next', 'Connect', 'Approve'];
                        for (const btnText of buttons) {
                            const btn = page.locator(`button:has-text("${btnText}")`).first();
                            if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                                console.log(`Clicking MetaMask button: ${btnText}`);
                                await btn.click();
                                await page.waitForTimeout(1000);
                            }
                        }
                    } catch (e) {
                        console.log(`MetaMask popup handling error: ${e}`);
                    }
                }
            }

            // Try refreshing the page
            if (attempt >= 2) {
                console.log('Trying page reload to refresh wallet state...');
                await dappPage.reload({ waitUntil: 'networkidle' });
                await dappPage.waitForTimeout(2000);
                await this.closeAllPopups();
            }
        }

        // Phase 2: Retry full MetaMask connection flow
        const fullRetries = 2;
        for (let fullAttempt = 1; fullAttempt <= fullRetries; fullAttempt++) {
            console.log(`\n🔄 RETRY ${fullAttempt}/${fullRetries}: Re-attempting full MetaMask connection flow...`);

            try {
                // Close any popups first
                await this.closeAllPopups();

                // Try using dappwright's built-in methods first
                try {
                    console.log('Trying wallet.approve()...');
                    await wallet.approve();
                    console.log('wallet.approve() succeeded');
                } catch (e) {
                    console.log('wallet.approve() skipped/failed (may already be connected)');
                }

                // Wait and check
                await dappPage.waitForTimeout(3000);
                const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
                let isLoginVisible = await loginButton.isVisible({ timeout: 2000 }).catch(() => false);

                if (!isLoginVisible) {
                    console.log('✅ Verification successful after wallet.approve(): Login button is NOT visible!');
                    await expect(loginButton).not.toBeVisible({ timeout: 5000 });
                    return;
                }

                // If still visible, try full login flow again
                console.log('Still visible, re-running full login flow...');
                await this.loginWithMetaMask();

                // Check if login button is now hidden
                await dappPage.waitForTimeout(3000);
                isLoginVisible = await loginButton.isVisible({ timeout: 2000 }).catch(() => false);

                if (!isLoginVisible) {
                    console.log('✅ Verification successful after retry: Login button is NOT visible!');
                    await expect(loginButton).not.toBeVisible({ timeout: 5000 });
                    console.log('✅ Test assertion passed: Login button is NOT visible!');
                    return;
                }

                console.log(`Login button still visible after full retry ${fullAttempt}/${fullRetries}`);
            } catch (error) {
                console.log(`⚠️ Full retry ${fullAttempt} failed: ${error}`);
            }
        }

        // Take screenshot before failing
        const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';
        await dappPage.screenshot({ path: `${outputDir}/login-button-still-visible.png` });
        console.log('❌ Screenshot saved: login-button-still-visible.png');

        throw new Error('Login button still visible after wallet connection (after multiple retries including full reconnection)');
    }
}