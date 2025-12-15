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

        // Handle MetaMask Connect
        console.log('Waiting for MetaMask Connect...');
        await wallet.approve();

        console.log('Waiting 3s before capturing Sign event...');
        await dappPage.waitForTimeout(3000);

        // Robust manual handling for Sign Popup
        console.log('Listening for Sign popup...');
        
        // Create a promise that resolves when the popup opens
        const popupPromise = context.waitForEvent('page', { timeout: 20000 }).catch(() => null);

        // If the popup is already open, we might miss the event, so we also check existing pages
        let signPopup = await popupPromise;
        
        if (!signPopup) {
            console.log('Could not capture new popup event, checking open pages...');
            for (const page of context.pages()) {
                // Strict filter: Must be notification.html (popup) NOT home.html (dashboard)
                if (page.url().includes('notification.html')) {
                    console.log('Found MetaMask popup (notification.html):', page.url());
                    signPopup = page;
                    break;
                }
            }
        }

        if (signPopup) {
            console.log('Captured Sign/Notification popup!');
            await signPopup.waitForLoadState();
            await signPopup.bringToFront();
            await signPopup.waitForTimeout(1000); // Wait for UI to stabilize

            // FORCE SCROLL DOWN: Use Mouse Wheel only (bypass LavaMoat security)
            console.log('Scrolling down to enable Sign button...');
            try {
                // Method 1: Click the down arrow button if it exists
                const arrowDown = signPopup.locator(DOPAMINT_SELECTORS.METAMASK_SCROLL_BUTTON);
                if (await arrowDown.isVisible()) {
                    await arrowDown.click();
                }
                
                // Method 2: Mouse wheel scroll (Safe from LavaMoat)
                await signPopup.mouse.move(100, 100);
                await signPopup.mouse.wheel(0, 2000);
                
                // Method 3: Keyboard PageDown (Safe from LavaMoat)
                await signPopup.keyboard.press('PageDown');
                await signPopup.keyboard.press('PageDown');
            } catch (e) {
                console.log('Error while scrolling:', e);
            }

            await signPopup.waitForTimeout(1000);

            // Try to find the Sign button with extensive selectors (English & Vietnamese)
            let clicked = false;
            for (const selector of DOPAMINT_SELECTORS.METAMASK_SIGN_BUTTONS) {
                const btn = signPopup.locator(selector).first();
                if (await btn.isVisible()) {
                    // Check if disabled
                    const isDisabled = await btn.isDisabled();
                    if (isDisabled) {
                        console.log(`Found button ${selector} but it is DISABLED. Trying to scroll more...`);
                        await signPopup.mouse.wheel(0, 2000); // Scroll more
                        await signPopup.waitForTimeout(1000);
                    }
                    
                    if (!await btn.isDisabled()) {
                        console.log(`Clicking Sign button with selector: ${selector}`);
                        await btn.click();
                        clicked = true;
                        break;
                    }
                }
            }

            if (!clicked) {
                console.log('Still cannot click Sign button! Printing content for debug:');
                const content = await signPopup.textContent('body');
                console.log('POPUP CONTENT:', content?.substring(0, 500) + '...'); // Log first 500 chars
                
                await signPopup.screenshot({ path: 'test-results/metamask-sign-fail-debug.png' });
            }
        } else {
            console.log('WARNING: No Sign popup window found!');
            // Fallback: Try wallet.sign() as a last resort
            try { await wallet.sign(); } catch(e) {}
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