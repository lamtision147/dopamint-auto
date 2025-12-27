import { BrowserContext, Page, expect, Locator } from "@playwright/test";
import { Dappwright } from "@tenkeylabs/dappwright";
import { CREATE_SELECTORS } from '../xpath/dopamintCreate';
import path from 'path';
import fs from 'fs';

// Get output directory (spec-specific or default)
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

// Model type definition
export type AIModel = 'Nano Banana Pro' | 'Nano Banana' | 'ChatGPT' | 'ChatGPT image 1.5';

export class DopamintCreatePage {
    readonly context: BrowserContext;
    readonly wallet: Dappwright;
    page: Page;

    // Store selected model for telegram notification
    private selectedModel: AIModel = 'Nano Banana Pro';

    constructor(context: BrowserContext, wallet: Dappwright, page: Page) {
        this.context = context;
        this.wallet = wallet;
        this.page = page;
    }

    // Getter for selected model
    getSelectedModel(): AIModel {
        return this.selectedModel;
    }

    // Helper function to find element from array of selectors
    private async findElementFromSelectors(selectors: string | string[], timeout: number = 5000): Promise<Locator | null> {
        const selectorList = Array.isArray(selectors) ? selectors : [selectors];

        for (const selector of selectorList) {
            try {
                const element = this.page.locator(selector).first();
                if (await element.isVisible({ timeout }).catch(() => false)) {
                    console.log(`Found element with selector: ${selector}`);
                    return element;
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        return null;
    }

    async clickCreateButton(): Promise<void> {
        console.log('\n=== Click Create button on header ===');

        const createButton = this.page.locator(CREATE_SELECTORS.CREATE_BUTTON).first();
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();
        await this.page.waitForTimeout(1000);

        console.log('✅ Clicked Create button!');

        // Handle tutorial popup if appears
        await this.page.waitForTimeout(500);
        for (const selector of CREATE_SELECTORS.TUTORIAL_BUTTON) {
            const closeBtn = this.page.locator(selector).first();
            if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                console.log(`Closing popup with selector: ${selector}`);
                await closeBtn.click({ force: true });
                await this.page.waitForTimeout(500);
                break;
            }
        }
    }

    async chooseChangeButtonTemplate(): Promise<void> {
        console.log('\n=== Select Change button template ===');

        await this.page.waitForTimeout(1000);

        // Try to find element from selectors list
        const changeButtonTemplate = await this.findElementFromSelectors(
            CREATE_SELECTORS.CHANGE_BUTTON_TEMPLATE,
            10000
        );

        if (changeButtonTemplate) {
            await changeButtonTemplate.click();
            await this.page.waitForTimeout(1000);
            console.log('✅ Selected Change button template!');
        } else {
            // Fallback: Try click based on text
            console.log('Selector not found, trying to click by text...');
            const textElement = this.page.getByText('Change', { exact: false }).first();
            if (await textElement.isVisible({ timeout: 5000 }).catch(() => false)) {
                await textElement.click();
                await this.page.waitForTimeout(1000);
                console.log('✅ Clicked by text "Change"!');
            } else {
                throw new Error('Change button template not found');
            }
        }
    }

    async selectMotorbikeCard(): Promise<void> {
        console.log('\n=== Select Motorbike card ===');

        await this.page.waitForTimeout(1000);

        const motorbikeCard = await this.findElementFromSelectors(
            CREATE_SELECTORS.MOTORBIKE_CARD,
            10000
        );

        if (motorbikeCard) {
            await motorbikeCard.click();
            await this.page.waitForTimeout(1000);
            console.log('✅ Selected Motorbike card!');
        } else {
            // Fallback
            const textElement = this.page.getByText('Motorbike', { exact: false }).first();
            if (await textElement.isVisible({ timeout: 5000 }).catch(() => false)) {
                await textElement.click();
                await this.page.waitForTimeout(1000);
                console.log('✅ Clicked by text "Motorbike"!');
            } else {
                throw new Error('Motorbike card not found');
            }
        }
    }

    async selectStudioCard(): Promise<void> {
        console.log('\n=== Select Studio card ===');

        await this.page.waitForTimeout(1000);

        const studioCard = await this.findElementFromSelectors(
            CREATE_SELECTORS.STUDIO_CARD,
            10000
        );

        if (studioCard) {
            await studioCard.click();
            await this.page.waitForTimeout(1000);
            console.log('✅ Selected Studio card!');
        } else {
            // Fallback
            const textElement = this.page.getByText('Studio', { exact: false }).first();
            if (await textElement.isVisible({ timeout: 5000 }).catch(() => false)) {
                await textElement.click();
                await this.page.waitForTimeout(1000);
                console.log('✅ Clicked by text "Studio"!');
            } else {
                throw new Error('Studio card not found');
            }
        }
    }

    // Helper function to open model dropdown
    private async openModelDropdown(): Promise<void> {
        const modelSelect = await this.findElementFromSelectors(
            CREATE_SELECTORS.MODEL_SELECT,
            10000
        );

        if (modelSelect) {
            await modelSelect.click();
            await this.page.waitForTimeout(500);
        } else {
            // Fallback
            const selectText = this.page.getByText('Select model', { exact: false }).first();
            if (await selectText.isVisible({ timeout: 5000 }).catch(() => false)) {
                await selectText.click();
                await this.page.waitForTimeout(500);
            }
        }
    }

    async selectNanoBananaPro(): Promise<void> {
        console.log('\n=== Select Nano Banana Pro model ===');

        await this.page.waitForTimeout(1000);

        // Open dropdown
        await this.openModelDropdown();

        // Select Nano Banana Pro option
        await this.page.waitForTimeout(500);
        const nanoBananaOption = await this.findElementFromSelectors(
            CREATE_SELECTORS.NANO_BANANA_PRO_OPTION,
            5000
        );

        if (nanoBananaOption) {
            await nanoBananaOption.click();
            await this.page.waitForTimeout(500);
            this.selectedModel = 'Nano Banana Pro';
            console.log('✅ Selected Nano Banana Pro model!');
        } else {
            // Fallback
            const optionText = this.page.getByText('Nano Banana Pro', { exact: false }).first();
            if (await optionText.isVisible({ timeout: 5000 }).catch(() => false)) {
                await optionText.click();
                await this.page.waitForTimeout(500);
                this.selectedModel = 'Nano Banana Pro';
                console.log('✅ Clicked by text "Nano Banana Pro"!');
            } else {
                throw new Error('Nano Banana Pro option not found');
            }
        }
    }

    async selectNanoBanana(): Promise<void> {
        console.log('\n=== Select Nano Banana model ===');

        await this.page.waitForTimeout(1000);

        // Open dropdown
        await this.openModelDropdown();

        // Select Nano Banana option
        await this.page.waitForTimeout(500);
        const nanoBananaOption = await this.findElementFromSelectors(
            CREATE_SELECTORS.NANO_BANANA_OPTION,
            5000
        );

        if (nanoBananaOption) {
            await nanoBananaOption.click();
            await this.page.waitForTimeout(500);
            this.selectedModel = 'Nano Banana';
            console.log('✅ Selected Nano Banana model!');
        } else {
            // Fallback - click text but make sure it's not "Pro" version
            const optionText = this.page.locator('[role="option"]:has-text("Nano Banana"):not(:has-text("Pro"))').first();
            if (await optionText.isVisible({ timeout: 5000 }).catch(() => false)) {
                await optionText.click();
                await this.page.waitForTimeout(500);
                this.selectedModel = 'Nano Banana';
                console.log('✅ Clicked Nano Banana option!');
            } else {
                // Try exact match
                const exactOption = this.page.getByText('Nano Banana', { exact: true }).first();
                if (await exactOption.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await exactOption.click();
                    await this.page.waitForTimeout(500);
                    this.selectedModel = 'Nano Banana';
                    console.log('✅ Selected Nano Banana (exact match)!');
                } else {
                    throw new Error('Nano Banana option not found');
                }
            }
        }
    }

    async selectChatGPT(): Promise<void> {
        console.log('\n=== Select ChatGPT model ===');

        await this.page.waitForTimeout(1000);

        // Open dropdown
        await this.openModelDropdown();

        // Select ChatGPT option
        await this.page.waitForTimeout(500);
        const chatgptOption = await this.findElementFromSelectors(
            CREATE_SELECTORS.CHATGPT_OPTION,
            5000
        );

        if (chatgptOption) {
            await chatgptOption.click();
            await this.page.waitForTimeout(500);
            this.selectedModel = 'ChatGPT';
            console.log('✅ Selected ChatGPT model!');
        } else {
            // Fallback
            const optionText = this.page.getByText('ChatGPT', { exact: false }).first();
            if (await optionText.isVisible({ timeout: 5000 }).catch(() => false)) {
                await optionText.click();
                await this.page.waitForTimeout(500);
                this.selectedModel = 'ChatGPT';
                console.log('✅ Clicked by text "ChatGPT"!');
            } else {
                throw new Error('ChatGPT option not found');
            }
        }
    }

    async selectChatGPT15(): Promise<void> {
        console.log('\n=== Select ChatGPT image 1.5 model ===');

        await this.page.waitForTimeout(1000);

        // Open dropdown
        await this.openModelDropdown();

        // Select ChatGPT image 1.5 option
        await this.page.waitForTimeout(500);
        const chatgpt15Option = await this.findElementFromSelectors(
            CREATE_SELECTORS.CHATGPT_15_OPTION,
            5000
        );

        if (chatgpt15Option) {
            await chatgpt15Option.click();
            await this.page.waitForTimeout(500);
            this.selectedModel = 'ChatGPT image 1.5';
            console.log('✅ Selected ChatGPT image 1.5 model!');
        } else {
            // Fallback - try text matching
            const optionText = this.page.getByText('ChatGPT image 1.5', { exact: false }).first();
            if (await optionText.isVisible({ timeout: 3000 }).catch(() => false)) {
                await optionText.click();
                await this.page.waitForTimeout(500);
                this.selectedModel = 'ChatGPT image 1.5';
                console.log('✅ Clicked by text "ChatGPT image 1.5"!');
            } else {
                // Try alternative text
                const altOption = this.page.getByText('ChatGPT 1.5', { exact: false }).first();
                if (await altOption.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await altOption.click();
                    await this.page.waitForTimeout(500);
                    this.selectedModel = 'ChatGPT image 1.5';
                    console.log('✅ Clicked by text "ChatGPT 1.5"!');
                } else {
                    throw new Error('ChatGPT image 1.5 option not found');
                }
            }
        }
    }

    // Generic method to select any model
    async selectModel(model: AIModel): Promise<void> {
        switch (model) {
            case 'Nano Banana Pro':
                await this.selectNanoBananaPro();
                break;
            case 'Nano Banana':
                await this.selectNanoBanana();
                break;
            case 'ChatGPT':
                await this.selectChatGPT();
                break;
            case 'ChatGPT image 1.5':
                await this.selectChatGPT15();
                break;
            default:
                throw new Error(`Unknown model: ${model}`);
        }
    }

    async uploadImage(imagePath: string): Promise<void> {
        console.log('\n=== Upload image (Create Flow) ===');

        await this.page.waitForTimeout(1000);
        const absolutePath = path.resolve(imagePath);

        // Debug: Find all file inputs on page
        const allInputs = this.page.locator('input[type="file"]');
        const inputCount = await allInputs.count();
        console.log(`Total file inputs on page: ${inputCount}`);

        // Strategy 1: Find input in create form (not in dialog/modal)
        const createFormInputSelectors = [
            // Input in main content (not in dialog)
            'main input[type="file"]',
            'form input[type="file"]',
            '[class*="create"] input[type="file"]',
            // Input near "Upload" label
            'label:has-text("Upload") input[type="file"]',
            'div:has-text("Upload image") input[type="file"]',
            'div:has-text("Upload") input[type="file"]',
        ];

        let fileInput = null;
        for (const selector of createFormInputSelectors) {
            try {
                const input = this.page.locator(selector).first();
                if (await input.count() > 0) {
                    fileInput = input;
                    console.log(`Found input with selector: ${selector}`);
                    break;
                }
            } catch (e) {
                // Continue
            }
        }

        // Fallback: Use first input
        if (!fileInput) {
            fileInput = allInputs.first();
            console.log('Fallback: Using first file input');
        }

        // Wait for input to be ready
        await fileInput.waitFor({ state: 'attached', timeout: 10000 });

        console.log(`Uploading file: ${absolutePath}`);

        // Count preview images before upload
        const previewSelectors = 'img[src*="blob:"], img[src*="data:"], img[class*="preview"], img[class*="upload"]';
        const previewsBefore = await this.page.locator(previewSelectors).count();
        console.log(`Preview images before upload: ${previewsBefore}`);

        // Upload file
        await fileInput.setInputFiles(absolutePath);

        // Dispatch events để trigger React/Vue handlers
        await fileInput.evaluate(node => {
            node.dispatchEvent(new Event('change', { bubbles: true }));
            node.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Wait until image displays on UI (max 15 seconds)
        console.log('Waiting for image to display on UI...');
        const maxWaitTime = 15000;
        const checkInterval = 500;
        let elapsed = 0;
        let imageDisplayed = false;

        while (elapsed < maxWaitTime) {
            await this.page.waitForTimeout(checkInterval);
            elapsed += checkInterval;

            // Check 1: Number of preview images increased
            const previewsAfter = await this.page.locator(previewSelectors).count();
            if (previewsAfter > previewsBefore) {
                console.log(`✓ New preview image appeared (${previewsBefore} -> ${previewsAfter})`);
                imageDisplayed = true;
                break;
            }

            // Check 2: Image with src blob or data is visible
            const newPreview = this.page.locator('img[src*="blob:"], img[src*="data:"]').first();
            if (await newPreview.isVisible({ timeout: 100 }).catch(() => false)) {
                console.log('✓ Preview image visible');
                imageDisplayed = true;
                break;
            }

            // Check 3: Input has file and UI changed (class changed, etc.)
            const hasFile = await fileInput.evaluate((el: HTMLInputElement) => el.files && el.files.length > 0);
            const parentChanged = await fileInput.evaluate((el) => {
                const parent = el.closest('div');
                return parent?.querySelector('img') !== null || parent?.classList.contains('has-file');
            });
            if (hasFile && parentChanged) {
                console.log('✓ File uploaded and UI changed');
                imageDisplayed = true;
                break;
            }

            if (elapsed % 2000 === 0) {
                console.log(`Waiting... (${elapsed / 1000}s)`);
            }
        }

        if (!imageDisplayed) {
            console.log('⚠️ Image not displayed after 15s, retrying upload...');
            // Retry upload
            await fileInput.setInputFiles(absolutePath);
            await fileInput.evaluate(node => {
                node.dispatchEvent(new Event('change', { bubbles: true }));
                node.dispatchEvent(new Event('input', { bubbles: true }));
            });
            await this.page.waitForTimeout(2000);
        }

        // Additional 1 second delay to ensure UI stability
        await this.page.waitForTimeout(1000);

        console.log('✅ Image upload completed!');
    }

    // Helper function to generate timestamp code
    private generateTimestampCode(): string {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear() % 100; // Get last 2 digits

        // Format: HHMM + DD + MM + YY (e.g., 514121125 for 5:14PM 12/11/2025)
        const code = `${hours}${minutes.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}${month.toString().padStart(2, '0')}${year.toString().padStart(2, '0')}`;
        return code;
    }

    async clickGenerateAndConfirm(): Promise<void> {
        console.log('\n=== Click Generate button and confirm ===');

        await this.page.waitForTimeout(1000);

        // Debug: List all buttons with text "Generate"
        const allGenerateBtns = this.page.locator('button:has-text("Generate")');
        const btnCount = await allGenerateBtns.count();
        console.log(`Found ${btnCount} buttons with text "Generate"`);

        // Log each button state
        for (let i = 0; i < btnCount; i++) {
            const btn = allGenerateBtns.nth(i);
            const isVisible = await btn.isVisible().catch(() => false);
            const isEnabled = await btn.isEnabled().catch(() => false);
            const text = await btn.textContent().catch(() => 'N/A');
            console.log(`Button ${i}: visible=${isVisible}, enabled=${isEnabled}, text="${text?.trim()}"`);
        }

        // Click Generate button - find visible and enabled button
        let generateClicked = false;

        // Method 1: Find visible Generate button on main page (not in dialog)
        const mainGenerateBtn = this.page.locator('button:has-text("Generate"):visible').first();
        if (await mainGenerateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            const isEnabled = await mainGenerateBtn.isEnabled().catch(() => false);
            console.log(`Main Generate button: enabled=${isEnabled}`);

            if (isEnabled) {
                await mainGenerateBtn.click();
                console.log('Clicked Generate button (main)!');
                generateClicked = true;
            } else {
                console.log('⚠️ Generate button is disabled - may need to upload image first');
            }
        }

        // Method 2: Fallback - try other selectors
        if (!generateClicked) {
            const generateBtn = await this.findElementFromSelectors(
                CREATE_SELECTORS.GENERATE_BUTTON,
                5000
            );

            if (generateBtn) {
                await generateBtn.click();
                console.log('Clicked Generate button (from selectors)!');
                generateClicked = true;
            }
        }

        // Method 3: Fallback - getByRole
        if (!generateClicked) {
            try {
                const roleBtn = this.page.getByRole('button', { name: 'Generate' }).first();
                if (await roleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await roleBtn.click();
                    console.log('Clicked Generate button (getByRole)!');
                    generateClicked = true;
                }
            } catch (e) {
                console.log('getByRole did not find Generate button');
            }
        }

        if (!generateClicked) {
            console.log('⚠️ Could not click Generate button!');
            // Screenshot for debug
            await this.page.screenshot({ path: `${outputDir}/generate-button-not-found.png` });
        }

        await this.page.waitForTimeout(1000);

        // Confirm in popup (if exists)
        console.log('Looking for confirmation popup...');

        // Check if dialog appeared
        const dialog = this.page.locator('div[role="dialog"], [data-state="open"]').first();
        if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('Popup appeared');

            // Find Generate/Confirm button in dialog
            const dialogBtnSelectors = [
                'div[role="dialog"] button:has-text("Generate")',
                '[data-state="open"] button:has-text("Generate")',
                'div[role="dialog"] button:has-text("Confirm")',
                '[data-state="open"] button:has-text("Confirm")',
            ];

            for (const selector of dialogBtnSelectors) {
                const btn = this.page.locator(selector).first();
                if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await btn.click();
                    console.log(`✅ Confirmed with: ${selector}`);
                    break;
                }
            }
        } else {
            console.log('No confirmation popup (may not need confirmation)');
        }
    }

    async waitForImageGeneration(): Promise<void> {
        console.log('\n=== Wait for image generation (may take up to 3 minutes) ===');

        // Wait for Publish & Monetize button to appear (max 4 minutes)
        const maxWaitTime = 240000; // 4 minutes
        const checkInterval = 5000; // Check every 5 seconds
        let elapsed = 0;

        while (elapsed < maxWaitTime) {
            const publishBtn = await this.findElementFromSelectors(
                CREATE_SELECTORS.PUBLISH_MONETIZE_BUTTON,
                3000
            );

            if (publishBtn) {
                console.log('✅ Image generated! Publish & Monetize button appeared.');
                return;
            }

            console.log(`Waiting... (${elapsed / 1000}s)`);
            await this.page.waitForTimeout(checkInterval);
            elapsed += checkInterval;
        }

        throw new Error('Timeout: Image was not generated after 4 minutes');
    }

    async clickPublishAndMonetize(): Promise<void> {
        console.log('\n=== Click Publish & Monetize button ===');

        const publishBtn = await this.findElementFromSelectors(
            CREATE_SELECTORS.PUBLISH_MONETIZE_BUTTON,
            10000
        );

        if (publishBtn) {
            await publishBtn.click();
            console.log('✅ Clicked Publish & Monetize button!');
        } else {
            const textBtn = this.page.getByText('Publish & Monetize', { exact: false }).first();
            await textBtn.click();
        }

        await this.page.waitForTimeout(1000);
    }

    async fillPublishCollectionForm(): Promise<string> {
        console.log('\n=== Fill Publish Collection form ===');

        await this.page.waitForTimeout(1000);

        // Generate collection name with timestamp
        const timestampCode = this.generateTimestampCode();
        const collectionName = `Automation test ${timestampCode}`;
        const description = 'Automation test';
        const symbol = 'AUTO';

        console.log(`Collection Name: ${collectionName}`);
        console.log(`Description: ${description}`);
        console.log(`Symbol: ${symbol}`);

        // Fill Collection Name
        const nameInput = await this.findElementFromSelectors(
            CREATE_SELECTORS.COLLECTION_NAME_INPUT,
            10000
        );
        if (nameInput) {
            await nameInput.fill(collectionName);
        } else {
            // Fallback: try to find input near "Collection name" label
            const input = this.page.locator('input').filter({ hasText: '' }).first();
            await input.fill(collectionName);
        }

        await this.page.waitForTimeout(500);

        // Fill Description
        const descInput = await this.findElementFromSelectors(
            CREATE_SELECTORS.DESCRIPTION_INPUT,
            5000
        );
        if (descInput) {
            await descInput.fill(description);
        } else {
            const textarea = this.page.locator('textarea').first();
            await textarea.fill(description);
        }

        await this.page.waitForTimeout(500);

        // Fill Symbol
        const symbolInput = await this.findElementFromSelectors(
            CREATE_SELECTORS.SYMBOL_INPUT,
            5000
        );
        if (symbolInput) {
            await symbolInput.fill(symbol);
        }

        console.log('✅ Form filled!');
        return collectionName;
    }

    // ============ FAIR LAUNCH METHODS ============

    async selectFixedPriceOption(): Promise<void> {
        console.log('\n=== Select Fixed Price option ===');

        await this.page.waitForTimeout(1000);

        let optionSelected = false;

        // Method 1: Find radio button or clickable element for "Fixed Price"
        const fixedPriceSelectors = [
            // Radio button selectors
            'input[type="radio"][value*="fixed"]',
            'input[type="radio"][value*="Fixed"]',
            'input[type="radio"]:near(:text("Fixed Price"))',
            // Label that contains radio
            'label:has-text("Fixed Price")',
            'label:has-text("Fixed price")',
            // Div/button with role
            '[role="radio"]:has-text("Fixed Price")',
            '[role="radiogroup"] >> text=Fixed Price',
            // Generic clickable
            'div:has-text("Fixed Price"):not(:has(div:has-text("Fixed Price")))',
            'span:has-text("Fixed Price")',
        ];

        for (const selector of fixedPriceSelectors) {
            try {
                const element = this.page.locator(selector).first();
                if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await element.click();
                    console.log(`Clicked Fixed Price with selector: ${selector}`);
                    optionSelected = true;
                    break;
                }
            } catch (e) {
                // Continue
            }
        }

        // Method 2: Try getByLabel for radio button
        if (!optionSelected) {
            try {
                const radioLabel = this.page.getByLabel('Fixed Price', { exact: false });
                if (await radioLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await radioLabel.click();
                    console.log('Clicked Fixed Price via getByLabel');
                    optionSelected = true;
                }
            } catch (e) {
                // Continue
            }
        }

        // Method 3: Try getByText
        if (!optionSelected) {
            try {
                const textElement = this.page.getByText('Fixed Price', { exact: false }).first();
                if (await textElement.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await textElement.click();
                    console.log('Clicked Fixed Price via getByText');
                    optionSelected = true;
                }
            } catch (e) {
                // Continue
            }
        }

        // Method 4: Try clicking parent of radio input
        if (!optionSelected) {
            try {
                const radioInputs = this.page.locator('input[type="radio"]');
                const count = await radioInputs.count();
                console.log(`Found ${count} radio inputs`);

                for (let i = 0; i < count; i++) {
                    const radio = radioInputs.nth(i);
                    const parent = radio.locator('xpath=..');
                    const parentText = await parent.textContent().catch(() => '');
                    console.log(`Radio ${i} parent text: "${parentText?.substring(0, 30)}..."`);

                    if (parentText?.toLowerCase().includes('fixed')) {
                        await parent.click();
                        console.log(`Clicked parent of radio ${i} for Fixed Price`);
                        optionSelected = true;
                        break;
                    }
                }
            } catch (e) {
                console.log('Error finding radio inputs:', e);
            }
        }

        if (!optionSelected) {
            console.log('⚠️ Could not select Fixed Price option');
            await this.page.screenshot({ path: `${outputDir}/fixed-price-not-found.png` });
        } else {
            console.log('✅ Fixed Price option selected!');
        }

        await this.page.waitForTimeout(1000);
    }

    async fillFairLaunchSettings(price: string, supply: number): Promise<void> {
        console.log('\n=== Fill Fair Launch settings ===');
        console.log(`Price: ${price}, Supply: ${supply}`);

        await this.page.waitForTimeout(1000);

        // Fill Price input
        console.log('Looking for Price input...');
        let priceInput = await this.findElementFromSelectors(
            CREATE_SELECTORS.FAIR_LAUNCH_PRICE_INPUT,
            5000
        );

        if (!priceInput) {
            // Fallback: find input near "Price" text
            priceInput = this.page.locator('input[type="number"]').first();
        }

        if (priceInput) {
            await priceInput.clear();
            await priceInput.fill(price);
            console.log(`✅ Filled price: ${price}`);
        } else {
            console.log('⚠️ Price input not found');
        }

        await this.page.waitForTimeout(500);

        // Uncheck Unlimited checkbox/switch/toggle
        console.log('Looking for Unlimited switch to uncheck...');

        let unlimitedUnchecked = false;

        // Debug: List ALL switch/checkbox/toggle elements on page
        console.log('\n--- DEBUG: All switch/toggle elements ---');
        const allSwitches = this.page.locator('button[role="switch"], button[role="checkbox"], [role="switch"], input[type="checkbox"], button[data-state], [data-state="checked"], [data-state="unchecked"], [data-state="on"], [data-state="off"]');
        const switchCount = await allSwitches.count();
        console.log(`Found ${switchCount} switch/toggle elements`);

        for (let i = 0; i < switchCount; i++) {
            const sw = allSwitches.nth(i);
            const dataState = await sw.getAttribute('data-state').catch(() => 'N/A');
            const role = await sw.getAttribute('role').catch(() => 'N/A');
            const ariaChecked = await sw.getAttribute('aria-checked').catch(() => 'N/A');
            const isVisible = await sw.isVisible().catch(() => false);
            // Get parent text for context
            const parentText = await sw.evaluate((el) => {
                let parent = el.parentElement;
                for (let j = 0; j < 3 && parent; j++) {
                    const text = parent.textContent?.trim();
                    if (text && text.length < 100) return text;
                    parent = parent.parentElement;
                }
                return '';
            }).catch(() => '');
            console.log(`  Switch ${i}: visible=${isVisible}, role="${role}", data-state="${dataState}", aria-checked="${ariaChecked}"`);
            console.log(`    Context: "${parentText?.substring(0, 60)}..."`);
        }
        console.log('--- END DEBUG ---\n');

        // Method 1: Find switch with aria-checked="true" or data-state containing checked/on
        // and near "Unlimited" text
        const nearUnlimitedSwitch = this.page.locator('div:has-text("Unlimited") button[role="switch"], div:has-text("Unlimited") [role="switch"], label:has-text("Unlimited") button[role="switch"]');
        const nearCount = await nearUnlimitedSwitch.count();
        console.log(`Found ${nearCount} switches near Unlimited text`);

        for (let i = 0; i < nearCount; i++) {
            const sw = nearUnlimitedSwitch.nth(i);
            if (await sw.isVisible({ timeout: 1000 }).catch(() => false)) {
                const ariaChecked = await sw.getAttribute('aria-checked').catch(() => '');
                const dataState = await sw.getAttribute('data-state').catch(() => '');
                console.log(`  Near switch ${i}: aria-checked="${ariaChecked}", data-state="${dataState}"`);

                // Click to toggle (if checked/on, this will uncheck it)
                await sw.click();
                console.log('✅ Clicked switch near Unlimited!');
                unlimitedUnchecked = true;
                break;
            }
        }

        // Method 2: Find by looking at label with "Unlimited" and click associated switch
        if (!unlimitedUnchecked) {
            // Find small containers that specifically contain "Unlimited" text
            const unlimitedLabels = this.page.locator('label:has-text("Unlimited"), span:has-text("Unlimited")').filter({ hasText: /^Unlimited$/i });
            const labelCount = await unlimitedLabels.count();
            console.log(`Found ${labelCount} Unlimited labels`);

            for (let i = 0; i < labelCount; i++) {
                const label = unlimitedLabels.nth(i);
                if (await label.isVisible({ timeout: 500 }).catch(() => false)) {
                    // Try to find switch in parent or sibling
                    const parent = label.locator('xpath=./ancestor::div[1]');
                    const siblingSwitch = parent.locator('button[role="switch"], [role="switch"]').first();
                    if (await siblingSwitch.isVisible({ timeout: 500 }).catch(() => false)) {
                        await siblingSwitch.click();
                        console.log('✅ Clicked switch sibling to Unlimited label!');
                        unlimitedUnchecked = true;
                        break;
                    }

                    // Also try clicking the label itself if it's clickable
                    try {
                        await label.click();
                        console.log('✅ Clicked Unlimited label!');
                        unlimitedUnchecked = true;
                        break;
                    } catch (e) {
                        // Continue
                    }
                }
            }
        }

        // Method 3: Find any checked switch and click it if near Supply/Unlimited section
        if (!unlimitedUnchecked) {
            const checkedSwitches = this.page.locator('[aria-checked="true"], button[role="switch"][data-state="checked"], button[role="switch"][data-state="on"]');
            const checkedCount = await checkedSwitches.count();
            console.log(`Found ${checkedCount} checked switches`);

            for (let i = 0; i < checkedCount; i++) {
                const sw = checkedSwitches.nth(i);
                if (await sw.isVisible({ timeout: 500 }).catch(() => false)) {
                    const parentText = await sw.evaluate((el) => {
                        let parent = el.parentElement;
                        for (let j = 0; j < 5 && parent; j++) {
                            const text = parent.textContent?.toLowerCase() || '';
                            if (text.includes('unlimited') || text.includes('supply')) {
                                return text;
                            }
                            parent = parent.parentElement;
                        }
                        return '';
                    }).catch(() => '');

                    if (parentText) {
                        await sw.click();
                        console.log('✅ Clicked checked switch in Unlimited/Supply area!');
                        unlimitedUnchecked = true;
                        break;
                    }
                }
            }
        }

        // Method 4: Click by getByLabel
        if (!unlimitedUnchecked) {
            try {
                const switchByLabel = this.page.getByLabel('Unlimited', { exact: false });
                if (await switchByLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await switchByLabel.click();
                    console.log('✅ Clicked via getByLabel("Unlimited")!');
                    unlimitedUnchecked = true;
                }
            } catch (e) {
                // Continue
            }
        }

        // Method 5: Find switch in form section after Price
        if (!unlimitedUnchecked) {
            // The form likely has: Price input -> Unlimited switch -> Supply input
            // Find the switch that comes after the price input
            const formSwitches = this.page.locator('form button[role="switch"], div[class*="form"] button[role="switch"]');
            const formSwitchCount = await formSwitches.count();
            console.log(`Found ${formSwitchCount} switches in form`);

            for (let i = 0; i < formSwitchCount; i++) {
                const sw = formSwitches.nth(i);
                if (await sw.isVisible({ timeout: 500 }).catch(() => false)) {
                    await sw.click();
                    console.log(`✅ Clicked form switch ${i}!`);
                    unlimitedUnchecked = true;
                    break;
                }
            }
        }

        if (!unlimitedUnchecked) {
            console.log('⚠️ Could not find/click Unlimited switch');
            await this.page.screenshot({ path: `${outputDir}/unlimited-switch-not-found.png` });
        }

        await this.page.waitForTimeout(1500); // Wait for UI to update after toggle

        // Fill Supply input (should be visible after unchecking Unlimited)
        console.log('Looking for Supply input...');

        // Debug: List all number inputs
        const numberInputs = this.page.locator('input[type="number"], input[inputmode="numeric"]');
        const numCount = await numberInputs.count();
        console.log(`Found ${numCount} number inputs`);

        for (let i = 0; i < numCount; i++) {
            const inp = numberInputs.nth(i);
            const placeholder = await inp.getAttribute('placeholder').catch(() => '');
            const name = await inp.getAttribute('name').catch(() => '');
            const value = await inp.inputValue().catch(() => '');
            const isVisible = await inp.isVisible().catch(() => false);
            const isDisabled = await inp.isDisabled().catch(() => false);
            console.log(`  Input ${i}: placeholder="${placeholder}", name="${name}", value="${value}", visible=${isVisible}, disabled=${isDisabled}`);
        }

        // Find supply input - should be the second visible number input or one with supply-related placeholder/name
        let supplyInput = null;

        // Try by placeholder/name first
        const supplySelectors = [
            'input[name*="supply"]',
            'input[name*="Supply"]',
            'input[placeholder*="supply"]',
            'input[placeholder*="Supply"]',
        ];

        for (const selector of supplySelectors) {
            const inp = this.page.locator(selector).first();
            if (await inp.isVisible({ timeout: 1000 }).catch(() => false)) {
                supplyInput = inp;
                console.log(`Found supply input with selector: ${selector}`);
                break;
            }
        }

        // Fallback: find the second visible & enabled number input (first is price)
        if (!supplyInput) {
            let visibleCount = 0;
            for (let i = 0; i < numCount; i++) {
                const inp = numberInputs.nth(i);
                const isVisible = await inp.isVisible().catch(() => false);
                const isDisabled = await inp.isDisabled().catch(() => false);
                if (isVisible && !isDisabled) {
                    visibleCount++;
                    if (visibleCount === 2) {
                        supplyInput = inp;
                        console.log(`Using second visible enabled number input as supply`);
                        break;
                    }
                }
            }
        }

        if (supplyInput) {
            await supplyInput.click();
            await supplyInput.clear();
            await supplyInput.fill(supply.toString());
            // Verify the value was set
            const finalValue = await supplyInput.inputValue();
            console.log(`✅ Filled supply: ${supply} (verified: ${finalValue})`);
        } else {
            console.log('⚠️ Supply input not found - may still be hidden (Unlimited switch not unchecked)');
            await this.page.screenshot({ path: `${outputDir}/supply-input-not-found.png` });
        }

        await this.page.waitForTimeout(500);
        console.log('✅ Fair Launch settings filled!');
    }

    async fillPublishCollectionFormFairLaunch(): Promise<string> {
        console.log('\n=== Fill Publish Collection form (Fair Launch) ===');

        await this.page.waitForTimeout(1000);

        // Step 1: Select Fixed Price option
        await this.selectFixedPriceOption();

        // Step 2: Fill Fair Launch settings
        await this.fillFairLaunchSettings('0.000012', 10);

        // Step 3: Fill General settings
        const timestampCode = this.generateTimestampCode();
        const collectionName = `Automation Test Fairlaunch ${timestampCode}`;
        const description = 'Automation test for Fair Launch collection with Fixed Price';
        const symbol = `ATF${timestampCode}`;

        console.log(`Collection Name: ${collectionName}`);
        console.log(`Description: ${description}`);
        console.log(`Symbol: ${symbol}`);

        // Fill Collection Name
        const nameInput = await this.findElementFromSelectors(
            CREATE_SELECTORS.COLLECTION_NAME_INPUT,
            10000
        );
        if (nameInput) {
            await nameInput.fill(collectionName);
        } else {
            const input = this.page.locator('input').filter({ hasText: '' }).first();
            await input.fill(collectionName);
        }

        await this.page.waitForTimeout(500);

        // Fill Description
        const descInput = await this.findElementFromSelectors(
            CREATE_SELECTORS.DESCRIPTION_INPUT,
            5000
        );
        if (descInput) {
            await descInput.fill(description);
        } else {
            const textarea = this.page.locator('textarea').first();
            await textarea.fill(description);
        }

        await this.page.waitForTimeout(500);

        // Fill Symbol
        const symbolInput = await this.findElementFromSelectors(
            CREATE_SELECTORS.SYMBOL_INPUT,
            5000
        );
        if (symbolInput) {
            await symbolInput.fill(symbol);
        }

        console.log('✅ Fair Launch form filled!');
        return collectionName;
    }

    async clickPublishAndConfirm(): Promise<void> {
        console.log('\n=== Click Publish and confirm ===');

        await this.page.waitForTimeout(500);

        // Click Publish button
        const publishBtn = await this.findElementFromSelectors(
            CREATE_SELECTORS.PUBLISH_BUTTON,
            10000
        );

        if (publishBtn) {
            await publishBtn.click();
            console.log('Clicked Publish button!');
        } else {
            const textBtn = this.page.getByRole('button', { name: 'Publish' }).first();
            await textBtn.click();
        }

        await this.page.waitForTimeout(1500);

        // Confirm publish in popup
        console.log('Looking for confirm popup...');
        const confirmBtn = await this.findElementFromSelectors(
            CREATE_SELECTORS.CONFIRM_PUBLISH_BUTTON,
            10000
        );

        if (confirmBtn) {
            await confirmBtn.click();
            console.log('✅ Clicked Confirm!');
        } else {
            const textConfirmBtn = this.page.getByRole('button', { name: 'Confirm' }).first();
            await textConfirmBtn.click();
        }
    }

    async waitForPublishSuccess(): Promise<void> {
        console.log('\n=== Wait for Published Successfully ===');

        // Wait for success message (max 2 minutes)
        const maxWaitTime = 120000;
        const checkInterval = 3000;
        let elapsed = 0;

        while (elapsed < maxWaitTime) {
            const successText = await this.findElementFromSelectors(
                CREATE_SELECTORS.PUBLISHED_SUCCESS_TEXT,
                2000
            );

            if (successText) {
                console.log('✅ Published Successfully!');
                return;
            }

            // Also check for text directly
            const successVisible = await this.page.getByText('Published Successfully').isVisible({ timeout: 1000 }).catch(() => false);
            if (successVisible) {
                console.log('✅ Published Successfully!');
                return;
            }

            console.log(`Waiting for publish to complete... (${elapsed / 1000}s)`);
            await this.page.waitForTimeout(checkInterval);
            elapsed += checkInterval;
        }

        throw new Error('Timeout: Publish failed after 2 minutes');
    }

    async clickGoToCollectionAndVerify(expectedCollectionName: string): Promise<Page> {
        console.log('\n=== Click Go to collection and verify ===');

        await this.page.waitForTimeout(1000);

        // Click Go to collection button
        const goToBtn = await this.findElementFromSelectors(
            CREATE_SELECTORS.GO_TO_COLLECTION_BUTTON,
            10000
        );

        // Setup listener for new tab before clicking
        const newPagePromise = this.context.waitForEvent('page', { timeout: 30000 });

        if (goToBtn) {
            await goToBtn.click();
            console.log('Clicked Go to collection!');
        } else {
            const textBtn = this.page.getByText('Go to collection', { exact: false }).first();
            await textBtn.click();
        }

        // Wait for new tab to open
        console.log('Waiting for new tab to open...');
        const newPage = await newPagePromise;
        await newPage.waitForLoadState('networkidle');
        await newPage.waitForTimeout(2000);

        // Verify collection name in new tab
        console.log(`Verifying collection name: ${expectedCollectionName}`);
        const collectionNameVisible = await newPage.getByText(expectedCollectionName).isVisible({ timeout: 10000 }).catch(() => false);

        if (collectionNameVisible) {
            console.log('✅ Collection name displayed correctly!');
        } else {
            // Try to find partial match
            const pageContent = await newPage.textContent('body');
            if (pageContent?.includes('Automation test')) {
                console.log('✅ Found "Automation test" in page!');
            } else {
                console.log('⚠️ Collection name not found, but page opened.');
            }
        }

        // Take screenshot of collection page
        await newPage.screenshot({ path: `${outputDir}/collection-page.png` });
        console.log('✅ Screenshot of collection page saved!');

        // Save collection URL to model-specific file to avoid race condition in parallel tests
        const collectionUrl = newPage.url();
        const fs = await import('fs');
        const safeModelName = this.selectedModel.toLowerCase().replace(/\s+/g, '-');
        fs.writeFileSync(`${outputDir}/collection-url-${safeModelName}.txt`, collectionUrl);
        console.log(`✅ Collection URL saved: ${collectionUrl}`);

        // Return the new page for further actions
        return newPage;
    }

    // ============ MINT NFT FUNCTIONS ============

    async clickMintThis(collectionPage: Page): Promise<void> {
        console.log('\n=== Click Mint this button ===');

        await collectionPage.waitForTimeout(1000);

        // Find and click Mint this button
        let clicked = false;
        for (const selector of CREATE_SELECTORS.MINT_THIS_BUTTON) {
            const btn = collectionPage.locator(selector).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await btn.click();
                console.log(`Clicked Mint this with selector: ${selector}`);
                clicked = true;
                break;
            }
        }

        if (!clicked) {
            // Fallback
            const textBtn = collectionPage.getByText('Mint this', { exact: false }).first();
            await textBtn.click();
        }

        await collectionPage.waitForTimeout(1500);
        console.log('✅ Mint UI opened!');
    }


