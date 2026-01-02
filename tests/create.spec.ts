import { BrowserContext, test as baseTest, expect, Page, chromium } from "@playwright/test";
import { DopamintLoginPage } from '../pages/loginDopamint';
import { DopamintCreatePage, AIModel } from '../pages/createDopamint';
import { DOPAMINT_SELECTORS } from '../xpath/dopamintLogin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.test
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Get output directory (spec-specific or default)
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

// Google session file path
const GOOGLE_SESSION_PATH = path.resolve(__dirname, '../auth/googleSession.json');

// Delay between test cases (15 seconds) - Worker 0 starts immediately
const TEST_CASE_DELAY_MS = 15000;

// ============================================================
// Test fixture with Google Session (no MetaMask needed)
// ============================================================
export const test = baseTest.extend<{
    context: BrowserContext;
}>({
    context: async ({}, use, testInfo) => {
        // Worker 0 starts immediately, others delay based on index
        const delay = testInfo.parallelIndex * TEST_CASE_DELAY_MS;
        if (delay > 0) {
            console.log(`⏳ [Test Delay] Worker ${testInfo.parallelIndex}: Waiting ${delay / 1000}s before starting...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            console.log(`✅ [Test Delay] Worker ${testInfo.parallelIndex}: Delay completed, starting test now...`);
        } else {
            console.log(`🚀 [Test Delay] Worker 0: Starting immediately (no delay)`);
        }

        // Check if Google session file exists
        const hasGoogleSession = fs.existsSync(GOOGLE_SESSION_PATH);
        if (hasGoogleSession) {
            console.log(`📂 Loading saved Google session from: ${GOOGLE_SESSION_PATH}`);
        } else {
            console.log(`⚠️  No Google session found. Run: npx ts-node scripts/setupGoogleSession.ts`);
        }

        // Launch browser with saved session if available
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext({
            storageState: hasGoogleSession ? GOOGLE_SESSION_PATH : undefined
        });
        await use(context);
        // Cleanup after test
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    },
});

// Helper function to run create flow for any model
async function runCreateFlowWithModel(
    model: AIModel,
    page: Page,
    context: BrowserContext
): Promise<{ collectionName: string; mintedCount: number; modelUsed: AIModel }> {
    // STEP 1: Login (use saved session or skip if already logged in)
    console.log('\n========== PHASE 1: LOGIN ==========');

    const dopamintPage = new DopamintLoginPage(context, null);
    const dappPage = await dopamintPage.navigateAndLogin();
    await dopamintPage.closeAllPopups();

    // Check if already logged in (session loaded from file)
    const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
    const isLoginVisible = await loginButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isLoginVisible) {
        console.log('✅ Already logged in via saved session!');
    } else {
        // No valid session - need to login
        throw new Error('No valid Google session found. Please run: npx ts-node scripts/setupGoogleSession.ts');
    }

    // STEP 2: Start Create flow
    console.log('\n========== PHASE 2: CREATE NFT FLOW ==========');
    console.log(`🤖 Using AI Model: ${model}`);
    const createPage = new DopamintCreatePage(context, null, dappPage);

    // Click Create button on header
    await createPage.clickCreateButton();

    // Select Change button template
    await createPage.chooseChangeButtonTemplate();

    // Select Studio card
    await createPage.selectStudioCard();

    // Select the specified model
    await createPage.selectModel(model);

    // Upload image
    console.log('\n========== PHASE 3: UPLOAD IMAGE ==========');
    const testImagePath = path.resolve(__dirname, '../test-assets/test-image-create.png');
    await createPage.uploadImage(testImagePath);

    // STEP 3: Generate image
    console.log('\n========== PHASE 4: GENERATE IMAGE ==========');
    await createPage.clickGenerateAndConfirm();

    // Wait for image generation (can take 3-4 minutes)
    await createPage.waitForImageGeneration();

    // Screenshot after generation
    await dappPage.screenshot({ path: `${outputDir}/after-generate.png` });

    // STEP 4: Publish & Monetize
    console.log('\n========== PHASE 5: PUBLISH & MONETIZE ==========');
    await createPage.clickPublishAndMonetize();

    // Fill form and save collection name
    const collectionName = await createPage.fillPublishCollectionForm();

    // Click Publish and Confirm
    await createPage.clickPublishAndConfirm();

    // Wait for Published Successfully
    await createPage.waitForPublishSuccess();

    // Screenshot after successful publish
    await dappPage.screenshot({ path: `${outputDir}/publish-success.png` });

    // STEP 5: Go to collection and verify
    console.log('\n========== PHASE 6: VERIFY COLLECTION ==========');
    await createPage.clickGoToCollectionAndVerify(collectionName);

    // Manually retrieve the collection page since the method returns void
    const pages = context.pages();
    const collectionPage = pages[pages.length - 1];
    await collectionPage.waitForLoadState();

    // STEP 6: Mint NFT Flow
    console.log('\n========== PHASE 7: MINT NFT FLOW ==========');

    // Click Mint this button
    await createPage.clickMintThis(collectionPage);

    // Upload first image
    const testImagePath1 = path.resolve(__dirname, '../test-assets/test-image1.png');
    await createPage.uploadMintImage(collectionPage, testImagePath1, 1);

    // Click + Add to add more NFT slot
    await createPage.clickAddNFT(collectionPage);

    // Upload second image
    const testImagePath2 = path.resolve(__dirname, '../test-assets/test-image2.png');
    await createPage.uploadMintImage(collectionPage, testImagePath2, 2);

    // Click Mint and Generate
    await createPage.clickMintAndGenerate(collectionPage);

    // Wait for mint success (up to 3-4 minutes)
    const mintedCount = await createPage.waitForMintSuccess(collectionPage);
    console.log(`Successfully minted ${mintedCount} NFT!`);

    // Screenshot mint success
    await collectionPage.screenshot({ path: `${outputDir}/mint-success.png` });

    // Close success popup
    await createPage.closeSuccessPopup(collectionPage);

    // Get the model that was actually used
    const modelUsed = createPage.getSelectedModel();

    console.log('\n========================================');
    console.log('✅ TEST COMPLETED FULL FLOW!');
    console.log(`🤖 Model: ${modelUsed}`);
    console.log(`📦 Collection created: ${collectionName}`);
    console.log(`🎨 NFTs minted: ${mintedCount}`);
    console.log('========================================');

    // Save model info to separate file to avoid race condition in parallel tests
    const safeModelName = modelUsed.toLowerCase().replace(/\s+/g, '-');
    const modelInfoPath = path.resolve(outputDir, `create-info-${safeModelName}.json`);

    // Get collection URL
    const collectionUrlPath = path.resolve(outputDir, `collection-url-${safeModelName}.txt`);
    let collectionUrl = '';
    try {
        if (fs.existsSync(collectionUrlPath)) {
            collectionUrl = fs.readFileSync(collectionUrlPath, 'utf8').trim();
        }
    } catch (e) {
        // Ignore
    }

    // Write result to model-specific file
    const result = {
        model: modelUsed,
        collectionName: collectionName,
        mintedCount: mintedCount,
        status: 'PASSED',
        collectionUrl: collectionUrl,
        collectionType: 'bonding'  // Bonding Curve collection
    };

    fs.writeFileSync(modelInfoPath, JSON.stringify(result, null, 2));
    console.log(`✅ Create info saved to ${modelInfoPath}`);

    await dappPage.waitForTimeout(3000);

    return { collectionName, mintedCount, modelUsed };
}

// Helper function to run Fair Launch create flow
async function runCreateFlowFairLaunch(
    page: Page,
    context: BrowserContext
): Promise<{ collectionName: string; mintedCount: number; modelUsed: string }> {
    const modelUsed = 'ChatGPT image 1.5';  // Actual AI model used
    const collectionType = 'fairlaunch';     // Collection type: Fixed Price

    // STEP 1: Login (use saved session or skip if already logged in)
    console.log('\n========== PHASE 1: LOGIN ==========');

    const dopamintPage = new DopamintLoginPage(context, null);
    const dappPage = await dopamintPage.navigateAndLogin();
    await dopamintPage.closeAllPopups();

    // Check if already logged in (session loaded from file)
    const loginButton = dappPage.locator(DOPAMINT_SELECTORS.LOGIN_BUTTON).first();
    const isLoginVisible = await loginButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isLoginVisible) {
        console.log('✅ Already logged in via saved session!');
    } else {
        // No valid session - need to login
        throw new Error('No valid Google session found. Please run: npx ts-node scripts/setupGoogleSession.ts');
    }

    // STEP 2: Start Create flow
    console.log('\n========== PHASE 2: CREATE NFT FLOW (FAIR LAUNCH) ==========');
    console.log('🚀 Creating Fair Launch collection with Fixed Price');
    const createPage = new DopamintCreatePage(context, null, dappPage);

    // Click Create button on header
    await createPage.clickCreateButton();

    // Select Change button template
    await createPage.chooseChangeButtonTemplate();

    // Select Studio card
    await createPage.selectStudioCard();

    // Select a model (use ChatGPT image 1.5 for Fair Launch test)
    await createPage.selectModel('ChatGPT image 1.5');

    // Upload image
    console.log('\n========== PHASE 3: UPLOAD IMAGE ==========');
    const testImagePath = path.resolve(__dirname, '../test-assets/test-image-create.png');
    await createPage.uploadImage(testImagePath);

    // STEP 3: Generate image
    console.log('\n========== PHASE 4: GENERATE IMAGE ==========');
    await createPage.clickGenerateAndConfirm();

    // Wait for image generation (can take 3-4 minutes)
    await createPage.waitForImageGeneration();

    // Screenshot after generation
    await dappPage.screenshot({ path: `${outputDir}/after-generate-fairlaunch.png` });

    // STEP 4: Publish & Monetize with Fair Launch settings
    console.log('\n========== PHASE 5: PUBLISH & MONETIZE (FAIR LAUNCH) ==========');
    await createPage.clickPublishAndMonetize();

    // Fill Fair Launch form (Fixed Price, Price, Supply, Collection name, etc.)
    const collectionName = await createPage.fillPublishCollectionFormFairLaunch();

    // Click Publish and Confirm
    await createPage.clickPublishAndConfirm();

    // Wait for Published Successfully
    await createPage.waitForPublishSuccess();

    // Screenshot after successful publish
    await dappPage.screenshot({ path: `${outputDir}/publish-success-fairlaunch.png` });

    // STEP 5: Go to collection and verify
    console.log('\n========== PHASE 6: VERIFY COLLECTION ==========');
    await createPage.clickGoToCollectionAndVerify(collectionName);

    // Manually retrieve the collection page since the method returns void
    const pages = context.pages();
    const collectionPage = pages[pages.length - 1];
    await collectionPage.waitForLoadState();

    // Get collection URL directly from the page
    const collectionUrl = collectionPage.url();
    console.log(`✅ Fair Launch Collection URL: ${collectionUrl}`);

    // STEP 6: Mint NFT Flow
    console.log('\n========== PHASE 7: MINT NFT FLOW ==========');

    // Click Mint this button
    await createPage.clickMintThis(collectionPage);

    // Upload first image
    const testImagePath1 = path.resolve(__dirname, '../test-assets/test-image1.png');
    await createPage.uploadMintImage(collectionPage, testImagePath1, 1);

    // Click + Add to add more NFT slot
    await createPage.clickAddNFT(collectionPage);

    // Upload second image
    const testImagePath2 = path.resolve(__dirname, '../test-assets/test-image2.png');
    await createPage.uploadMintImage(collectionPage, testImagePath2, 2);

    // Click Mint and Generate
    await createPage.clickMintAndGenerate(collectionPage);

    // Wait for mint success (up to 3-4 minutes)
    const mintedCount = await createPage.waitForMintSuccess(collectionPage);
    console.log(`Successfully minted ${mintedCount} NFT!`);

    // Screenshot mint success
    await collectionPage.screenshot({ path: `${outputDir}/mint-success-fairlaunch.png` });

    // Close success popup
    await createPage.closeSuccessPopup(collectionPage);

    console.log('\n========================================');
    console.log('✅ TEST COMPLETED FULL FLOW!');
    console.log(`🚀 Type: Fair Launch (Fixed Price)`);
    console.log(`📦 Collection created: ${collectionName}`);
    console.log(`🎨 NFTs minted: ${mintedCount}`);
    console.log('========================================');

    // Save Fair Launch info to separate file
    const modelInfoPath = path.resolve(outputDir, 'create-info-fair-launch.json');

    // Write result to Fair Launch specific file (URL already captured above)
    const result = {
        model: modelUsed,
        collectionName: collectionName,
        mintedCount: mintedCount,
        status: 'PASSED',
        collectionUrl: collectionUrl,
        collectionType: collectionType  // 'fairlaunch' = Fixed Price
    };

    fs.writeFileSync(modelInfoPath, JSON.stringify(result, null, 2));
    console.log(`✅ Create info saved to ${modelInfoPath}`);

    await dappPage.waitForTimeout(3000);

    return { collectionName, mintedCount, modelUsed };
}

test.describe('Create NFT Flow', () => {
    // Increase timeout to 10 minutes because image generation can take 3-4 minutes
    // Run all tests in parallel
    test.describe.configure({ timeout: 600000, mode: 'parallel' });

    test("Case 1: Create NFT with Nano Banana Pro model", async ({ context }) => {
        const page = await context.newPage();
        await runCreateFlowWithModel('Nano Banana Pro', page, context);
    });

    test("Case 2: Create NFT with Nano Banana model", async ({ context }) => {
        const page = await context.newPage();
        await runCreateFlowWithModel('Nano Banana', page, context);
    });

    test("Case 3: Create NFT with ChatGPT model", async ({ context }) => {
        const page = await context.newPage();
        await runCreateFlowWithModel('ChatGPT', page, context);
    });

    test("Case 4: Create NFT with ChatGPT image 1.5 model", async ({ context }) => {
        const page = await context.newPage();
        await runCreateFlowWithModel('ChatGPT image 1.5', page, context);
    });

    test("Case 5: Create NFT with Fair Launch model", async ({ context }) => {
        const page = await context.newPage();
        await runCreateFlowFairLaunch(page, context);
    });

    test.afterEach(async ({ context }, testInfo) => {
        // Extract model from test title
        const modelMatch = testInfo.title.match(/with (.+) model/);
        const model = modelMatch ? modelMatch[1] : 'Unknown';

        // Save failed result to create-info.json
        if (testInfo.status !== 'passed') {
            console.log('Test FAILED - capturing debug screenshots...');
            const pages = context.pages();
            for (let i = 0; i < pages.length; i++) {
                try {
                    await pages[i].screenshot({
                        path: `${outputDir}/FAILED-${model}-page-${i}.png`,
                        fullPage: true
                    });
                    console.log(`Captured debug screenshot of page ${i}`);
                } catch (e) {
                    // Page may be closed
                }
            }

            // Save failed result to model-specific file
            // Determine if this is a Fair Launch test
            const isFairLaunch = model === 'Fair Launch';
            const actualModel = isFairLaunch ? 'ChatGPT image 1.5' : model;
            const safeModelName = isFairLaunch ? 'fair-launch' : model.toLowerCase().replace(/\s+/g, '-');
            const modelInfoPath = path.resolve(outputDir, `create-info-${safeModelName}.json`);

            const failedResult = {
                model: actualModel,
                collectionName: 'N/A',
                mintedCount: 0,
                status: 'FAILED',
                error: testInfo.error?.message || 'Unknown error',
                collectionUrl: '',
                collectionType: isFairLaunch ? 'fairlaunch' : 'bonding'
            };

            fs.writeFileSync(modelInfoPath, JSON.stringify(failedResult, null, 2));
            console.log(`❌ Failed result saved to ${modelInfoPath}`);
        }

        console.log(`Test "${testInfo.title}" has ended with status: ${testInfo.status}`);

        // Close all pages and context properly
        try {
            const pages = context.pages();
            for (const page of pages) {
                await page.close().catch(() => {});
            }
            await context.close().catch(() => {});
            console.log('Context closed successfully');
        } catch (e) {
            console.log('Error closing context:', e);
        }

        // Wait a bit before next test to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    // Merge all model-specific result files into create-info.json after all tests complete
    test.afterAll(async () => {
        console.log('\n========== MERGING TEST RESULTS ==========');
        const modelFiles = [
            'create-info-nano-banana-pro.json',
            'create-info-nano-banana.json',
            'create-info-chatgpt.json',
            'create-info-chatgpt-image-1.5.json',
            'create-info-fair-launch.json'
        ];

        const allResults: Array<{model: string; collectionName: string; mintedCount: number; status: string; collectionUrl?: string; collectionType?: string; error?: string}> = [];

        for (const file of modelFiles) {
            const filePath = path.resolve(outputDir, file);
            try {
                if (fs.existsSync(filePath)) {
                    const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    allResults.push(result);
                    console.log(`✅ Loaded result from ${file}`);
                }
            } catch (e) {
                console.log(`⚠️ Could not read ${file}`);
            }
        }

        if (allResults.length > 0) {
            const mergedPath = path.resolve(outputDir, 'create-info.json');
            fs.writeFileSync(mergedPath, JSON.stringify(allResults, null, 2));
            console.log(`✅ Merged ${allResults.length} results into create-info.json`);
        }
    });
});
