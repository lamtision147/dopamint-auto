import { BrowserContext, test as baseTest, expect, Page } from "@playwright/test";
import { setupMetaMask, TEST_FILE_OFFSETS } from '../dapp/metamaskSetup';
import { DopamintLoginPage } from '../pages/loginDopamint';
import { DopamintCreatePage, AIModel } from '../pages/createDopamint';
import dappwright, { Dappwright } from "@tenkeylabs/dappwright";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.test
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Get output directory (spec-specific or default)
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

// Map model name to test index for staggered parallel execution
const MODEL_TO_INDEX: Record<string, number> = {
    'Nano Banana Pro': 0,
    'Nano Banana': 1,
    'ChatGPT': 2,
    'ChatGPT image 1.5': 3,
    'Fair Launch': 4
};

export const test = baseTest.extend<{
    context: BrowserContext;
    wallet: Dappwright;
    testIndex: number;
}>({
    // Extract test index from test title
    testIndex: async ({}, use, testInfo) => {
        const modelMatch = testInfo.title.match(/with (.+) model/);
        const model = modelMatch ? modelMatch[1] : 'Nano Banana Pro';
        const index = MODEL_TO_INDEX[model] ?? 0;
        await use(index);
    },

    context: async ({ testIndex }, use) => {
        // Use CREATE file offset for staggered parallel execution across all test files
        const { wallet, context } = await setupMetaMask(testIndex, TEST_FILE_OFFSETS.CREATE);
        await use(context);
    },

    wallet: async ({ context }, use) => {
        const metamask = await dappwright.getWallet("metamask", context);
        await use(metamask);
    },
});

// Helper function to run create flow for any model
async function runCreateFlowWithModel(
    model: AIModel,
    wallet: Dappwright,
    page: Page,
    context: BrowserContext
): Promise<{ collectionName: string; mintedCount: number; modelUsed: AIModel }> {
    // STEP 1: Login with MetaMask
    console.log('\n========== PHASE 1: LOGIN WITH METAMASK ==========');
    const dopamintPage = new DopamintLoginPage(context, wallet);
    const dappPage = await dopamintPage.navigateAndLogin();
    await dopamintPage.closeAllPopups();
    await dopamintPage.loginWithMetaMask();
    await dopamintPage.verifyLoginButtonHidden();
    console.log('✅ Login successful!');

    // STEP 2: Start Create flow
    console.log('\n========== PHASE 2: CREATE NFT FLOW ==========');
    console.log(`🤖 Using AI Model: ${model}`);
    const createPage = new DopamintCreatePage(context, wallet, dappPage);

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

    await page.waitForTimeout(3000);

    return { collectionName, mintedCount, modelUsed };
}

// Helper function to run Fair Launch create flow
async function runCreateFlowFairLaunch(
    wallet: Dappwright,
    page: Page,
    context: BrowserContext
): Promise<{ collectionName: string; mintedCount: number; modelUsed: string }> {
    const modelUsed = 'ChatGPT image 1.5';  // Actual AI model used
    const collectionType = 'fairlaunch';     // Collection type: Fixed Price

    // STEP 1: Login with MetaMask
    console.log('\n========== PHASE 1: LOGIN WITH METAMASK ==========');
    const dopamintPage = new DopamintLoginPage(context, wallet);
    const dappPage = await dopamintPage.navigateAndLogin();
    await dopamintPage.closeAllPopups();
    await dopamintPage.loginWithMetaMask();
    await dopamintPage.verifyLoginButtonHidden();
    console.log('✅ Login successful!');

    // STEP 2: Start Create flow
    console.log('\n========== PHASE 2: CREATE NFT FLOW (FAIR LAUNCH) ==========');
    console.log('🚀 Creating Fair Launch collection with Fixed Price');
    const createPage = new DopamintCreatePage(context, wallet, dappPage);

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

    await page.waitForTimeout(3000);

    return { collectionName, mintedCount, modelUsed };
}

test.describe('Create NFT Flow', () => {
    // Increase timeout to 10 minutes because image generation can take 3-4 minutes
    // Run all 3 tests in parallel - each test has its own MetaMask context via fixture
    test.describe.configure({ timeout: 600000, mode: 'parallel' });

    test("Case 1: Create NFT with Nano Banana Pro model", async ({ wallet, page, context }) => {
        await runCreateFlowWithModel('Nano Banana Pro', wallet, page, context);
    });

    test("Case 2: Create NFT with Nano Banana model", async ({ wallet, page, context }) => {
        await runCreateFlowWithModel('Nano Banana', wallet, page, context);
    });

    test("Case 3: Create NFT with ChatGPT model", async ({ wallet, page, context }) => {
        await runCreateFlowWithModel('ChatGPT', wallet, page, context);
    });

    test("Case 4: Create NFT with ChatGPT image 1.5 model", async ({ wallet, page, context }) => {
        await runCreateFlowWithModel('ChatGPT image 1.5', wallet, page, context);
    });

    test("Case 5: Create NFT with Fair Launch model", async ({ wallet, page, context }) => {
        await runCreateFlowFairLaunch(wallet, page, context);
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
