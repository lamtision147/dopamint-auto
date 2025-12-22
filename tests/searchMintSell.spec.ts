import { BrowserContext, test as baseTest, expect, Page } from "@playwright/test";
import { setupMetaMask, TEST_FILE_OFFSETS } from '../dapp/metamaskSetup';
import { DopamintLoginPage } from '../pages/loginDopamint';
import { SearchMintSellPage } from '../pages/searchMintSellDopamint';
import dappwright, { Dappwright } from "@tenkeylabs/dappwright";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.test
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Get output directory (spec-specific or default)
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

// Collection type definition
type CollectionType = 'Auto Banana - OLD' | 'Auto ChatGPT - OLD' | 'Auto Banana Pro - OLD';

// Map collection name to test index for staggered parallel execution
const COLLECTION_TO_INDEX: Record<string, number> = {
    'Auto Banana - OLD': 0,
    'Auto ChatGPT - OLD': 1,
    'Auto Banana Pro - OLD': 2
};

export const test = baseTest.extend<{
    context: BrowserContext;
    wallet: Dappwright;
    testIndex: number;
}>({
    // Extract test index from test title
    testIndex: async ({}, use, testInfo) => {
        const collectionMatch = testInfo.title.match(/collection "(.+)"/);
        const collection = collectionMatch ? collectionMatch[1] : 'Auto Banana - OLD';
        const index = COLLECTION_TO_INDEX[collection] ?? 0;
        await use(index);
    },

    context: async ({ testIndex }, use) => {
        // Use SEARCH_MINT_SELL file offset for staggered parallel execution across all test files
        const { wallet, context } = await setupMetaMask(testIndex, TEST_FILE_OFFSETS.SEARCH_MINT_SELL);
        await use(context);
    },

    wallet: async ({ context }, use) => {
        const metamask = await dappwright.getWallet("metamask", context);
        await use(metamask);
    },
});

// Helper function to run search mint sell flow for any collection
async function runSearchMintSellFlow(
    collectionName: CollectionType,
    wallet: Dappwright,
    page: Page,
    context: BrowserContext
): Promise<{ collectionName: string; mintCount: number; mintedUrls: string[]; soldUrl: string }> {
    // ========== PHASE 1: LOGIN WITH METAMASK ==========
    console.log('\n========== PHASE 1: LOGIN WITH METAMASK ==========');
    const dopamintPage = new DopamintLoginPage(context, wallet);
    const dappPage = await dopamintPage.navigateAndLogin();
    await dopamintPage.closeAllPopups();
    await dopamintPage.loginWithMetaMask();
    await dopamintPage.verifyLoginButtonHidden();
    console.log('✅ Login successful!');

    // ========== PHASE 2: SEARCH FOR COLLECTION ==========
    console.log('\n========== PHASE 2: SEARCH FOR COLLECTION ==========');
    console.log(`🔍 Searching for collection: ${collectionName}`);
    const searchMintSellPage = new SearchMintSellPage(context, wallet, dappPage);

    // Click Search button on header
    await searchMintSellPage.clickSearchButton();

    // Search for collection and navigate to details
    const collectionPage = await searchMintSellPage.searchAndSelectCollection(collectionName);

    // ========== PHASE 3: VERIFY COLLECTION TITLE ==========
    console.log('\n========== PHASE 3: VERIFY COLLECTION TITLE ==========');

    // Verify collection title
    const titleVerified = await searchMintSellPage.verifyCollectionTitle(collectionPage, collectionName);

    if (titleVerified) {
        console.log(`✅ Collection title "${collectionName}" verified!`);
    } else {
        console.log(`⚠️ Warning: Could not verify collection title "${collectionName}"`);
    }

    // Screenshot collection details page
    const safeCollectionName = collectionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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

    // Click Mint this to open the dialog again
    await searchMintSellPage.clickMintThis(collectionPage);

    // Click My Collectible tab inside the dialog
    await searchMintSellPage.clickMyCollectibleTab(collectionPage);

    // Hover on first NFT and click Sell
    await searchMintSellPage.hoverOnFirstNFTAndClickSell(collectionPage);

    // Click Sell button in popup
    await searchMintSellPage.clickSellInPopup(collectionPage);

    // Wait for "sold successfully" toast
    const soldTokenUrl = await searchMintSellPage.waitForSoldSuccessfully(collectionPage);

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

    console.log('\n========================================');
    console.log('✅ TEST COMPLETED SUCCESSFULLY!');
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
    const tokenInfo = {
        mintedUrls: mintedTokenUrls,
        soldUrl: soldTokenUrl || '',
        collectionName: collectionName,
        mintCount: mintResult.count,
        status: 'PASSED'
    };
    fs.writeFileSync(tokenInfoPath, JSON.stringify(tokenInfo, null, 2));
    console.log(`✅ Token URLs saved to: token-urls-${safeCollectionName}.json`);

    await page.waitForTimeout(3000);

    return {
        collectionName,
        mintCount: mintResult.count,
        mintedUrls: mintedTokenUrls,
        soldUrl: soldTokenUrl || ''
    };
}

test.describe('Search, Mint and Sell NFT Flow', () => {
    // Increase timeout to 10 minutes because mint operations can take time
    // Run all 3 tests in parallel - each test has its own MetaMask context via fixture
    test.describe.configure({ timeout: 600000, mode: 'parallel' });

    test('Case 1: Search collection "Auto Banana - OLD", Mint 2 NFTs, and Sell 1 NFT', async ({ wallet, page, context }) => {
        await runSearchMintSellFlow('Auto Banana - OLD', wallet, page, context);
    });

    test('Case 2: Search collection "Auto ChatGPT - OLD", Mint 2 NFTs, and Sell 1 NFT', async ({ wallet, page, context }) => {
        await runSearchMintSellFlow('Auto ChatGPT - OLD', wallet, page, context);
    });

    test('Case 3: Search collection "Auto Banana Pro - OLD", Mint 2 NFTs, and Sell 1 NFT', async ({ wallet, page, context }) => {
        await runSearchMintSellFlow('Auto Banana Pro - OLD', wallet, page, context);
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
            const tokenInfoPath = path.resolve(outputDir, `token-urls-${safeCollectionName}.json`);
            const failedResult = {
                mintedUrls: [],
                soldUrl: '',
                collectionName: collectionName,
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
            'token-urls-auto-banana-pro---old.json'
        ];

        const allResults: Array<{
            mintedUrls: string[];
            soldUrl: string;
            collectionName: string;
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
