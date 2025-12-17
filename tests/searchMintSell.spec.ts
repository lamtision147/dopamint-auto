import { BrowserContext, test as baseTest, expect, Page } from "@playwright/test";
import { setupMetaMask } from '../dapp/metamaskSetup';
import { DopamintLoginPage } from '../pages/loginDopamint';
import { SearchMintSellPage } from '../pages/searchMintSellDopamint';
import dappwright, { Dappwright } from "@tenkeylabs/dappwright";
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.test
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

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

test.describe('Search, Mint and Sell NFT Flow', () => {
    // Increase timeout to 10 minutes because mint operations can take time
    test.describe.configure({ timeout: 600000 });

    test("Case 1: Search collection, Mint 2 NFTs, and Sell 1 NFT", async ({ wallet, page, context }) => {
        // ========== PHASE 1: LOGIN WITH METAMASK ==========
        console.log('\n========== PHASE 1: LOGIN WITH METAMASK ==========');
        const dopamintPage = new DopamintLoginPage(context, wallet);
        const dappPage = await dopamintPage.navigateAndLogin();
        await dopamintPage.closeAllPopups();
        await dopamintPage.loginWithMetaMask();
        await dopamintPage.verifyLoginButtonHidden();
        console.log('Login successful!');

        // ========== PHASE 2: SEARCH FOR COLLECTION ==========
        console.log('\n========== PHASE 2: SEARCH FOR COLLECTION ==========');
        const searchMintSellPage = new SearchMintSellPage(context, wallet, dappPage);

        const collectionName = 'Auto Banana - OLD';

        // Click Search button on header
        await searchMintSellPage.clickSearchButton();

        // Search for collection and navigate to details
        const collectionPage = await searchMintSellPage.searchAndSelectCollection(collectionName);

        // ========== PHASE 3: VERIFY COLLECTION TITLE ==========
        console.log('\n========== PHASE 3: VERIFY COLLECTION TITLE ==========');

        // Verify collection title
        const titleVerified = await searchMintSellPage.verifyCollectionTitle(collectionPage, collectionName);

        if (titleVerified) {
            console.log(`Collection title "${collectionName}" verified!`);
        } else {
            console.log(`Warning: Could not verify collection title "${collectionName}"`);
        }

        // Screenshot collection details page
        await collectionPage.screenshot({ path: 'test-results/collection-details.png' });
        console.log('Screenshot saved: collection-details.png');

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
        console.log(`\nSuccessfully minted ${mintResult.count} NFTs!`);

        // Screenshot mint success
        await collectionPage.screenshot({ path: 'test-results/mint-success.png' });
        console.log('Screenshot saved: mint-success.png');

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
            console.log('Mint verification: PASSED');
        } else {
            console.log('Mint verification: FAILED - Could not find new NFTs in COMMUNITY GALLERY');
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
            console.log(`Sold NFT: ${soldTokenUrl}`);
        } else {
            console.log('Could not extract sold token URL');
        }
        console.log('----------------------\n');

        // Screenshot sell success
        await collectionPage.screenshot({ path: 'test-results/sell-success.png' });
        console.log('Screenshot saved: sell-success.png');

        console.log('\n========================================');
        console.log('TEST COMPLETED SUCCESSFULLY!');
        console.log(`Collection: ${collectionName}`);
        console.log(`NFTs minted: ${mintResult.count}`);
        if (mintedTokenUrls.length > 0) {
            console.log('Minted Token URLs:');
            mintedTokenUrls.forEach((url, index) => {
                console.log(`  ${index + 1}. ${url}`);
            });
        }
        if (soldTokenUrl) {
            console.log(`Sold Token URL: ${soldTokenUrl}`);
        }
        console.log('========================================');

        // Save minted/sold token URLs to file for Telegram notification
        const fs = await import('fs');
        const tokenInfoPath = path.resolve(__dirname, '../test-results/token-urls.json');
        const tokenInfo = {
            mintedUrls: mintedTokenUrls,
            soldUrl: soldTokenUrl || '',
            collectionName: collectionName,
            mintCount: mintResult.count
        };
        fs.writeFileSync(tokenInfoPath, JSON.stringify(tokenInfo, null, 2));
        console.log('Token URLs saved to: token-urls.json');

        await page.waitForTimeout(5000);
    });

    test.afterEach(async ({ context }, testInfo) => {
        // Only capture debug screenshots on FAILURE
        if (testInfo.status !== 'passed') {
            console.log('Test FAILED - capturing debug screenshots...');
            const pages = context.pages();
            for (let i = 0; i < pages.length; i++) {
                try {
                    await pages[i].screenshot({
                        path: `test-results/FAILED-page-${i}.png`,
                        fullPage: true
                    });
                    console.log(`Captured debug screenshot of page ${i}`);
                } catch (e) {
                    // Page may be closed
                }
            }
        }
        console.log(`Test "${testInfo.title}" has ended.`);
    });
});
