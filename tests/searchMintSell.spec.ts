import { BrowserContext, test as baseTest, expect, Page, chromium } from "@playwright/test";
import { DopamintLoginPage } from '../pages/loginDopamint';
import { SearchMintSellPage } from '../pages/searchMintSellDopamint';
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

// Collection type definition
type CollectionType = 'Auto Banana - OLD' | 'Auto ChatGPT - OLD' | 'Auto Banana Pro - OLD' | 'Vu test ChatGPT 1.5' | 'Auto Fairlaunch with ChatGPT 1.5';

// Map collection name to search text
const COLLECTION_TO_SEARCH_TEXT: Record<string, string> = {
    'Auto Banana - OLD': 'Banana - OLD',
    'Auto ChatGPT - OLD': 'ChatGPT - OLD',
    'Auto Banana Pro - OLD': 'Banana Pro - OLD',
    'Vu test ChatGPT 1.5': 'ChatGPT 1.5',
    'Auto Fairlaunch with ChatGPT 1.5': 'Auto Fairlaunch with ChatGPT 1.5'
};

// Map collection name to model name for display in notifications
const COLLECTION_TO_MODEL: Record<string, string> = {
    'Auto Banana - OLD': 'Nano Banana',
    'Auto ChatGPT - OLD': 'ChatGPT',
    'Auto Banana Pro - OLD': 'Nano Banana Pro',
    'Vu test ChatGPT 1.5': 'ChatGPT image 1.5',
    'Auto Fairlaunch with ChatGPT 1.5': 'ChatGPT image 1.5'
};

// Map collection name to collection type (bonding or fairlaunch)
const COLLECTION_TO_TYPE: Record<string, string> = {
    'Auto Banana - OLD': 'bonding',
    'Auto ChatGPT - OLD': 'bonding',
    'Auto Banana Pro - OLD': 'bonding',
    'Vu test ChatGPT 1.5': 'bonding',
    'Auto Fairlaunch with ChatGPT 1.5': 'fairlaunch'
};

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