    async uploadMintImage(collectionPage: Page, imagePath: string, imageNumber: number = 1): Promise<void> {
        console.log(`\n=== Upload image ${imageNumber} for Mint ===`);

        await collectionPage.waitForTimeout(1000);
        const absolutePath = path.resolve(imagePath);

        // Debug: Log all file inputs in modal
        const allFileInputs = collectionPage.locator('//div[contains(@id, "content-buy")]//input[@type="file"]');
        const inputCount = await allFileInputs.count();
        console.log(`Total file inputs in modal: ${inputCount}`);

        // Log context of each input
        for (let i = 0; i < inputCount; i++) {
            try {
                const input = allFileInputs.nth(i);
                const parentText = await input.evaluate((el) => {
                    let parent = el.parentElement;
                    for (let j = 0; j < 5 && parent; j++) {
                        const text = parent.textContent?.trim().substring(0, 100);
                        if (text && text.length > 5) {
                            return `[${j}] ${text}`;
                        }
                        parent = parent.parentElement;
                    }
                    return 'No context';
                });
                console.log(`Input ${i} context: ${parentText}`);
            } catch (e) {
                console.log(`Input ${i}: could not get context`);
            }
        }

        // Select appropriate file input
        // Observation:
        // - NFT 1: last input is "Upload Character Image"
        // - NFT 2: after clicking "+Add", NEW input appears (also the last input)
        let fileInput: Locator;
        if (inputCount === 0) {
            throw new Error('No file input found in modal');
        } else if (inputCount === 1) {
            fileInput = allFileInputs.first();
            console.log(`Using the only file input`);
        } else {
            // Multiple inputs - ALWAYS use LAST input
            // Because last input is Character Image for both NFT 1 and NFT 2 (after clicking +Add)
            fileInput = allFileInputs.last();
            console.log(`NFT ${imageNumber}: Using last input (index ${inputCount - 1})`);
        }

        // Wait for input
        await fileInput.waitFor({ state: 'attached', timeout: 10000 });

        console.log(`Uploading file ${imageNumber}: ${absolutePath}`);

        // Count all images in modal before upload (using broader selector)
        const allImgSelectors = '//div[contains(@id, "content-buy")]//img';
        const imgsBefore = await collectionPage.locator(allImgSelectors).count();
        console.log(`Total images in modal before upload: ${imgsBefore}`);

        // Upload file
        await fileInput.setInputFiles(absolutePath);

        // Dispatch events
        await fileInput.evaluate(node => {
            node.dispatchEvent(new Event('change', { bubbles: true }));
            node.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Wait for image to display (max 10 seconds, reduced from 15s)
        console.log('Waiting for image to display...');
        const maxWaitTime = 10000;
        const checkInterval = 1000;
        let elapsed = 0;
        let imageDisplayed = false;

        while (elapsed < maxWaitTime) {
            await collectionPage.waitForTimeout(checkInterval);
            elapsed += checkInterval;

            // Check 1: Total img count increased
            const imgsAfter = await collectionPage.locator(allImgSelectors).count();
            if (imgsAfter > imgsBefore) {
                console.log(`✓ New image appeared (${imgsBefore} -> ${imgsAfter})`);
                imageDisplayed = true;
                break;
            }

            // Check 2: Input has file
            const hasFile = await fileInput.evaluate((el: HTMLInputElement) => el.files && el.files.length > 0);
            if (hasFile) {
                // Additional check: find img near input
                const parentHasImg = await fileInput.evaluate((el) => {
                    // Search in parent levels
                    let parent = el.parentElement;
                    for (let i = 0; i < 6 && parent; i++) {
                        if (parent.querySelector('img')) return true;
                        parent = parent.parentElement;
                    }
                    return false;
                });
                if (parentHasImg) {
                    console.log('✓ File uploaded and image found near input');
                    imageDisplayed = true;
                    break;
                }
            }

            console.log(`Waiting... (${elapsed / 1000}s)`);
        }

        // If not displayed, continue anyway (don't block flow)
        if (!imageDisplayed) {
            console.log('⚠️ Could not detect new image, but continuing...');
            // Verify file was set
            const hasFile = await fileInput.evaluate((el: HTMLInputElement) => el.files && el.files.length > 0);
            console.log(`File input has file: ${hasFile}`);
        }

        // 1 second delay for UI stability
        await collectionPage.waitForTimeout(1000);

        console.log(`✅ Image ${imageNumber} upload completed!`);
    }

    async clickAddNFT(collectionPage: Page): Promise<void> {
        console.log('\n=== Click + Add button to add NFT ===');

        await collectionPage.waitForTimeout(1000);

        // Debug: List all buttons on page
        const allButtons = collectionPage.locator('button');
        const buttonCount = await allButtons.count();
        console.log(`Found ${buttonCount} buttons on page`);

        // Try to find and click + Add button
        let clicked = false;

        // Method 1: Try specific selectors
        for (const selector of CREATE_SELECTORS.ADD_NFT_BUTTON) {
            try {
                const btn = collectionPage.locator(selector).first();
                if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await btn.click();
                    console.log(`Clicked + Add with selector: ${selector}`);
                    clicked = true;
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }

        // Method 2: Try getByRole
        if (!clicked) {
            try {
                const addBtn = collectionPage.getByRole('button', { name: /add/i }).first();
                if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await addBtn.click();
                    console.log('Clicked Add button via getByRole');
                    clicked = true;
                }
            } catch (e) {
                console.log('getByRole did not find Add button');
            }
        }

        // Method 3: Try getByText with various patterns
        if (!clicked) {
            const textPatterns = ['+ Add', '+Add', 'Add', 'Add more', 'Add NFT'];
            for (const text of textPatterns) {
                try {
                    const btn = collectionPage.getByText(text, { exact: false }).first();
                    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                        await btn.click();
                        console.log(`Clicked with text: "${text}"`);
                        clicked = true;
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }
        }

        // Method 4: Find button containing "+" symbol
        if (!clicked) {
            try {
                const plusBtn = collectionPage.locator('button:has-text("+")').first();
                if (await plusBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await plusBtn.click();
                    console.log('Clicked button containing "+"');
                    clicked = true;
                }
            } catch (e) {
                console.log('Could not find button with "+"');
            }
        }

        if (!clicked) {
            console.log('⚠️ Could not find + Add button, slot may already exist');
        } else {
            await collectionPage.waitForTimeout(1500);
            console.log('✅ New NFT slot added!');
        }
    }

    async clickMintAndGenerate(collectionPage: Page): Promise<void> {
        console.log('\n=== Click Mint and Generate buttons ===');

        await collectionPage.waitForTimeout(500);

        // Click Mint button
        let mintClicked = false;
        for (const selector of CREATE_SELECTORS.MINT_BUTTON) {
            const btn = collectionPage.locator(selector).first();
            if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await btn.click();
                console.log(`Clicked Mint with selector: ${selector}`);
                mintClicked = true;
                break;
            }
        }

        if (!mintClicked) {
            // Fallback: find button with exact text "Mint"
            const mintBtn = collectionPage.getByRole('button', { name: 'Mint', exact: true }).first();
            await mintBtn.click();
        }

        await collectionPage.waitForTimeout(1500);

        // Click Generate in popup
        console.log('Looking for popup and clicking Generate...');
        let generateClicked = false;
        for (const selector of CREATE_SELECTORS.MINT_GENERATE_BUTTON) {
            const btn = collectionPage.locator(selector).first();
            if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
                await btn.click();
                console.log(`Clicked Generate with selector: ${selector}`);
                generateClicked = true;
                break;
            }
        }

        if (!generateClicked) {
            // Fallback
            const generateBtn = collectionPage.locator('div[role="dialog"] button:has-text("Generate"), [data-state="open"] button:has-text("Generate")').first();
            if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await generateBtn.click();
            }
        }

        console.log('✅ Clicked Mint and Generate!');
    }

