import { BrowserContext, Page, expect } from "@playwright/test";
import { Dappwright } from "@tenkeylabs/dappwright";
import { DOPAMINT_SELECTORS } from '../xpath/dopamintLogin';
import { getOtpFromGmail, clearOldOtpEmails } from '../helpers/gmailOtp';
import { authenticator } from 'otplib';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Get 2FA secret from environment (after loading env)
const GOOGLE_2FA_SECRET = process.env.GOOGLE_2FA_SECRET || '';

export class DopamintLoginPage {
    readonly context: BrowserContext;
    readonly wallet: Dappwright | null;
    page: Page | undefined;

    private readonly baseUrl = 'https://dev.dopamint.ai/';
    private readonly email = process.env.DOPAMINT_EMAIL!;
    private readonly password = process.env.DOPAMINT_PASSWORD!;

    constructor(context: BrowserContext, wallet: Dappwright | null = null) {
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
        if (!this.wallet) throw new Error("Wallet not initialized. MetaMask login requires wallet.");
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

    /**
     * Login with Email address using Thirdweb OTP
     * @param emailAddress - Email address to login with
     */
    async loginWithEmail(emailAddress: string): Promise<void> {
        if (!this.page) throw new Error("Page not initialized. Call navigateAndLogin first.");
        const dappPage = this.page;

        console.log('\n=== STEP 4: Login with Email (Thirdweb OTP) ===');
        console.log(`📧 Email: ${emailAddress}`);

        // Clear old OTP emails first to avoid confusion
        await clearOldOtpEmails(emailAddress);

        // Step 1: Click Login button
        console.log('Clicking Login button...');
        const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
        await expect(loginButton).toBeVisible({ timeout: 10000 });
        await loginButton.click();
        await dappPage.waitForTimeout(1500);

        // Step 2: Find and fill email input
        console.log('Filling email address...');
        let emailInput = dappPage.locator(DOPAMINT_SELECTORS.EMAIL_ADDRESS_INPUT).first();
        if (!await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Try alternative selector
            emailInput = dappPage.locator(DOPAMINT_SELECTORS.EMAIL_ADDRESS_INPUT_ALT).first();
        }
        await expect(emailInput).toBeVisible({ timeout: 10000 });
        await emailInput.fill(emailAddress);
        await dappPage.waitForTimeout(500);

        // Step 3: Click Next button (arrow icon)
        console.log('Clicking Next button...');
        await dappPage.waitForTimeout(1000);

        // Try multiple selectors for Next button (the -> arrow button next to email input)
        const nextButtonSelectors = [
            'button[type="submit"]',                           // Submit button
            'button:has(svg[stroke="currentColor"])',          // Button with arrow SVG
            'form button:has(svg)',                            // Button with SVG inside form
            'button[aria-label="Continue"]',                   // Continue button
            'button:has-text("→")',                            // Arrow text
            'div[role="dialog"] button:has(svg)',              // Button in dialog
            'input[type="email"] ~ button',                    // Button after email input
            'button:right-of(input[type="email"])',            // Button to the right of email
        ];

        let nextClicked = false;
        for (const selector of nextButtonSelectors) {
            try {
                const btn = dappPage.locator(selector).first();
                if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
                    console.log(`Found Next button with selector: ${selector}`);
                    await btn.click();
                    nextClicked = true;
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        // Fallback: Press Enter key to submit form
        if (!nextClicked) {
            console.log('Next button not found, pressing Enter to submit...');
            await emailInput.press('Enter');
            nextClicked = true;
        }

        // IMPORTANT: Record timestamp BEFORE clicking Next (when OTP is requested)
        const otpRequestTime = Date.now();
        console.log(`✅ Next button clicked at ${new Date(otpRequestTime).toISOString()}, waiting for OTP screen...`);

        // Step 4: Wait for verification code screen to appear
        await dappPage.waitForTimeout(2000);

        // Try multiple selectors to find OTP screen
        const otpScreenSelectors = [
            'text=Enter the verification code',
            'text=Verification code',
            'text=Enter code',
            'input[aria-label*="verification"]',
            'input[aria-label*="Digit"]',
            'input[placeholder*="code"]',
            'input[type="tel"]',  // OTP inputs are often type="tel"
        ];

        let otpScreenFound = false;
        for (const selector of otpScreenSelectors) {
            try {
                const element = dappPage.locator(selector).first();
                if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
                    console.log(`✅ OTP screen found with selector: ${selector}`);
                    otpScreenFound = true;
                    break;
                }
            } catch (e) {
                // Try next
            }
        }

        if (!otpScreenFound) {
            console.log('⚠️ OTP screen not detected, taking screenshot for debug...');
            const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';
            await dappPage.screenshot({ path: `${outputDir}/otp-screen-not-found.png` });
            console.log('Screenshot saved: otp-screen-not-found.png');
        }

        // Step 5: Get OTP from Gmail (only get emails AFTER otpRequestTime)
        console.log('Fetching OTP from Gmail...');
        const otp = await getOtpFromGmail(emailAddress, otpRequestTime, 90000, 3000);
        console.log(`✅ OTP received: ${otp}`);

        // Step 6: Find and fill OTP inputs
        console.log('Looking for OTP input fields...');

        // Try multiple OTP input selectors
        const otpInputSelectors = [
            'input[aria-label*="verification code"]',
            'input[aria-label*="Digit"]',
            'input[type="tel"]',
            'input[inputmode="numeric"]',
            'input[maxlength="1"]',
            'input[autocomplete="one-time-code"]',
        ];

        let otpInputs = null;
        let inputCount = 0;

        for (const selector of otpInputSelectors) {
            const inputs = dappPage.locator(selector);
            const count = await inputs.count();
            if (count >= 6) {
                console.log(`Found ${count} OTP inputs with selector: ${selector}`);
                otpInputs = inputs;
                inputCount = count;
                break;
            } else if (count > 0) {
                console.log(`Found ${count} inputs with selector: ${selector} (need 6)`);
            }
        }

        console.log(`Entering OTP code: ${otp}`);

        if (otpInputs && inputCount >= 6) {
            // Fill each digit separately
            for (let i = 0; i < 6; i++) {
                const input = otpInputs.nth(i);
                await input.click();
                await input.fill(otp[i]);
                await dappPage.waitForTimeout(150);
                console.log(`  Entered digit ${i + 1}: ${otp[i]}`);
            }
        } else {
            // Fallback: Click first input and type OTP using keyboard
            console.log('Using keyboard fallback to enter OTP...');

            // Find any visible input in the OTP area
            const anyInput = dappPage.locator('input[type="tel"], input[inputmode="numeric"], input[maxlength="1"]').first();
            if (await anyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await anyInput.click();
                await dappPage.waitForTimeout(300);
            }

            // Type OTP digit by digit
            for (const digit of otp) {
                await dappPage.keyboard.type(digit, { delay: 200 });
                console.log(`  Typed digit: ${digit}`);
            }
        }

        console.log('✅ OTP entered, waiting for verification...');

        // Step 7: Wait for auto-verification (Thirdweb auto-verifies after OTP entry)
        await dappPage.waitForTimeout(3000);

        // Check if login was successful (login button should disappear)
        const isLoggedIn = await this.isLoginButtonHidden();
        if (isLoggedIn) {
            console.log('✅ Email login successful!');
        } else {
            // Wait a bit more for verification
            await dappPage.waitForTimeout(5000);
            if (await this.isLoginButtonHidden()) {
                console.log('✅ Email login successful!');
            } else {
                throw new Error('Email login failed: Login button still visible after OTP verification');
            }
        }
    }

    /**
     * Login with Google OAuth
     * @param googleEmail - Google email address
     * @param googlePassword - Google password
     */
    async loginWithGoogle(googleEmail: string, googlePassword: string): Promise<void> {
if (!this.page) throw new Error("Page not initialized. Call navigateAndLogin first.");
    const dappPage = this.page;
    const context = this.context;

    console.log('\n=== STEP 4: Login with Google OAuth ===');
    console.log(`📧 Google Email: ${googleEmail}`);

    // Step 1: Click Login button
    console.log('Clicking Login button...');
    const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
    await expect(loginButton).toBeVisible({ timeout: 10000 });
    await loginButton.click();
    await dappPage.waitForTimeout(1500);

    // Step 2: Click Google login button (giữ logic tìm button tốt của bạn)
    console.log('Looking for Google login button...');

    let googleButtonClicked = false;

    // Cách 1: Trong dialog có text "Sign in" hoặc "Powered by"
    const signInDialog = dappPage.locator('div[role="dialog"], div:has-text("Sign in"), div:has-text("Powered by")').first();
    if (await signInDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Found Sign in dialog');
        const socialButtons = signInDialog.locator('button:has(svg)').first(); // Google thường là button đầu tiên có SVG
        if (await socialButtons.isVisible({ timeout: 3000 }).catch(() => false)) {
            await socialButtons.click();
            googleButtonClicked = true;
            console.log('Clicked Google button (first social button in dialog)');
        }
    }

    // Cách 2: Fallback bằng các selector khác
    if (!googleButtonClicked) {
        const fallbackSelectors = [
            'button:has(svg path[fill="#4285F4"])',     // Google blue
            'button:has(svg path[fill="#EA4335"])',     // Google red
            'button[aria-label*="Google" i]',
            'div[role="dialog"] button:first-child',
            'button:has(svg[width="24"][height="24"])'
        ];

        for (const selector of fallbackSelectors) {
            const btn = dappPage.locator(selector).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await btn.click();
                googleButtonClicked = true;
                console.log(`Clicked Google button with selector: ${selector}`);
                break;
            }
        }
    }

    // Cách 3: Last resort - tìm button có màu Google
    if (!googleButtonClicked) {
        const allButtons = dappPage.locator('button:has(svg)');
        const count = await allButtons.count();
        for (let i = 0; i < count; i++) {
            const btn = allButtons.nth(i);
            const html = await btn.innerHTML().catch(() => '');
            if (/(#4285F4|#EA4335|#FBBC05|#34A853)/.test(html)) {
                await btn.click();
                googleButtonClicked = true;
                console.log(`Clicked Google button at position ${i} (color detection)`);
                break;
            }
        }
    }

    if (!googleButtonClicked) {
        const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';
        await dappPage.screenshot({ path: `${outputDir}/google-button-not-found.png` });
        throw new Error('Google login button not found after all attempts');
    }

    console.log('✅ Google button clicked successfully, waiting for OAuth popup...');

    // Step 3: Bắt popup và xử lý login Google
    const [googlePopup] = await Promise.all([
        context.waitForEvent('page', { timeout: 30000 }),
        // Không cần thêm action vì click đã trigger popup
    ]);

    console.log(`Google OAuth popup opened: ${googlePopup.url()}`);
    await googlePopup.waitForLoadState('domcontentloaded');
    await googlePopup.waitForTimeout(1500);

    // Nhập email - selector chính xác từ trang Google hiện tại (2026)
    console.log('Entering email...');
    const emailInput = googlePopup.getByLabel('Email or phone').first();
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill(googleEmail);

    await googlePopup.getByRole('button', { name: 'Next' }).click();
    console.log('✅ Clicked Next after email');

    // Nhập password
    await googlePopup.waitForLoadState('networkidle', { timeout: 20000 });
    await googlePopup.waitForTimeout(2000);

    console.log('Entering password...');
    const passwordInput = googlePopup.getByLabel('Enter your password').or(
        googlePopup.locator('input[type="password"]')
    ).first();
    await expect(passwordInput).toBeVisible({ timeout: 15000 });
    await passwordInput.fill(googlePassword);

    // Click Next button after password - try multiple selectors
    const nextButtonSelectors = [
        googlePopup.getByRole('button', { name: 'Next' }),
        googlePopup.locator('button:has-text("Next")'),
        googlePopup.locator('#passwordNext'),
        googlePopup.locator('button[jsname="LgbsSe"]'),
        googlePopup.locator('div[role="button"]:has-text("Next")'),
    ];

    let nextClicked = false;
    for (const nextBtn of nextButtonSelectors) {
        if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await nextBtn.click();
            nextClicked = true;
            console.log('✅ Clicked Next after password');
            break;
        }
    }

    if (!nextClicked) {
        // Fallback: press Enter key
        await passwordInput.press('Enter');
        console.log('✅ Pressed Enter after password');
    }

    // Wait for popup to load 2FA screen
    console.log('Waiting for Google authentication to complete...');
    await googlePopup.waitForTimeout(2000);

    // Check if popup is still open and check for 2FA immediately
    if (googlePopup.isClosed()) {
        console.log('⚠️ Google popup closed - authentication may have completed');
    } else {
        console.log(`📍 Popup URL: ${googlePopup.url()}`);
    }

    // Check if 2FA screen appears - check URL pattern instead of text
    const popupUrl = googlePopup.isClosed() ? '' : googlePopup.url();
    const is2FAScreen = popupUrl.includes('/challenge/') || popupUrl.includes('2sv');
    console.log(`🔍 Checking 2FA: URL contains challenge = ${is2FAScreen}`);

    // Debug screenshot
    if (!googlePopup.isClosed()) {
        const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';
        await googlePopup.screenshot({ path: `${outputDir}/2fa-screen-debug.png` });
        console.log('📸 Screenshot saved: 2fa-screen-debug.png');
    }

    if (is2FAScreen) {
        console.log('🔐 2FA screen detected!');

        // URL /challenge/bc means backup code screen - need to switch to TOTP
        const isBackupCodeScreen = popupUrl.includes('/challenge/bc');

        if (isBackupCodeScreen) {
            console.log('📋 Backup code screen detected (URL: /challenge/bc), switching to Authenticator app...');

            // Click "Try another way" link to get other 2FA options
            const tryAnotherWay = googlePopup.locator('text=Try another way').or(
                googlePopup.locator('a:has-text("Try another way")')
            ).or(
                googlePopup.locator('text=Thử cách khác')
            ).first();

            await tryAnotherWay.scrollIntoViewIfNeeded().catch(() => {});

            if (await tryAnotherWay.isVisible({ timeout: 5000 }).catch(() => false)) {
                await tryAnotherWay.click();
                console.log('✅ Clicked "Try another way"');
                await googlePopup.waitForTimeout(2000);

                // Take screenshot of options
                const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';
                await googlePopup.screenshot({ path: `${outputDir}/2fa-options.png` });
                console.log('📸 2FA options screenshot saved');

                // Select "Google Authenticator" / "Get a verification code" option
                const authenticatorOption = googlePopup.locator('text=Google Authenticator').or(
                    googlePopup.locator('text=Get a verification code')
                ).or(
                    googlePopup.locator('text=Authenticator')
                ).or(
                    googlePopup.locator('text=Nhận mã xác minh')
                ).or(
                    googlePopup.locator('div[data-challengetype="6"]')  // TOTP challenge type
                ).first();

                if (await authenticatorOption.isVisible({ timeout: 5000 }).catch(() => false)) {
                    await authenticatorOption.click();
                    console.log('✅ Selected Authenticator app option');
                    await googlePopup.waitForTimeout(2000);
                } else {
                    console.log('⚠️ Authenticator option not found, listing available options...');
                    // Try to find any clickable option
                    const options = googlePopup.locator('li[data-challengeentry], div[role="link"]');
                    const count = await options.count();
                    console.log(`Found ${count} 2FA options`);
                }
            } else {
                console.log('⚠️ "Try another way" link not visible');
            }
        }

        if (GOOGLE_2FA_SECRET) {
            // Auto generate and enter 2FA code
            const totpCode = authenticator.generate(GOOGLE_2FA_SECRET);
            console.log(`🔑 Generated TOTP code: ${totpCode}`);
            console.log(`⏰ System time: ${new Date().toISOString()}`);
            console.log(`🔐 Secret key (first 4 chars): ${GOOGLE_2FA_SECRET.substring(0, 4)}...`);

            // Find and fill 2FA input (6-digit TOTP)
            const totpInput = googlePopup.locator('input[type="tel"]').or(
                googlePopup.locator('input[name="totpPin"]')
            ).or(
                googlePopup.locator('input[aria-label*="code"]')
            ).or(
                googlePopup.locator('input[aria-label*="Enter code"]')
            ).first();

            if (await totpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                // Try entering the code
                await totpInput.fill(totpCode);
                console.log('✅ TOTP code entered');

                // Click Next/Verify button
                const verifyBtn = googlePopup.getByRole('button', { name: /Next|Verify|Xác minh|Tiếp theo/i }).first();
                if (await verifyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await verifyBtn.click();
                    console.log('✅ Clicked Verify button');
                } else {
                    await totpInput.press('Enter');
                    console.log('✅ Pressed Enter to verify');
                }

                // Wait a moment for verification
                await googlePopup.waitForTimeout(3000);

                // Check if still on 2FA page (wrong code) - retry with different time windows
                if (!googlePopup.isClosed()) {
                    const stillOn2FA = googlePopup.url().includes('/challenge/');
                    const wrongCodeVisible = await googlePopup.locator('text=Wrong code').isVisible({ timeout: 1000 }).catch(() => false);

                    if (stillOn2FA || wrongCodeVisible) {
                        console.log('⚠️ First TOTP attempt failed, code may be wrong or secret key mismatch');
                        console.log('📱 Please check your Google Authenticator app and verify the secret key matches');

                        // Take screenshot for debugging
                        const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';
                        await googlePopup.screenshot({ path: `${outputDir}/totp-wrong-code.png` });
                        console.log('📸 Screenshot saved: totp-wrong-code.png');

                        // Wait for user to manually enter code (fallback)
                        console.log('⏳ Waiting for manual 2FA entry (2 minutes timeout)...');
                        await googlePopup.waitForEvent('close', { timeout: 120000 }).catch(() => {});
                    }
                }
            } else {
                console.log('⚠️ TOTP input not found, waiting for manual input...');
                await googlePopup.waitForEvent('close', { timeout: 120000 }).catch(() => {});
            }
        } else {
            console.log('⚠️ No 2FA secret configured. Please enter 2FA code manually...');
            // Wait for user to complete 2FA (max 2 minutes)
            await googlePopup.waitForEvent('close', { timeout: 120000 }).catch(() => {});
        }
    } else {
        // Handle màn hình Allow/Continue nếu có
        const allowBtn = googlePopup.getByRole('button', { name: /Allow|Continue|Cho phép|Tiếp tục/i }).first();
        if (await allowBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await allowBtn.click();
            console.log('Clicked Allow/Continue');
        }

        // Wait for popup to close
        await googlePopup.waitForEvent('close', { timeout: 30000 }).catch(() => {});
    }

    console.log('Google popup closed, verifying login...');

    // Wait for main page to update
    await dappPage.waitForTimeout(3000);
    await dappPage.bringToFront();

    // Verify login thành công
    if (!(await this.isLoginButtonHidden())) {
        // Try waiting more
        await dappPage.waitForTimeout(5000);
        if (!(await this.isLoginButtonHidden())) {
            throw new Error('Google login failed: Login button still visible after redirect');
        }
    }

    console.log('✅ Google OAuth login completed successfully!');
    }

    /**
     * Check if login button is hidden (user is logged in)
     */
    private async isLoginButtonHidden(): Promise<boolean> {
        if (!this.page) return false;
        const loginButton = this.page.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
        const isVisible = await loginButton.isVisible({ timeout: 1000 }).catch(() => false);
        return !isVisible;
    }

    async verifyLoginButtonHidden(): Promise<void> {
        if (!this.page) throw new Error("Page not initialized. Call navigateAndLogin first.");
        const dappPage = this.page;
        const wallet = this.wallet;
        const context = this.context;
        const hasWallet = wallet !== null;

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

            // Check if there are any pending MetaMask popups (only if wallet is available)
            if (hasWallet) {
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
            }

            // Try refreshing the page
            if (attempt >= 2) {
                console.log('Trying page reload to refresh wallet state...');
                await dappPage.reload({ waitUntil: 'networkidle' });
                await dappPage.waitForTimeout(2000);
                await this.closeAllPopups();
            }
        }

        // Phase 2: Retry full MetaMask connection flow (only if wallet is available)
        if (hasWallet && wallet) {
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
        }

        // Take screenshot before failing
        const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';
        await dappPage.screenshot({ path: `${outputDir}/login-button-still-visible.png` });
        console.log('❌ Screenshot saved: login-button-still-visible.png');

        throw new Error('Login button still visible after wallet connection (after multiple retries including full reconnection)');
    }
}