// Helper function to run search mint sell flow for any collection
async function runSearchMintSellFlow(
    collectionName: CollectionType,
    page: Page,
    context: BrowserContext,
    expectedCollectionUrl: string
): Promise<{ collectionName: string; mintCount: number; mintedUrls: string[]; soldUrl: string; collectionType: string }> {
    // Determine collection type
    const collectionType = COLLECTION_TO_TYPE[collectionName] || 'bonding';
    const isFairLaunch = collectionType === 'fairlaunch';

    // ========== PHASE 1: LOGIN ==========
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

    // ========== PHASE 2: SEARCH FOR COLLECTION ==========
    console.log('\n========== PHASE 2: SEARCH FOR COLLECTION ==========');
    // Use mapped search text or default to collection name
    const searchText = COLLECTION_TO_SEARCH_TEXT[collectionName] || collectionName;
    console.log(`🔍 Searching for collection: ${collectionName} with text "${searchText}"`);
    const searchMintSellPage = new SearchMintSellPage(context, null, dappPage);

    // Click Search button on header
    await searchMintSellPage.clickSearchButton();

    // Search for collection and navigate to details (pass expectedCollectionUrl and collectionName for precise matching)
    const collectionPage = await searchMintSellPage.searchAndSelectCollection(searchText, expectedCollectionUrl, collectionName);

    // ========== PHASE 3: VERIFY COLLECTION TITLE ==========
    console.log('\n========== PHASE 3: VERIFY COLLECTION TITLE ==========');

    // Verify collection title
    const titleVerified = await searchMintSellPage.verifyCollectionTitle(collectionPage, collectionName, expectedCollectionUrl);

    // Get the actual collection name found on page
    const actualCollectionName = searchMintSellPage.getActualCollectionName();
    console.log(`Actual collection name from page: "${actualCollectionName}"`);

    if (titleVerified) {
        console.log(`✅ Collection title "${collectionName}" verified!`);
    } else {
        console.log(`⚠️ Warning: Could not verify collection title "${collectionName}"`);
    }

    // Screenshot collection details page
    const safeCollectionName = collectionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const modelName = COLLECTION_TO_MODEL[collectionName] || collectionName;
    await collectionPage.screenshot({ path: `${outputDir}/collection-details-${safeCollectionName}.png` });
    console.log(`Screenshot saved: collection-details-${safeCollectionName}.png`);

    // ========== PHASE 4: MINT 2 NFTs ==========
    console.log('\n========== PHASE 4: MINT 2 NFTs ==========');

    // Click Mint this button
    await searchMintSellPage.clickMintThis(collectionPage);

    // Upload first image
    const testImagePath1 = path.resolve(__dirname, '../test-assets/test-image1.png');
    await searchMintSellPage.uploadMintImage(collectionPage, testImagePath1, 1);

    // Click + Add to add more NFT slot
    await searchMintSellPage.clickAddNFT(collectionPage);

    // Upload second image
    const testImagePath2 = path.resolve(__dirname, '../test-assets/test-image2.png');
    await searchMintSellPage.uploadMintImage(collectionPage, testImagePath2, 2);

    // Click Mint and Generate
    await searchMintSellPage.clickMintAndGenerate(collectionPage);

    // Wait for mint success (up to 4 minutes)
    const mintResult = await searchMintSellPage.waitForMintSuccess(collectionPage);
    console.log(`\n✅ Successfully minted ${mintResult.count} NFTs!`);

    // Screenshot mint success
    await collectionPage.screenshot({ path: `${outputDir}/mint-success-${safeCollectionName}.png` });
    console.log(`Screenshot saved: mint-success-${safeCollectionName}.png`);

    // ========== PHASE 5: CLOSE POPUP AND VERIFY MINTED NFTs ==========
    console.log('\n========== PHASE 5: CLOSE POPUP AND VERIFY MINTED NFTs ==========');

    // Close mint success popup (using Escape or click outside)
    await searchMintSellPage.closeMintSuccessPopup(collectionPage);

    // Wait for page to stabilize
    await collectionPage.waitForTimeout(2000);

    // Verify minted NFTs in COMMUNITY GALLERY and get their URLs
    const verifyResult = await searchMintSellPage.verifyMintedNFTsInGallery(collectionPage, mintResult.count);

    // Log minted token URLs
    console.log('\n--- MINTED TOKEN URLs ---');
    if (verifyResult.verified && verifyResult.tokenUrls.length > 0) {
        verifyResult.tokenUrls.forEach((url, index) => {
            console.log(`NFT ${index + 1}: ${url}`);
        });
        console.log('✅ Mint verification: PASSED');
    } else {
        console.log('❌ Mint verification: FAILED - Could not find new NFTs in COMMUNITY GALLERY');
    }
    console.log('-------------------------\n');

    // Store token URLs for final summary
    const mintedTokenUrls = verifyResult.tokenUrls;

    // ========== PHASE 6: SELL NFT ==========
    console.log('\n========== PHASE 6: SELL NFT ==========');
    console.log(`Collection type: ${isFairLaunch ? 'Fair Launch (Fixed Price)' : 'Bonding Curve'}`);

    let soldTokenUrl = '';

    if (isFairLaunch) {
        // ========== FAIR LAUNCH SELL FLOW ==========
        console.log('Using Fair Launch sell flow (OpenSea)...');

        // Click Mint this to open the dialog again
        await searchMintSellPage.clickMintThis(collectionPage);

        // Click My Collectible tab inside the dialog
        await searchMintSellPage.clickMyCollectibleTab(collectionPage);

        // Hover on first NFT and verify "Sell on" button, then click to open OpenSea
        const openSeaUrl = await searchMintSellPage.hoverOnFirstNFTAndClickSellOnOpenSea(collectionPage, context);

        soldTokenUrl = openSeaUrl;

        // Log OpenSea URL
        console.log('\n--- OPENSEA URL ---');
        if (openSeaUrl) {
            console.log(`✅ OpenSea: ${openSeaUrl}`);
        } else {
            console.log('⚠️ Could not get OpenSea URL');
        }
        console.log('-------------------\n');

        // Screenshot sell page
        await collectionPage.screenshot({ path: `${outputDir}/sell-opensea-${safeCollectionName}.png` });
        console.log(`Screenshot saved: sell-opensea-${safeCollectionName}.png`);
    } else {
        // ========== BONDING CURVE SELL FLOW ==========
        console.log('Using Bonding Curve sell flow...');

        // Click Mint this to open the dialog again
        await searchMintSellPage.clickMintThis(collectionPage);

        // Click My Collectible tab inside the dialog
        await searchMintSellPage.clickMyCollectibleTab(collectionPage);

        // Hover on first NFT and click Sell
        await searchMintSellPage.hoverOnFirstNFTAndClickSell(collectionPage);

        // Click Sell button in popup
        await searchMintSellPage.clickSellInPopup(collectionPage);

        // Wait for "sold successfully" toast
        soldTokenUrl = await searchMintSellPage.waitForSoldSuccessfully(collectionPage);

        // Log sold token URL
        console.log('\n--- SOLD TOKEN URL ---');
        if (soldTokenUrl) {
            console.log(`✅ Sold NFT: ${soldTokenUrl}`);
        } else {
            console.log('⚠️ Could not extract sold token URL');
        }
        console.log('----------------------\n');

        // Screenshot sell success
        await collectionPage.screenshot({ path: `${outputDir}/sell-success-${safeCollectionName}.png` });
        console.log(`Screenshot saved: sell-success-${safeCollectionName}.png`);
    }

    console.log('\n========================================');
    console.log('✅ TEST COMPLETED SUCCESSFULLY!');
    console.log(`🤖 Model: ${modelName}`);
    console.log(`📦 Collection: ${collectionName}`);
    console.log(`🎨 NFTs minted: ${mintResult.count}`);
    if (mintedTokenUrls.length > 0) {
        console.log('🔗 Minted Token URLs:');
        mintedTokenUrls.forEach((url, index) => {
            console.log(`  ${index + 1}. ${url}`);
        });
    }
    if (soldTokenUrl) {
        console.log(`💰 Sold Token URL: ${soldTokenUrl}`);
    }
    console.log('========================================');

    // Save result to collection-specific file to avoid race condition in parallel tests
    const tokenInfoPath = path.resolve(outputDir, `token-urls-${safeCollectionName}.json`);
    const collectionUrl = collectionPage.url();  // Get collection URL from page
    const tokenInfo = {
        mintedUrls: mintedTokenUrls,
        soldUrl: soldTokenUrl || '',
        model: modelName, // Model name for display (e.g., "Nano Banana Pro")
        actualCollectionName: actualCollectionName, // Actual collection name from page (verified)
        collectionName: modelName, // Keep for backward compatibility
        collectionUrl: collectionUrl,
        collectionType: collectionType,  // 'bonding' or 'fairlaunch'
        mintCount: mintResult.count,
        status: 'PASSED'
    };
    fs.writeFileSync(tokenInfoPath, JSON.stringify(tokenInfo, null, 2));
    console.log(`✅ Token URLs saved to: token-urls-${safeCollectionName}.json`);

    await dappPage.waitForTimeout(3000);

    return {
        collectionName,
        mintCount: mintResult.count,
        mintedUrls: mintedTokenUrls,
        soldUrl: soldTokenUrl || '',
        collectionType: collectionType
    };
}