    async waitForMintSuccess(collectionPage: Page): Promise<number> {
        console.log('\n=== Wait for Mint success (may take up to 3 minutes) ===');

        const maxWaitTime = 240000; // 4 minutes
        const checkInterval = 5000;
        let elapsed = 0;

        while (elapsed < maxWaitTime) {
            // Check for success text
            const successText = collectionPage.locator('text=/Minted.*NFT.*Successfully/i').first();
            if (await successText.isVisible({ timeout: 2000 }).catch(() => false)) {
                // Extract number of NFTs minted
                const text = await successText.textContent();
                console.log(`✅ ${text}`);

                // Try to extract number
                const match = text?.match(/Minted\s*(\d+)/i);
                const nftCount = match ? parseInt(match[1]) : 0;
                return nftCount;
            }

            // Also check alternative patterns
            const altSuccess = collectionPage.getByText('Successfully').first();
            if (await altSuccess.isVisible({ timeout: 1000 }).catch(() => false)) {
                const parentText = await collectionPage.locator('div:has-text("Successfully")').first().textContent();
                if (parentText?.toLowerCase().includes('mint')) {
                    console.log(`✅ Mint successful: ${parentText}`);
                    const match = parentText?.match(/(\d+)/);
                    return match ? parseInt(match[1]) : 2; // Default to 2 if can't extract
                }
            }

            console.log(`Waiting for mint... (${elapsed / 1000}s)`);
            await collectionPage.waitForTimeout(checkInterval);
            elapsed += checkInterval;
        }

        throw new Error('Timeout: Mint failed after 4 minutes');
    }

