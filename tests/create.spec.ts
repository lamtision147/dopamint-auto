import { BrowserContext, test as baseTest, expect, Page } from "@playwright/test";
import { setupMetaMask } from '../dapp/metamaskSetup';
import { DopamintLoginPage } from '../pages/loginDopamint';
import { DopamintCreatePage } from '../pages/createDopamint';
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

test.describe('Create NFT Flow', () => {
    // Increase timeout to 10 minutes because image generation can take 3-4 minutes
    test.describe.configure({ timeout: 600000 });

    test("Case 1: Create NFT with Motorbike template", async ({ wallet, page, context }) => {
        // STEP 1: Login with MetaMask (same as dopamintLogin.spec.ts)
        console.log('\n========== PHASE 1: LOGIN WITH METAMASK ==========');
        const dopamintPage = new DopamintLoginPage(context, wallet);
        const dappPage = await dopamintPage.navigateAndLogin();
        await dopamintPage.closeAllPopups();
        await dopamintPage.loginWithMetaMask();
        await dopamintPage.verifyLoginButtonHidden();
        console.log('✅ Login successful!');

        // STEP 2: Start Create flow
        console.log('\n========== PHASE 2: CREATE NFT FLOW ==========');
        const createPage = new DopamintCreatePage(context, wallet, dappPage);

        // Click Create button on header
        await createPage.clickCreateButton();

        // Select Change button template
        await createPage.chooseChangeButtonTemplate();

        // Select Motorbike card
        await createPage.selectMotorbikeCard();

        // Select model Nano Banana Pro
        await createPage.selectNanoBananaPro();

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
        await dappPage.screenshot({ path: 'test-results/after-generate.png' });

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
        await dappPage.screenshot({ path: 'test-results/publish-success.png' });

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
        const testImagePath2 = path.resolve(__dirname, '../test-assets/test-image2.png'); // Can use same or different image
        await createPage.uploadMintImage(collectionPage, testImagePath2, 2);

        // Click Mint and Generate
        await createPage.clickMintAndGenerate(collectionPage);

        // Wait for mint success (up to 3-4 minutes)
        const mintedCount = await createPage.waitForMintSuccess(collectionPage);
        console.log(`Successfully minted ${mintedCount} NFT!`);

        // Screenshot mint success
        await collectionPage.screenshot({ path: 'test-results/mint-success.png' });

        // Close success popup
        await createPage.closeSuccessPopup(collectionPage);

        console.log('\n========================================');
        console.log('✅ TEST COMPLETED FULL FLOW!');
        console.log(`Collection created: ${collectionName}`);
        console.log(`NFTs minted: ${mintedCount}`);
        console.log('========================================');

        await page.waitForTimeout(5000);
    });

    test.afterEach(async ({}, testInfo) => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`Test "${testInfo.title}" has ended.`);
    });
});