test.describe('Search, Mint and Sell NFT Flow', () => {
    // Increase timeout to 10 minutes because mint operations can take time
    // Run all tests in parallel
    test.describe.configure({ timeout: 600000, mode: 'parallel' });

    test('Case 1: Search collection "Auto Banana - OLD", Mint 2 NFTs, and Sell 1 NFT', async ({ context }) => {
        const page = await context.newPage();
        await runSearchMintSellFlow('Auto Banana - OLD', page, context, 'https://dev.dopamint.ai/collections/0x60E22057b9150772367f02F35c8072BA9EdE793c');
    });

    test('Case 2: Search collection "Auto ChatGPT - OLD", Mint 2 NFTs, and Sell 1 NFT', async ({ context }) => {
        const page = await context.newPage();
        await runSearchMintSellFlow('Auto ChatGPT - OLD', page, context, 'https://dev.dopamint.ai/collections/0x2E012B074d69aE6fC652C9999973E4cB1502DbBB');
    });

    test('Case 3: Search collection "Auto Banana Pro - OLD", Mint 2 NFTs, and Sell 1 NFT', async ({ context }) => {
        const page = await context.newPage();
        await runSearchMintSellFlow('Auto Banana Pro - OLD', page, context, 'https://dev.dopamint.ai/collections/0x4F6fb0f7fCE2B3f83A8bd255E49d15Bc6610cede');
    });

    test('Case 4: Search collection "Vu test ChatGPT 1.5", Mint 2 NFTs, and Sell 1 NFT', async ({ context }) => {
        const page = await context.newPage();
        await runSearchMintSellFlow('Vu test ChatGPT 1.5', page, context, 'https://dev.dopamint.ai/collections/0xB2fC471737a802c37368f2B24A1e0B7f6953fC46');
    });

    test('Case 5: Search collection "Auto Fairlaunch with ChatGPT 1.5", Mint 2 NFTs, and Sell on OpenSea', async ({ context }) => {
        const page = await context.newPage();
        await runSearchMintSellFlow('Auto Fairlaunch with ChatGPT 1.5', page, context, 'https://dev.dopamint.ai/collections/0xFDaC323Ad425FaC41C478B24Cf465f5ef95C9B86');
    });

    test.afterEach(async ({ context }, testInfo) => {
        // Extract collection name from test title
        const collectionMatch = testInfo.title.match(/collection "(.+)"/);
        const collectionName = collectionMatch ? collectionMatch[1] : 'Unknown';
        const safeCollectionName = collectionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Save failed result to collection-specific file
        if (testInfo.status !== 'passed') {
            console.log('Test FAILED - capturing debug screenshots...');
            const pages = context.pages();
            for (let i = 0; i < pages.length; i++) {
                try {
                    await pages[i].screenshot({
                        path: `${outputDir}/FAILED-${safeCollectionName}-page-${i}.png`,
                        fullPage: true
                    });
                    console.log(`Captured debug screenshot of page ${i}`);
                } catch (e) {
                    // Page may be closed
                }
            }

            // Save failed result
            const modelName = COLLECTION_TO_MODEL[collectionName] || collectionName;
            const collectionType = COLLECTION_TO_TYPE[collectionName] || 'bonding';
            const tokenInfoPath = path.resolve(outputDir, `token-urls-${safeCollectionName}.json`);
            const failedResult = {
                mintedUrls: [],
                soldUrl: '',
                model: modelName, // Model name for display (e.g., "Nano Banana Pro")
                actualCollectionName: collectionName, // Actual collection name (e.g., "Auto Banana - OLD")
                collectionName: modelName, // Keep for backward compatibility
                collectionUrl: '',
                collectionType: collectionType,  // 'bonding' or 'fairlaunch'
                mintCount: 0,
                status: 'FAILED',
                error: testInfo.error?.message || 'Unknown error'
            };
            fs.writeFileSync(tokenInfoPath, JSON.stringify(failedResult, null, 2));
            console.log(`❌ Failed result saved to token-urls-${safeCollectionName}.json`);
        }

        console.log(`Test "${testInfo.title}" has ended with status: ${testInfo.status}`);

        // Close all pages and context properly
        try {
            const pages = context.pages();
            for (const pg of pages) {
                await pg.close().catch(() => {});
            }
            await context.close().catch(() => {});
            console.log('Context closed successfully');
        } catch (e) {
            console.log('Error closing context:', e);
        }

        // Wait a bit before next test to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    // Merge all collection-specific result files into token-urls.json after all tests complete
    test.afterAll(async () => {
        console.log('\n========== MERGING TEST RESULTS ==========');
        const collectionFiles = [
            'token-urls-auto-banana---old.json',
            'token-urls-auto-chatgpt---old.json',
            'token-urls-auto-banana-pro---old.json',
            'token-urls-vu-test-chatgpt-15.json',
            'token-urls-auto-fairlaunch-with-chatgpt-15.json'
        ];

        const allResults: Array<{
            mintedUrls: string[];
            soldUrl: string;
            collectionName: string;
            collectionUrl?: string;
            collectionType?: string;
            mintCount: number;
            status: string;
            error?: string;
        }> = [];

        for (const file of collectionFiles) {
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
            const mergedPath = path.resolve(outputDir, 'token-urls.json');
            fs.writeFileSync(mergedPath, JSON.stringify(allResults, null, 2));
            console.log(`✅ Merged ${allResults.length} results into token-urls.json`);
        }
    });
});