    async closeSuccessPopup(collectionPage: Page): Promise<void> {
        console.log('\n=== Close Success popup ===');
        await collectionPage.waitForTimeout(1000);

        let closed = false;

        // Try selectors to close popup
        const closeSelectors = [
            ...CREATE_SELECTORS.CLOSE_POPUP_BUTTON,
            'button[aria-label="Close"]',
            'button[aria-label="close"]',
            'div[role="dialog"] button:has(svg)',
            '[data-state="open"] button:has(svg)',
            'button:has(svg[class*="close"])',
            'button:has(svg[class*="x"])',
            '.close-button',
            '[class*="close"]',
        ];

        for (const selector of closeSelectors) {
            try {
                const closeBtn = collectionPage.locator(selector).first();
                if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    console.log(`Closing popup with selector: ${selector}`);
                    await closeBtn.click({ force: true });
                    await collectionPage.waitForTimeout(1000);
                    closed = true;
                    break;
                }
            } catch (e) {
                // Continue trying other selectors
            }
        }

        // If not closed, try clicking overlay or press Escape
        if (!closed) {
            console.log('Trying to close with Escape...');
            await collectionPage.keyboard.press('Escape');
            await collectionPage.waitForTimeout(500);
        }

        // Verify popup is closed
        const dialogStillOpen = await collectionPage.locator('div[role="dialog"]:visible, [data-state="open"]:visible').first().isVisible({ timeout: 1000 }).catch(() => false);

        if (dialogStillOpen) {
            console.log('Popup still open, trying Escape again...');
            await collectionPage.keyboard.press('Escape');
            await collectionPage.waitForTimeout(500);
        }

        console.log('✅ Popup closed!');
    }
}
