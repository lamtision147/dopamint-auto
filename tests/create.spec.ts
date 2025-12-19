import { BrowserContext, test as baseTest, expect, Page } from "@playwright/test";
import { setupMetaMask } from '../dapp/metamaskSetup';
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

export const test = baseTest.extend<{
    context: BrowserContext;
    wallet: Dappwright;
}>({
    context: async ({}, use) => {
        const { wallet, context } = await setupMetaMask();
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

    // Select Motorbike card
    await createPage.selectMotorbikeCard();

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

    // Save model info to file for Telegram notification (accumulate, don't overwrite)
    const createInfoPath = path.resolve(outputDir, 'create-info.json');

    // Read existing results or start with empty array
    let allResults: Array<{model: string; collectionName: string; mintedCount: number; status: string; collectionUrl?: string}> = [];
    try {
        if (fs.existsSync(createInfoPath)) {
            const existing = JSON.parse(fs.readFileSync(createInfoPath, 'utf8'));
            allResults = Array.isArray(existing) ? existing : [existing];
        }
    } catch (e) {
        allResults = [];
    }

    // Get collection URL
    const collectionUrlPath = path.resolve(outputDir, 'collection-url.txt');
    let collectionUrl = '';
    try {
        if (fs.existsSync(collectionUrlPath)) {
            collectionUrl = fs.readFileSync(collectionUrlPath, 'utf8').trim();
        }
    } catch (e) {
        // Ignore
    }

    // Add new result
    allResults.push({
        model: modelUsed,
        collectionName: collectionName,
        mintedCount: mintedCount,
        status: 'PASSED',
        collectionUrl: collectionUrl
    });

    fs.writeFileSync(createInfoPath, JSON.stringify(allResults, null, 2));
    console.log(`✅ Create info saved (${allResults.length} results total)`);

    await page.waitForTimeout(5000);

    return { collectionName, mintedCount, modelUsed };
}

// Delay between test starts (seconds) - to avoid MetaMask conflicts
const STAGGER_DELAY_SECONDS = 30;

test.describe('Create NFT Flow', () => {
    // Increase timeout to 10 minutes because image generation can take 3-4 minutes
    // Tests run in parallel with staggered start times
    test.describe.configure({ timeout: 600000, mode: 'parallel' });

    test("Case 1: Create NFT with Nano Banana Pro model", async ({ wallet, page, context }) => {
        // First test starts immediately (no delay)
        await runCreateFlowWithModel('Nano Banana Pro', wallet, page, context);
    });

    test("Case 2: Create NFT with Nano Banana model", async ({ wallet, page, context }) => {
        // Second test waits 20 seconds
        console.log(`Waiting ${STAGGER_DELAY_SECONDS}s before starting (staggered parallel)...`);
        await page.waitForTimeout(STAGGER_DELAY_SECONDS * 1000);
        await runCreateFlowWithModel('Nano Banana', wallet, page, context);
    });

    test("Case 3: Create NFT with ChatGPT model", async ({ wallet, page, context }) => {
        // Third test waits 40 seconds
        console.log(`Waiting ${STAGGER_DELAY_SECONDS * 2}s before starting (staggered parallel)...`);
        await page.waitForTimeout(STAGGER_DELAY_SECONDS * 2 * 1000);
        await runCreateFlowWithModel('ChatGPT', wallet, page, context);
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

            // Save failed result to accumulate file
            const createInfoPath = path.resolve(outputDir, 'create-info.json');
            let allResults: Array<{model: string; collectionName: string; mintedCount: number; status: string; error?: string}> = [];
            try {
                if (fs.existsSync(createInfoPath)) {
                    const existing = JSON.parse(fs.readFileSync(createInfoPath, 'utf8'));
                    allResults = Array.isArray(existing) ? existing : [existing];
                }
            } catch (e) {
                allResults = [];
            }

            // Add failed result
            allResults.push({
                model: model,
                collectionName: 'N/A',
                mintedCount: 0,
                status: 'FAILED',
                error: testInfo.error?.message || 'Unknown error'
            });

            fs.writeFileSync(createInfoPath, JSON.stringify(allResults, null, 2));
            console.log(`❌ Failed result saved for ${model}`);
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
        await new Promise(resolve => setTimeout(resolve, 3000));
    });
});
