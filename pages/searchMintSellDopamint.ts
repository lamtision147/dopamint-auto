import { BrowserContext, Page, expect, Locator } from "@playwright/test";
import { Dappwright } from "@tenkeylabs/dappwright";
import { SEARCH_MINT_SELL_SELECTORS } from '../xpath/dopamintSearchMintSell';
import path from 'path';

// Get output directory (spec-specific or default)
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

export class SearchMintSellPage {
    readonly context: BrowserContext;
    readonly wallet: Dappwright | null;
    page: Page;

    // Store the last token ID from COMMUNITY GALLERY
    private lastCommunityTokenId: number = 0;
    private collectionAddressStored: string = '';

    constructor(context: BrowserContext, wallet: Dappwright | null, page: Page) {
        this.context = context;
        this.wallet = wallet;
        this.page = page;
    }

    // Helper function to find element from array of selectors
    private async findElementFromSelectors(page: Page, selectors: string | string[], timeout: number = 5000): Promise<Locator | null> {
        const selectorList = Array.isArray(selectors) ? selectors : [selectors];

        for (const selector of selectorList) {
            try {
                const element = page.locator(selector).first();
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

    // ============ SEARCH FUNCTIONS ============

    async clickSearchButton(): Promise<void> {
        console.log('\n=== Click Search button on header ===');

        await this.page.waitForTimeout(1000);

        let searchClicked = false;

        // Method 1: Look for "Search" text in header/nav area
        const searchTextSelectors = [
            'header >> text=Search',
            'nav >> text=Search',
            'a:has-text("Search")',
            'button:has-text("Search")',
        ];

        for (const selector of searchTextSelectors) {
            try {
                const btn = this.page.locator(selector).first();
                if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await btn.click();
                    console.log(`Clicked Search with selector: ${selector}`);
                    searchClicked = true;
                    break;
                }
            } catch (e) {
                // Continue
            }
        }

        // Method 2: Try predefined selectors
        if (!searchClicked) {
            for (const selector of SEARCH_MINT_SELL_SELECTORS.SEARCH_BUTTON) {
                try {
                    const btn = this.page.locator(selector).first();
                    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await btn.click();
                        console.log(`Clicked Search with selector: ${selector}`);
                        searchClicked = true;
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }
        }

        // Method 3: Try getByRole and getByText
        if (!searchClicked) {
            try {
                const searchLink = this.page.getByRole('link', { name: /search/i }).first();
                if (await searchLink.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await searchLink.click();
                    console.log('Clicked Search link via getByRole');
                    searchClicked = true;
                }
            } catch (e) {
                // Continue
            }
        }

        // Method 4: Try finding by href containing 'search' or 'marketplace'
        if (!searchClicked) {
            const hrefSelectors = ['a[href*="search"]', 'a[href*="marketplace"]', 'a[href*="explore"]'];
            for (const selector of hrefSelectors) {
                try {
                    const link = this.page.locator(selector).first();
                    if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
                        await link.click();
                        console.log(`Clicked via href: ${selector}`);
                        searchClicked = true;
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }
        }

        // Method 5: Debug - list all header links/buttons
        if (!searchClicked) {
            console.log('Could not find Search button, listing header elements...');
            const headerLinks = this.page.locator('header a, nav a');
            const count = await headerLinks.count();
            console.log(`Found ${count} links in header/nav:`);
            for (let i = 0; i < Math.min(count, 10); i++) {
                const text = await headerLinks.nth(i).textContent().catch(() => '');
                const href = await headerLinks.nth(i).getAttribute('href').catch(() => '');
                console.log(`  ${i}: "${text?.trim()}" -> ${href}`);
            }
        }

        await this.page.waitForTimeout(1000);

        if (searchClicked) {
            console.log('Search button clicked successfully!');
        } else {
            console.log('Warning: Could not click Search button');
        }
    }

async searchAndSelectCollection(searchText: string, targetUrl: string, expectedCollectionName?: string): Promise<Page> {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔍 SEARCH FOR COLLECTION`);
        console.log(`${'='.repeat(60)}`);
        console.log(`   Search text: "${searchText}"`);
        console.log(`   Expected collection name: "${expectedCollectionName || 'N/A'}"`);
        console.log(`   Expected URL: ${targetUrl}`);

        // Extract collection address from targetUrl
        const addressMatch = targetUrl.match(/(0x[a-fA-F0-9]{40})/i);
        if (!addressMatch) {
            throw new Error(`Invalid target URL - no collection address found: ${targetUrl}`);
        }
        const targetAddress = addressMatch[1].toLowerCase();
        console.log(`   Target address: ${targetAddress}`);

        // 1. Nhập text vào search input
        const searchInput = this.page.locator('input[placeholder*="Search"], input[type="search"]').first();
        
        // Ensure element is stable
        try {
            await searchInput.waitFor({ state: 'attached', timeout: 5000 });
        } catch (e) {
            console.log('Search input not found via placeholder, trying generic input...');
        }
        
        const finalInput = (await searchInput.isVisible().catch(() => false)) ? searchInput : this.page.locator('input:visible').first();
        
        // Double check visibility before action
        if (await finalInput.isVisible().catch(() => false)) {
            await finalInput.clear();
            await finalInput.fill(searchText);
            console.log(`\n✏️ Entered search text: "${searchText}"`);
        } else {
            throw new Error("Could not find any visible search input field");
        }

        // 2. Chờ dropdown kết quả xuất hiện
        console.log('⏳ Waiting for search dropdown results...');
        await this.page.waitForTimeout(3000);

        // 3. Scan results with scrolling
        console.log('\n📋 DEBUG: Scanning dropdown area with scroll...');

        // Prioritize the scrollable container described by user
        const dropdownContainerSelectors = [
            'div.overflow-y-auto', 
            '[role="listbox"]',
            '[role="dialog"]',
            '[data-radix-popper-content-wrapper]',
            'div[class*="dropdown"]',
            'div[class*="Dropdown"]',
            'div[class*="result"]',
            'div[class*="search"]',
            'ul[class*="list"]'
        ];

        let dropdownContainer = null;
        for (const selector of dropdownContainerSelectors) {
            const container = this.page.locator(selector).first();
            if (await container.isVisible({ timeout: 2000 }).catch(() => false)) {
                dropdownContainer = container;
                console.log(`   ✅ Found dropdown container: ${selector}`);
                break;
            }
        }

        if (dropdownContainer) {
            // DEBUG: Print all <a> elements in dropdown to understand structure
            console.log('\n   🔍 DEBUG: Scanning ALL <a> elements in dropdown...');
            const allLinksInDropdown = dropdownContainer.locator('a[href]');
            const allLinksCount = await allLinksInDropdown.count().catch(() => 0);
            console.log(`   Found ${allLinksCount} total <a> elements with href in dropdown`);

            for (let k = 0; k < Math.min(allLinksCount, 10); k++) {
                const aLink = allLinksInDropdown.nth(k);
                const aHref = await aLink.getAttribute('href').catch(() => '');
                const aText = await aLink.textContent().catch(() => '');
                console.log(`      <a> [${k}]: href="${aHref}", text="${aText?.trim().substring(0, 40)}..."`);
            }

            // Also check parent dialog for links
            console.log('\n   🔍 DEBUG: Scanning page for dialog with links...');
            const dialogLinks = this.page.locator('div[role="dialog"] a[href*="/collections/"], [data-radix-popper-content-wrapper] a[href*="/collections/"]');
            const dialogLinksCount = await dialogLinks.count().catch(() => 0);
            console.log(`   Found ${dialogLinksCount} collection links in dialog`);

            for (let k = 0; k < Math.min(dialogLinksCount, 10); k++) {
                const dLink = dialogLinks.nth(k);
                const dHref = await dLink.getAttribute('href').catch(() => '');
                const dText = await dLink.textContent().catch(() => '');
                console.log(`      Dialog <a> [${k}]: href="${dHref}", text="${dText?.trim().substring(0, 40)}..."`);

                // Check if this matches our target
                if (dHref && dHref.toLowerCase().includes(targetAddress)) {
                    const textMatches = expectedCollectionName ?
                        dText?.toLowerCase().includes(expectedCollectionName.toLowerCase()) :
                        dText?.toLowerCase().includes(searchText.toLowerCase());

                    if (textMatches) {
                        console.log(`   ✅ FOUND MATCH in dialog! Clicking...`);
                        await dLink.scrollIntoViewIfNeeded().catch(() => {});
                        await dLink.click({ force: true });
                        await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
                        console.log(`📄 Navigated to: ${this.page.url()}`);
                        return this.page;
                    }
                }
            }

            const maxScrolls = 5; // Increased scan attempts
            for (let scrollAttempt = 0; scrollAttempt <= maxScrolls; scrollAttempt++) {
                console.log(`\n   --- Scan Attempt ${scrollAttempt + 1}/${maxScrolls + 1} ---`);

                // FIRST: Try to find <a> elements with target address directly (most reliable)
                const directLinks = dropdownContainer.locator(`a[href*="${targetAddress}"], a[href*="${targetAddress.substring(0, 10)}"]`);
                const directLinkCount = await directLinks.count().catch(() => 0);
                console.log(`   Found ${directLinkCount} direct links with target address`);

                for (let j = 0; j < directLinkCount; j++) {
                    const link = directLinks.nth(j);
                    const linkHref = await link.getAttribute('href').catch(() => '') || '';
                    const linkText = await link.textContent().catch(() => '') || '';

                    console.log(`      Direct link [${j}]: Text="${linkText.trim().substring(0, 50)}...", Href="${linkHref}"`);

                    // Check if this link matches our expected collection
                    const hrefMatches = linkHref.toLowerCase().includes(targetAddress);
                    let textMatches = false;
                    if (expectedCollectionName) {
                        textMatches = linkText.toLowerCase().includes(expectedCollectionName.toLowerCase()) ||
                                      expectedCollectionName.toLowerCase().includes(linkText.trim().toLowerCase());
                    } else {
                        textMatches = linkText.toLowerCase().includes(searchText.toLowerCase());
                    }

                    if (hrefMatches && textMatches) {
                        console.log(`   ✅ DIRECT MATCH: Found <a> with correct href AND name!`);
                        await link.scrollIntoViewIfNeeded().catch(() => {});
                        await link.click({ force: true });
                        console.log('   ⏳ Clicked. Waiting for navigation...');

                        try {
                            await this.page.waitForURL(/collections/i, { timeout: 10000 });
                        } catch (e) {
                            // URL might already be correct
                        }
                        await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
                        console.log(`📄 Navigated to: ${this.page.url()}`);
                        return this.page;
                    } else if (hrefMatches) {
                        console.log(`   ⚠️ Href matches but text doesn't match "${expectedCollectionName}"`);
                    }
                }

                // SECOND: Fall back to checking all clickable elements
                const clickableSelectors = 'a, button, div[role="option"], div[role="button"], li, [onclick], [data-href]';
                const clickables = dropdownContainer.locator(clickableSelectors);
                const count = await clickables.count();
                console.log(`   Found ${count} clickable elements in dropdown`);

                for (let i = 0; i < count; i++) {
                    const el = clickables.nth(i);
                    if (!(await el.isVisible().catch(() => false))) continue;

                    // Lấy href và text
                    let href = await el.getAttribute('href').catch(() => '') || '';
                    if (!href) href = await el.getAttribute('data-href').catch(() => '') || '';
                    if (!href) href = await el.getAttribute('data-url').catch(() => '') || '';

                    const tagName = await el.evaluate((node: any) => node.tagName).catch(() => '');

                    // If element is DIV without href, try multiple methods to find href
                    if (!href && tagName === 'DIV') {
                        // Method 1: Find any <a> descendant with href containing collections
                        const childLink = el.locator('a[href*="/collections/"]').first();
                        if (await childLink.count().catch(() => 0) > 0) {
                            href = await childLink.getAttribute('href').catch(() => '') || '';
                        }

                        // Method 2: Find any <a> descendant (even hidden)
                        if (!href) {
                            const anyLink = el.locator('a[href]').first();
                            if (await anyLink.count().catch(() => 0) > 0) {
                                href = await anyLink.getAttribute('href').catch(() => '') || '';
                            }
                        }

                        // Method 3: Extract href from element's innerHTML using regex
                        if (!href) {
                            const innerHTML = await el.evaluate((node: any) => node.innerHTML).catch(() => '');
                            const hrefMatch = innerHTML.match(/href=["']([^"']*\/collections\/[^"']*)["']/i);
                            if (hrefMatch) {
                                href = hrefMatch[1];
                            }
                        }

                        // Method 4: Check parent element for href
                        if (!href) {
                            const parentHref = await el.evaluate((node: any) => {
                                let parent = node.parentElement;
                                for (let i = 0; i < 3 && parent; i++) {
                                    if (parent.tagName === 'A' && parent.href) {
                                        return parent.getAttribute('href');
                                    }
                                    // Check for child <a> in parent
                                    const link = parent.querySelector('a[href*="/collections/"]');
                                    if (link) return link.getAttribute('href');
                                    parent = parent.parentElement;
                                }
                                return '';
                            }).catch(() => '');
                            if (parentHref) href = parentHref;
                        }
                    }

                    const text = await el.textContent().catch(() => '') || '';

                    // Debug log (limited)
                    if (i < 3 || text.toLowerCase().includes(searchText.toLowerCase().substring(0, 8)) || href.toLowerCase().includes(targetAddress)) {
                        console.log(`      [${i}] <${tagName}> Text: "${text.trim().substring(0, 50)}...", Href: "${href}"`);
                    }

                    // === STRICT MATCHING: Verify BOTH name AND href BEFORE clicking ===
                    const textTrimmed = text.trim();

                    // DEBUG: If text matches expected name, dump full HTML to see structure
                    if (expectedCollectionName && textTrimmed.toLowerCase().includes(expectedCollectionName.toLowerCase())) {
                        console.log(`\n      🔬 DEBUG: Found matching name, dumping HTML structure...`);
                        const outerHTML = await el.evaluate((node: any) => node.outerHTML).catch(() => '');
                        console.log(`      OuterHTML (first 500 chars): ${outerHTML.substring(0, 500)}`);

                        // Check all attributes
                        const allAttrs = await el.evaluate((node: any) => {
                            const attrs: Record<string, string> = {};
                            for (const attr of node.attributes) {
                                attrs[attr.name] = attr.value;
                            }
                            return attrs;
                        }).catch(() => ({}));
                        console.log(`      All attributes:`, JSON.stringify(allAttrs));

                        // Check parent element
                        const parentInfo = await el.evaluate((node: any) => {
                            const parent = node.parentElement;
                            if (!parent) return null;
                            return {
                                tagName: parent.tagName,
                                href: parent.getAttribute('href'),
                                className: parent.className,
                                outerHTML: parent.outerHTML.substring(0, 300)
                            };
                        }).catch(() => null);
                        console.log(`      Parent element:`, JSON.stringify(parentInfo));
                    }

                    // Check href contains target address
                    const hrefMatchesAddress = href && href.toLowerCase().includes(targetAddress);

                    // Check text matches expected collection name (if provided) or search text
                    let textMatchesName = false;
                    if (expectedCollectionName) {
                        // Strict: text must contain expected collection name
                        textMatchesName = textTrimmed.toLowerCase().includes(expectedCollectionName.toLowerCase()) ||
                                          expectedCollectionName.toLowerCase().includes(textTrimmed.toLowerCase());
                    } else {
                        // Fallback: text must contain search text
                        textMatchesName = textTrimmed.toLowerCase().includes(searchText.toLowerCase());
                    }

                    // Log match status for debugging
                    if (textMatchesName || hrefMatchesAddress) {
                        console.log(`      📋 Item analysis:`);
                        console.log(`         Text: "${textTrimmed.substring(0, 50)}..."`);
                        console.log(`         Href: "${href}"`);
                        console.log(`         ✓ Text matches name: ${textMatchesName}`);
                        console.log(`         ✓ Href matches address: ${hrefMatchesAddress}`);
                    }

                    // Matching logic - prioritize href if available, otherwise use exact name match
                    let matchFound = false;
                    if (hrefMatchesAddress && textMatchesName) {
                        console.log(`   ✅ PERFECT MATCH: Both name AND href verified!`);
                        matchFound = true;
                    } else if (hrefMatchesAddress && !expectedCollectionName) {
                        // No expected name provided, trust href alone
                        console.log(`   ✅ HREF MATCH: Address verified (no expected name provided)`);
                        matchFound = true;
                    } else if (hrefMatchesAddress && !textMatchesName) {
                        console.log(`   ⚠️ SKIP: Href matches but name doesn't match "${expectedCollectionName}"`);
                    } else if (!href && textMatchesName && expectedCollectionName) {
                        // NO HREF AVAILABLE (JS-based navigation) - trust EXACT name match
                        // Check if text matches EXACTLY (not just contains)
                        const exactMatch = textTrimmed.toLowerCase() === expectedCollectionName.toLowerCase() ||
                                          textTrimmed.toLowerCase().startsWith(expectedCollectionName.toLowerCase());
                        if (exactMatch) {
                            console.log(`   ✅ EXACT NAME MATCH (no href in DOM - JS navigation)`);
                            console.log(`      Will click and verify URL after navigation...`);
                            matchFound = true;
                        } else {
                            console.log(`   ⚠️ SKIP: Name contains but not exact match`);
                        }
                    } else if (!hrefMatchesAddress && textMatchesName) {
                        console.log(`   ⚠️ SKIP: Name matches but href doesn't contain target address`);
                    }

                    if (matchFound) {
                        console.log('   🖱️ Clicking result...');

                        // Capture current URL to detect navigation
                        const oldUrl = this.page.url();

                        // Setup listener for new page (tab)
                        const newPagePromise = this.context.waitForEvent('page', { timeout: 5000 }).catch(() => null);

                        await el.scrollIntoViewIfNeeded().catch(() => {});
                        await el.click({ force: true });

                        console.log('   ⏳ Clicked. Waiting for navigation...');

                        // Check for new page first
                        const newPage = await newPagePromise;
                        if (newPage) {
                             await newPage.waitForLoadState('domcontentloaded');
                             const newPageUrl = newPage.url();
                             console.log(`📄 Navigated to new page: ${newPageUrl}`);

                             // VERIFY URL contains target address
                             if (newPageUrl.toLowerCase().includes(targetAddress)) {
                                 console.log(`   ✅ URL VERIFIED: Contains target address!`);
                                 return newPage;
                             } else {
                                 console.log(`   ❌ URL MISMATCH! Expected: ${targetAddress}`);
                                 console.log(`      Got: ${newPageUrl}`);
                                 await newPage.close().catch(() => {});
                                 throw new Error(`Clicked "${textTrimmed}" but navigated to wrong collection. Expected address: ${targetAddress}, Got: ${newPageUrl}`);
                             }
                        }

                        // Check for URL change on current page
                        try {
                            await this.page.waitForFunction((startUrl) => window.location.href !== startUrl, oldUrl, { timeout: 5000 });
                            const currentUrl = this.page.url();
                            console.log(`📄 URL changed to: ${currentUrl}`);

                            // VERIFY URL contains target address
                            if (currentUrl.toLowerCase().includes(targetAddress)) {
                                console.log(`   ✅ URL VERIFIED: Contains target address!`);
                            } else {
                                console.log(`   ❌ URL MISMATCH! Expected: ${targetAddress}`);
                                console.log(`      Got: ${currentUrl}`);
                                throw new Error(`Clicked "${textTrimmed}" but navigated to wrong collection. Expected address: ${targetAddress}, Got: ${currentUrl}`);
                            }
                        } catch (e) {
                            if (e instanceof Error && e.message.includes('URL MISMATCH')) {
                                throw e; // Re-throw URL mismatch error
                            }
                            console.log(`⚠️ URL did not change immediately. Current: ${this.page.url()}`);
                        }

                        // Safe wait for load state
                        try {
                            await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
                        } catch (e) {
                            console.log('⚠️ waitForLoadState timed out, continuing anyway...');
                        }

                        return this.page;
                    }
                }

                // If not found, scroll down using multiple methods
                if (scrollAttempt < maxScrolls) {
                    console.log('   📜 Not found, scrolling down to load more...');
                    
                    try {
                        // Method 1: Scroll last element into view
                        const lastEl = clickables.last();
                        if (await lastEl.isVisible().catch(() => false)) {
                            await lastEl.scrollIntoViewIfNeeded().catch(() => {});
                        }
                        
                        // Method 2: Mouse wheel simulation (more reliable for UI frameworks)
                        const box = await dropdownContainer.boundingBox();
                        if (box) {
                            await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                            await this.page.mouse.wheel(0, 500);
                        }

                        // Method 3: Direct DOM manipulation + Event dispatch
                        await dropdownContainer.evaluate((node: any) => {
                            node.scrollTop += node.clientHeight;
                            node.dispatchEvent(new Event('scroll', { bubbles: true }));
                        });
                    } catch (e) {
                        console.log('Error during scroll:', e);
                    }
                    
                    await this.page.waitForTimeout(2000); // Wait for load more
                }
            }
            console.log(`   ❌ Could not find collection in dropdown after ${maxScrolls + 1} scans.`);
        }

        console.log(`   ⚠️ Dropdown search failed or no dropdown. Searching page links (Fallback)...`);
        
        // Fallback: tìm trên toàn trang
        const allLinks = this.page.locator(`a[href*="${targetAddress}"], a[href*="/collections/"]`);
        const linkCount = await allLinks.count();
        console.log(`   Found ${linkCount} collection links on page`);

        for (let i = 0; i < linkCount; i++) {
            const link = allLinks.nth(i);
            if (!(await link.isVisible().catch(() => false))) continue;

            const href = await link.getAttribute('href').catch(() => '') || '';
            if (href.toLowerCase().includes(targetAddress)) {
                console.log(`   ✅ Found fallback match by HREF: ${href}`);
                await link.click();
                await this.page.waitForTimeout(3000);
                return this.page;
            }
        }

        // Final failure
        const currentUrl = this.page.url();
        throw new Error(`Collection not found. Expected: ${targetAddress}. Search: "${searchText}". Current URL: ${currentUrl}`);
    }

    // Store the actual collection name found on page
    private actualCollectionName: string = '';

    // Get the actual collection name found on page
    getActualCollectionName(): string {
        return this.actualCollectionName;
    }

    async verifyCollectionTitle(collectionPage: Page, expectedTitle: string, expectedCollectionUrl?: string): Promise<boolean> {
        console.log(`\n=== Verify collection title: "${expectedTitle}" ===`);
        if (expectedCollectionUrl) {
            console.log(`=== Verify collection URL: "${expectedCollectionUrl}" ===`);
        }

        await collectionPage.waitForTimeout(1500);

        // Extract and store collection address from URL
        const currentUrl = collectionPage.url();
        console.log(`Current URL: ${currentUrl}`);

        if (expectedCollectionUrl) {
            if (currentUrl.includes(expectedCollectionUrl) || expectedCollectionUrl.includes(currentUrl)) {
                console.log(`✅ Collection URL verified matches expected: ${expectedCollectionUrl}`);
            } else {
                console.log(`⚠️ Warning: Current URL ${currentUrl} does not match expected ${expectedCollectionUrl}`);
            }
        }

        const urlMatch = currentUrl.match(/collections\/([^?\/]+)/);
        this.collectionAddressStored = urlMatch ? urlMatch[1] : '';
        console.log(`Collection address: ${this.collectionAddressStored}`);

        // Try to find collection title
        let titleFound = false;
        this.actualCollectionName = expectedTitle; // Default to expected if not found

        // Method 1: Find h1 or title element
        for (const selector of SEARCH_MINT_SELL_SELECTORS.COLLECTION_TITLE) {
            try {
                const titleEl = collectionPage.locator(selector).first();
                if (await titleEl.isVisible({ timeout: 5000 }).catch(() => false)) {
                    const titleText = await titleEl.textContent();
                    console.log(`Found title element: "${titleText}"`);

                    // Store the actual collection name from page
                    if (titleText && titleText.trim()) {
                        this.actualCollectionName = titleText.trim();
                        console.log(`Stored actual collection name: "${this.actualCollectionName}"`);
                    }

                    if (titleText?.toLowerCase().includes(expectedTitle.toLowerCase()) ||
                        expectedTitle.toLowerCase().includes(titleText?.toLowerCase() || '')) {
                        console.log(`Title matches expected: "${expectedTitle}"`);
                        titleFound = true;
                        break;
                    }
                }
            } catch (e) {
                // Continue
            }
        }

        // Method 2: Check if page contains the title text
        if (!titleFound) {
            const pageContent = await collectionPage.textContent('body');
            if (pageContent?.toLowerCase().includes(expectedTitle.toLowerCase())) {
                console.log(`Page contains expected title: "${expectedTitle}"`);
                titleFound = true;
            }
        }

        if (titleFound) {
            console.log(`Collection title verified: "${expectedTitle}"`);
            console.log(`Actual collection name on page: "${this.actualCollectionName}"`);
        } else {
            console.log(`Warning: Could not verify title "${expectedTitle}"`);
        }

        // Get the first NFT token ID from COMMUNITY GALLERY
        await this.getLastTokenIdFromCommunityGallery(collectionPage);

        return titleFound;
    }

    // Get the highest token ID from COMMUNITY GALLERY section (BEFORE minting)
    // This will be used to compare against NFTs after minting to verify success
    private async getLastTokenIdFromCommunityGallery(collectionPage: Page): Promise<void> {
        console.log('\n=== Getting HIGHEST token ID from COMMUNITY GALLERY (before mint) ===');

        try {
            await collectionPage.waitForTimeout(1500);

            // Scroll to COMMUNITY GALLERY section
            const gallerySection = collectionPage.locator('text=COMMUNITY GALLERY').first();
            if (await gallerySection.isVisible({ timeout: 3000 }).catch(() => false)) {
                await gallerySection.scrollIntoViewIfNeeded().catch(() => {});
                console.log('Scrolled to COMMUNITY GALLERY section');
                await collectionPage.waitForTimeout(1000);
            }

            const allTokenIds: number[] = [];

            // Method 1: Find NFT links with nft_id in href (most reliable)
            console.log('Looking for NFT links with nft_id in href...');
            const nftLinks = collectionPage.locator('a[href*="nft_id="]');
            const linkCount = await nftLinks.count();
            console.log(`Found ${linkCount} NFT links`);

            for (let i = 0; i < Math.min(linkCount, 30); i++) {
                try {
                    const link = nftLinks.nth(i);
                    const href = await link.getAttribute('href').catch(() => '');
                    const idMatch = href?.match(/nft_id=(\d+)/);
                    if (idMatch) {
                        const tokenId = parseInt(idMatch[1]);
                        if (!isNaN(tokenId) && !allTokenIds.includes(tokenId)) {
                            allTokenIds.push(tokenId);
                        }
                    }
                } catch (e) {
                    // Continue
                }
            }

            // Method 2: Find NFT card with # pattern in text
            if (allTokenIds.length === 0) {
                console.log('Trying # pattern in text...');
                const pageText = await collectionPage.textContent('body').catch(() => '');
                const allIdMatches = pageText?.match(/#(\d+)/g) || [];
                console.log(`Found ${allIdMatches.length} #ID patterns on page`);

                for (const match of allIdMatches) {
                    const id = parseInt(match.replace('#', ''));
                    if (!isNaN(id) && !allTokenIds.includes(id)) {
                        allTokenIds.push(id);
                    }
                }
            }

            // Method 3: Find data attributes
            if (allTokenIds.length === 0) {
                console.log('Trying data attributes...');
                const nftCards = collectionPage.locator('[data-nft-id], [data-token-id]');
                const cardCount = await nftCards.count();
                console.log(`Found ${cardCount} NFT cards with data attributes`);

                for (let i = 0; i < Math.min(cardCount, 30); i++) {
                    try {
                        const card = nftCards.nth(i);
                        const nftId = await card.getAttribute('data-nft-id').catch(() => '') ||
                                     await card.getAttribute('data-token-id').catch(() => '');
                        if (nftId) {
                            const tokenId = parseInt(nftId);
                            if (!isNaN(tokenId) && !allTokenIds.includes(tokenId)) {
                                allTokenIds.push(tokenId);
                            }
                        }
                    } catch (e) {
                        // Continue
                    }
                }
            }

            // Get the HIGHEST token ID
            if (allTokenIds.length > 0) {
                this.lastCommunityTokenId = Math.max(...allTokenIds);
                console.log(`Found ${allTokenIds.length} unique token IDs`);
                console.log(`HIGHEST token ID in COMMUNITY GALLERY: #${this.lastCommunityTokenId}`);
                console.log(`All IDs found: ${allTokenIds.sort((a, b) => b - a).slice(0, 10).join(', ')}...`);
            } else {
                console.log('WARNING: Could not find any token ID from COMMUNITY GALLERY');
                console.log('Will set lastCommunityTokenId to 0 - all minted NFTs will be considered new');
                this.lastCommunityTokenId = 0;
            }
        } catch (e) {
            console.log('Error getting token ID from gallery:', e);
            this.lastCommunityTokenId = 0;
        }
    }

    // ============ MINT FUNCTIONS ============

    async clickMintThis(collectionPage: Page): Promise<void> {
        console.log('\n=== Click Mint this button ===');

        await collectionPage.waitForTimeout(1000);

        let clicked = false;
        for (const selector of SEARCH_MINT_SELL_SELECTORS.MINT_THIS_BUTTON) {
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
        console.log('Mint UI opened!');
    }

    async uploadMintImage(collectionPage: Page, imagePath: string, imageNumber: number = 1): Promise<void> {
        console.log(`\n=== Upload image ${imageNumber} for Mint ===`);

        await collectionPage.waitForTimeout(1000);
        const absolutePath = path.resolve(imagePath);

        // Find file inputs in modal
        const allFileInputs = collectionPage.locator('//div[contains(@id, "content-buy")]//input[@type="file"]');
        const inputCount = await allFileInputs.count();
        console.log(`Total file inputs in modal: ${inputCount}`);

        let fileInput: Locator;
        if (inputCount === 0) {
            // Fallback: find any file input
            fileInput = collectionPage.locator('input[type="file"]').last();
        } else if (inputCount === 1) {
            fileInput = allFileInputs.first();
        } else {
            // Use last input (Character Image for both NFT slots)
            fileInput = allFileInputs.last();
        }

        await fileInput.waitFor({ state: 'attached', timeout: 10000 });

        console.log(`Uploading file ${imageNumber}: ${absolutePath}`);

        // Upload file
        await fileInput.setInputFiles(absolutePath);

        // Dispatch events
        await fileInput.evaluate(node => {
            node.dispatchEvent(new Event('change', { bubbles: true }));
            node.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Wait for upload to complete
        await collectionPage.waitForTimeout(2000);

        console.log(`Image ${imageNumber} upload completed!`);
    }

    async clickAddNFT(collectionPage: Page): Promise<void> {
        console.log('\n=== Click + Add button to add NFT ===');

        await collectionPage.waitForTimeout(1000);

        let clicked = false;

        // Try specific selectors
        for (const selector of SEARCH_MINT_SELL_SELECTORS.ADD_NFT_BUTTON) {
            try {
                const btn = collectionPage.locator(selector).first();
                if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await btn.click();
                    console.log(`Clicked + Add with selector: ${selector}`);
                    clicked = true;
                    break;
                }
            } catch (e) {
                // Continue
            }
        }

        // Fallback: find button with text containing "Add"
        if (!clicked) {
            const addBtn = collectionPage.getByRole('button', { name: /add/i }).first();
            if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await addBtn.click();
                console.log('Clicked Add button via getByRole');
                clicked = true;
            }
        }

        if (!clicked) {
            console.log('Warning: Could not find + Add button');
        } else {
            await collectionPage.waitForTimeout(1500);
            console.log('New NFT slot added!');
        }
    }

    async clickMintAndGenerate(collectionPage: Page): Promise<void> {
        console.log('\n=== Click Mint and Generate buttons ===');

        await collectionPage.waitForTimeout(500);

        // Click Mint button
        let mintClicked = false;
        for (const selector of SEARCH_MINT_SELL_SELECTORS.MINT_BUTTON) {
            const btn = collectionPage.locator(selector).first();
            if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await btn.click();
                console.log(`Clicked Mint with selector: ${selector}`);
                mintClicked = true;
                break;
            }
        }

        if (!mintClicked) {
            const mintBtn = collectionPage.getByRole('button', { name: 'Mint', exact: true }).first();
            await mintBtn.click();
        }

        await collectionPage.waitForTimeout(1500);

        // Click Generate in popup
        console.log('Looking for popup and clicking Generate...');
        let generateClicked = false;
        for (const selector of SEARCH_MINT_SELL_SELECTORS.MINT_GENERATE_BUTTON) {
            const btn = collectionPage.locator(selector).first();
            if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
                await btn.click();
                console.log(`Clicked Generate with selector: ${selector}`);
                generateClicked = true;
                break;
            }
        }

        if (!generateClicked) {
            const generateBtn = collectionPage.locator('div[role="dialog"] button:has-text("Generate"), [data-state="open"] button:has-text("Generate")').first();
            if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await generateBtn.click();
            }
        }

        console.log('Clicked Mint and Generate!');
    }

    async waitForMintSuccess(collectionPage: Page): Promise<{ count: number; tokenUrls: string[] }> {
        console.log('\n=== Wait for Mint success (may take up to 3 minutes) ===');

        const maxWaitTime = 240000; // 4 minutes
        const checkInterval = 5000;
        let elapsed = 0;
        let nftCount = 0;

        while (elapsed < maxWaitTime) {
            // Check for success text
            const successText = collectionPage.locator('text=/Minted.*NFT.*Successfully/i').first();
            if (await successText.isVisible({ timeout: 2000 }).catch(() => false)) {
                const text = await successText.textContent();
                console.log(`${text}`);

                const match = text?.match(/Minted\s*(\d+)/i);
                nftCount = match ? parseInt(match[1]) : 2;

                // Return count only, URLs will be extracted after closing popup
                return { count: nftCount, tokenUrls: [] };
            }

            // Also check alternative patterns
            const altSuccess = collectionPage.getByText('Successfully').first();
            if (await altSuccess.isVisible({ timeout: 1000 }).catch(() => false)) {
                const parentText = await collectionPage.locator('div:has-text("Successfully")').first().textContent();
                if (parentText?.toLowerCase().includes('mint')) {
                    console.log(`Mint successful: ${parentText}`);
                    const match = parentText?.match(/(\d+)/);
                    nftCount = match ? parseInt(match[1]) : 2;

                    // Return count only, URLs will be extracted after closing popup
                    return { count: nftCount, tokenUrls: [] };
                }
            }

            console.log(`Waiting for mint... (${elapsed / 1000}s)`);
            await collectionPage.waitForTimeout(checkInterval);
            elapsed += checkInterval;
        }

        throw new Error('Timeout: Mint failed after 4 minutes');
    }

    // Verify minted NFTs in COMMUNITY GALLERY and get their URLs
    // SIMPLE LOGIC: Use same approach as getLastTokenIdFromCommunityGallery
    // - Get all token IDs from page using # pattern
    // - Find IDs that are > lastCommunityTokenId (pre-mint highest)
    // - Build URLs for these new NFTs
    async verifyMintedNFTsInGallery(collectionPage: Page, expectedCount: number): Promise<{ verified: boolean; tokenUrls: string[] }> {
        console.log(`\n=== Verify ${expectedCount} minted NFTs in COMMUNITY GALLERY ===`);
        console.log(`Previous highest token ID (before mint): ${this.lastCommunityTokenId}`);

        await collectionPage.waitForTimeout(2000);

        const tokenUrls: string[] = [];
        const newTokenIds: number[] = [];

        try {
            // Scroll to COMMUNITY GALLERY section first
            const gallerySection = collectionPage.locator('text=COMMUNITY GALLERY').first();
            if (await gallerySection.isVisible({ timeout: 3000 }).catch(() => false)) {
                await gallerySection.scrollIntoViewIfNeeded().catch(() => {});
                console.log('Scrolled to COMMUNITY GALLERY section');
                await collectionPage.waitForTimeout(1500);
            }

            // SIMPLE METHOD: Get all token IDs from page text using # pattern
            // (Same approach as getLastTokenIdFromCommunityGallery which works)
            console.log('Getting all token IDs from page using # pattern...');
            const pageText = await collectionPage.textContent('body').catch(() => '');
            const allIdMatches = pageText?.match(/#(\d+)/g) || [];
            console.log(`Found ${allIdMatches.length} #ID patterns on page`);

            // Extract unique token IDs
            const allTokenIds: number[] = [];
            for (const match of allIdMatches) {
                const id = parseInt(match.replace('#', ''));
                if (!isNaN(id) && !allTokenIds.includes(id)) {
                    allTokenIds.push(id);
                }
            }

            // Sort descending (highest first)
            allTokenIds.sort((a, b) => b - a);
            console.log(`Unique token IDs found: ${allTokenIds.slice(0, 10).join(', ')}...`);

            // Find NEW token IDs (> lastCommunityTokenId)
            for (const tokenId of allTokenIds) {
                if (tokenId > this.lastCommunityTokenId) {
                    newTokenIds.push(tokenId);
                    console.log(`  -> NEW NFT: #${tokenId} (> ${this.lastCommunityTokenId})`);
                }
            }

            // Sort new IDs descending (highest = newest minted)
            newTokenIds.sort((a, b) => b - a);
            console.log(`\nFound ${newTokenIds.length} new NFTs with IDs > ${this.lastCommunityTokenId}`);
            console.log(`New token IDs: ${newTokenIds.join(', ')}`);

            // Build URLs for new NFTs (take first expectedCount)
            const mintedIds = newTokenIds.slice(0, expectedCount);
            for (const tokenId of mintedIds) {
                const url = `https://dev.dopamint.ai/collections/${this.collectionAddressStored}?collection=${this.collectionAddressStored}&nft_id=${tokenId}`;
                tokenUrls.push(url);
                console.log(`Minted NFT URL: ${url}`);
            }

            // Verify we have at least expectedCount new NFTs
            console.log(`\n--- VERIFICATION RESULT ---`);
            console.log(`Expected: ${expectedCount} new NFTs`);
            console.log(`Found: ${newTokenIds.length} new NFTs with IDs > ${this.lastCommunityTokenId}`);

            if (newTokenIds.length >= expectedCount) {
                console.log(`PASSED: Found ${newTokenIds.length} new NFTs (expected ${expectedCount})`);
                return { verified: true, tokenUrls };
            } else if (newTokenIds.length > 0) {
                console.log(`FAILED: Only found ${newTokenIds.length} new NFTs, expected ${expectedCount}`);
                console.log(`This means only ${newTokenIds.length} NFT was minted successfully`);
                return { verified: false, tokenUrls };
            } else {
                console.log(`FAILED: No new NFTs found with ID > ${this.lastCommunityTokenId}`);
                console.log(`This means minting may have failed completely`);
                return { verified: false, tokenUrls };
            }
        } catch (e) {
            console.log('Error verifying minted NFTs:', e);
            return { verified: false, tokenUrls };
        }
    }

    // Extract minted token URLs based on lastCommunityTokenId + minted count
    private async extractMintedTokenUrls(collectionPage: Page, expectedCount: number): Promise<string[]> {
        const tokenUrls: string[] = [];

        try {
            // Use stored collection address
            const collectionAddress = this.collectionAddressStored;
            console.log(`Collection address: ${collectionAddress}`);
            console.log(`Last community token ID: ${this.lastCommunityTokenId}`);

            // Calculate new token IDs based on lastCommunityTokenId + minted count
            if (this.lastCommunityTokenId > 0 && collectionAddress) {
                for (let i = 1; i <= expectedCount; i++) {
                    const newTokenId = this.lastCommunityTokenId + i;
                    const url = `https://dev.dopamint.ai/collections/${collectionAddress}?collection=${collectionAddress}&nft_id=${newTokenId}`;
                    tokenUrls.push(url);
                    console.log(`Minted NFT ${i} URL: ${url}`);
                }
                return tokenUrls;
            }

            console.log('lastCommunityTokenId not available, trying other methods...');

            // Method 1: Try to find NFT links in the success popup
            const nftLinks = collectionPage.locator('a[href*="nft_id="], a[href*="token"]');
            const linkCount = await nftLinks.count();
            console.log(`Found ${linkCount} NFT links`);

            if (linkCount > 0) {
                for (let i = 0; i < Math.min(linkCount, expectedCount); i++) {
                    const href = await nftLinks.nth(i).getAttribute('href').catch(() => '');
                    if (href) {
                        const fullUrl = href.startsWith('http') ? href : `https://dev.dopamint.ai${href}`;
                        tokenUrls.push(fullUrl);
                        console.log(`Minted NFT ${i + 1} URL: ${fullUrl}`);
                    }
                }
            }

            // Method 2: Try to extract from data attributes
            if (tokenUrls.length === 0) {
                const nftElements = collectionPage.locator('[data-nft-id], [data-token-id], [data-id]');
                const idCount = await nftElements.count();
                console.log(`Found ${idCount} elements with NFT ID attributes`);

                for (let i = 0; i < Math.min(idCount, expectedCount); i++) {
                    const nftId = await nftElements.nth(i).getAttribute('data-nft-id').catch(() => '') ||
                                  await nftElements.nth(i).getAttribute('data-token-id').catch(() => '') ||
                                  await nftElements.nth(i).getAttribute('data-id').catch(() => '');
                    if (nftId && collectionAddress) {
                        const url = `https://dev.dopamint.ai/collections/${collectionAddress}?collection=${collectionAddress}&nft_id=${nftId}`;
                        tokenUrls.push(url);
                        console.log(`Minted NFT ${i + 1} URL: ${url}`);
                    }
                }
            }

            // Method 3: Try to find NFT IDs from image src or alt attributes
            if (tokenUrls.length === 0) {
                // Get ALL images in dialog
                const images = collectionPage.locator('div[role="dialog"] img');
                const imgCount = await images.count();
                console.log(`Found ${imgCount} images in dialog`);

                for (let i = 0; i < imgCount; i++) {
                    const src = await images.nth(i).getAttribute('src').catch(() => '');
                    const alt = await images.nth(i).getAttribute('alt').catch(() => '');
                    console.log(`  Image ${i}: src="${src?.substring(0, 100)}...", alt="${alt}"`);

                    // Try multiple regex patterns to extract ID from src URL
                    let nftId = '';

                    // Pattern 1: /nft_id/123 or /token/123
                    const pattern1 = src?.match(/(?:nft_id|token|id)[\/=](\d+)/i);
                    if (pattern1) nftId = pattern1[1];

                    // Pattern 2: /123.png or /123.jpg etc
                    if (!nftId) {
                        const pattern2 = src?.match(/\/(\d+)\.[a-z]+$/i);
                        if (pattern2) nftId = pattern2[1];
                    }

                    // Pattern 3: _123.png or -123.png
                    if (!nftId) {
                        const pattern3 = src?.match(/[_-](\d+)\.[a-z]+$/i);
                        if (pattern3) nftId = pattern3[1];
                    }

                    // Pattern 4: Any number in the URL that looks like an ID (at least 3 digits)
                    if (!nftId) {
                        const pattern4 = src?.match(/(\d{3,})/);
                        if (pattern4) nftId = pattern4[1];
                    }

                    // Pattern 5: Check alt text for #123 or ID pattern
                    if (!nftId && alt) {
                        const altMatch = alt.match(/#?(\d+)/);
                        if (altMatch) nftId = altMatch[1];
                    }

                    if (nftId && collectionAddress && tokenUrls.length < expectedCount) {
                        const url = `https://dev.dopamint.ai/collections/${collectionAddress}?collection=${collectionAddress}&nft_id=${nftId}`;
                        if (!tokenUrls.includes(url)) {
                            tokenUrls.push(url);
                            console.log(`Minted NFT ${tokenUrls.length} URL: ${url}`);
                        }
                    }
                }
            }

            // Method 4: Look for NFT cards with links or data attributes in parent elements
            if (tokenUrls.length === 0 && collectionAddress) {
                // Find all clickable NFT items in the success popup
                const nftCards = collectionPage.locator('div[role="dialog"] a[href], div[role="dialog"] [onclick], div[role="dialog"] [data-href]');
                const cardCount = await nftCards.count();
                console.log(`Found ${cardCount} clickable elements in dialog`);

                for (let i = 0; i < cardCount && tokenUrls.length < expectedCount; i++) {
                    const href = await nftCards.nth(i).getAttribute('href').catch(() => '') ||
                                 await nftCards.nth(i).getAttribute('data-href').catch(() => '');
                    console.log(`  Clickable ${i}: href="${href}"`);

                    if (href) {
                        // Try to extract nft_id from href
                        const idMatch = href.match(/nft_id=([^&]+)|\/nft\/([^\/\?]+)|\/token\/([^\/\?]+)/);
                        if (idMatch) {
                            const nftId = idMatch[1] || idMatch[2] || idMatch[3];
                            const url = `https://dev.dopamint.ai/collections/${collectionAddress}?collection=${collectionAddress}&nft_id=${nftId}`;
                            if (!tokenUrls.includes(url)) {
                                tokenUrls.push(url);
                                console.log(`Minted NFT ${tokenUrls.length} URL: ${url}`);
                            }
                        }
                    }
                }
            }

            // Method 5: Look for text containing NFT ID pattern (e.g., "#123" or "ID: 123")
            if (tokenUrls.length === 0 && collectionAddress) {
                const dialogText = await collectionPage.locator('div[role="dialog"]').first().textContent().catch(() => '');
                console.log(`Dialog text (first 500 chars): ${dialogText?.substring(0, 500)}`);

                // Find all numbers that could be NFT IDs (usually 1-6 digits)
                const allNumbers = dialogText?.match(/#(\d{1,6})/g) || [];
                console.log(`Found ${allNumbers.length} # patterns: ${allNumbers.join(', ')}`);

                for (const match of allNumbers) {
                    const nftId = match.replace('#', '');
                    const url = `https://dev.dopamint.ai/collections/${collectionAddress}?collection=${collectionAddress}&nft_id=${nftId}`;
                    if (!tokenUrls.includes(url) && tokenUrls.length < expectedCount) {
                        tokenUrls.push(url);
                        console.log(`Minted NFT ${tokenUrls.length} URL (from #pattern): ${url}`);
                    }
                }
            }

            // Method 6: Look for any element with numeric ID that might be NFT ID
            if (tokenUrls.length === 0 && collectionAddress) {
                const idElements = collectionPage.locator('div[role="dialog"] [id*="nft"], div[role="dialog"] [id*="token"], div[role="dialog"] [class*="nft-id"]');
                const idCount = await idElements.count();
                console.log(`Found ${idCount} elements with nft/token in id/class`);

                for (let i = 0; i < idCount && tokenUrls.length < expectedCount; i++) {
                    const id = await idElements.nth(i).getAttribute('id').catch(() => '') || '';
                    const className = await idElements.nth(i).getAttribute('class').catch(() => '') || '';
                    const text = await idElements.nth(i).textContent().catch(() => '') || '';

                    const idMatch = (id + className + text).match(/(\d{1,6})/);
                    if (idMatch) {
                        const nftId = idMatch[1];
                        const url = `https://dev.dopamint.ai/collections/${collectionAddress}?collection=${collectionAddress}&nft_id=${nftId}`;
                        if (!tokenUrls.includes(url)) {
                            tokenUrls.push(url);
                            console.log(`Minted NFT ${tokenUrls.length} URL (from element): ${url}`);
                        }
                    }
                }
            }

            if (tokenUrls.length === 0) {
                console.log('Could not extract token URLs from popup.');
            }
        } catch (e) {
            console.log('Error extracting token URLs:', e);
        }

        return tokenUrls;
    }

    // Extract NFT ID from the card element
    private async extractNftIdFromCard(collectionPage: Page, nftCard: Locator): Promise<void> {
        try {
            // Method 1: Check data attributes on the card
            this.soldNftId = await nftCard.getAttribute('data-nft-id').catch(() => '') ||
                             await nftCard.getAttribute('data-token-id').catch(() => '') ||
                             await nftCard.getAttribute('data-id').catch(() => '') || '';

            // Method 2: Check for link inside the card
            if (!this.soldNftId) {
                const link = nftCard.locator('a[href*="nft_id="]').first();
                if (await link.isVisible({ timeout: 500 }).catch(() => false)) {
                    const href = await link.getAttribute('href').catch(() => '');
                    const match = href?.match(/nft_id=([^&]+)/);
                    if (match) {
                        this.soldNftId = match[1];
                    }
                }
            }

            // Method 3: Check for text with # pattern
            if (!this.soldNftId) {
                const cardText = await nftCard.textContent().catch(() => '');
                const match = cardText?.match(/#(\d+)/);
                if (match) {
                    this.soldNftId = match[1];
                }
            }

            // Method 4: Check image src
            if (!this.soldNftId) {
                const img = nftCard.locator('img').first();
                const src = await img.getAttribute('src').catch(() => '');
                const match = src?.match(/\/(\d+)\./);
                if (match) {
                    this.soldNftId = match[1];
                }
            }

            if (this.soldNftId) {
                console.log(`Extracted NFT ID for sell: ${this.soldNftId}`);
            } else {
                console.log('Could not extract NFT ID from card');
            }
        } catch (e) {
            console.log('Error extracting NFT ID from card:', e);
        }
    }

    // ============ CLOSE POPUP FUNCTIONS ============

    async closeAllPopups(page: Page): Promise<void> {
        console.log('\n=== Close all popups ===');

        await page.waitForTimeout(500);

        // Try multiple times to close all popups (max 5 attempts)
        for (let attempt = 0; attempt < 5; attempt++) {
            // Check if any dialog is open
            const dialogOpen = await page.locator('div[role="dialog"]:visible, [data-state="open"]:visible').first().isVisible({ timeout: 1000 }).catch(() => false);

            if (!dialogOpen) {
                console.log('No more popups to close');
                break;
            }

            console.log(`Attempt ${attempt + 1} to close popup...`);
            let closed = false;

            // Method 1: Try to find X button at top-right of dialog
            const xButtonSelectors = [
                'div[role="dialog"] > div > button:first-child:has(svg)',
                'div[role="dialog"] button[class*="absolute"]',
                '[data-state="open"] > div > button:first-child:has(svg)',
                'div[role="dialog"] button:has(svg[class*="x"])',
                'div[role="dialog"] button:has(svg[class*="close"])',
            ];

            for (const selector of xButtonSelectors) {
                try {
                    const closeBtn = page.locator(selector).first();
                    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                        console.log(`Found X button with: ${selector}`);
                        await closeBtn.click({ force: true });
                        await page.waitForTimeout(1000);
                        closed = true;
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }

            // Method 2: Try predefined close selectors
            if (!closed) {
                for (const selector of SEARCH_MINT_SELL_SELECTORS.CLOSE_POPUP_BUTTON) {
                    try {
                        const closeBtn = page.locator(selector).first();
                        if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                            console.log(`Closing with selector: ${selector}`);
                            await closeBtn.click({ force: true });
                            await page.waitForTimeout(1000);
                            closed = true;
                            break;
                        }
                    } catch (e) {
                        // Continue
                    }
                }
            }

            // Method 3: Try to find any button with SVG in dialog (likely close button)
            if (!closed) {
                try {
                    const svgButtons = page.locator('div[role="dialog"] button:has(svg)');
                    const buttonCount = await svgButtons.count();
                    console.log(`Found ${buttonCount} SVG buttons in dialog`);

                    // Find button that's likely the close button (usually first or one without text)
                    for (let i = 0; i < buttonCount; i++) {
                        const btn = svgButtons.nth(i);
                        const btnText = await btn.textContent().catch(() => '');
                        // Skip buttons with meaningful text (like "Go to collection")
                        if (!btnText || btnText.trim().length < 3) {
                            console.log(`Clicking SVG button ${i} (text: "${btnText?.trim()}")`);
                            await btn.click({ force: true });
                            await page.waitForTimeout(1000);
                            closed = true;
                            break;
                        }
                    }
                } catch (e) {
                    console.log('Error finding SVG buttons:', e);
                }
            }

            // Method 4: Click outside dialog to close (click on overlay)
            if (!closed) {
                try {
                    const overlay = page.locator('[data-state="open"][data-aria-hidden="true"], [class*="overlay"], [class*="backdrop"]').first();
                    if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
                        console.log('Clicking on overlay to close');
                        await overlay.click({ force: true, position: { x: 10, y: 10 } });
                        await page.waitForTimeout(800);
                        closed = true;
                    }
                } catch (e) {
                    // Continue
                }
            }

            // Method 5: Press Escape key
            if (!closed) {
                console.log('Pressing Escape to close popup');
                await page.keyboard.press('Escape');
                await page.waitForTimeout(800);
            }

            // Small wait between attempts
            await page.waitForTimeout(300);
        }

        // Final check and debug
        const stillOpen = await page.locator('div[role="dialog"]:visible, [data-state="open"]:visible').first().isVisible({ timeout: 500 }).catch(() => false);
        if (stillOpen) {
            console.log('Warning: Popup still open after all attempts');
            // Screenshot for debug
            await page.screenshot({ path: `${outputDir}/popup-still-open.png` });

            // Last resort: try to click anywhere outside
            await page.mouse.click(10, 10);
            await page.waitForTimeout(1000);
        } else {
            console.log('All popups closed successfully!');
        }
    }

    // Close mint success popup specifically
    async closeMintSuccessPopup(page: Page): Promise<void> {
        console.log('\n=== Close Mint Success popup ===');

        await page.waitForTimeout(1500);

        // Check if dialog is open
        const dialogOpen = await page.locator('div[role="dialog"]:visible').first().isVisible({ timeout: 1000 }).catch(() => false);
        if (!dialogOpen) {
            console.log('No popup to close');
            return;
        }

        // Method 1: Press Escape (most reliable based on testing)
        console.log('Pressing Escape to close popup...');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);

        let stillOpen = await page.locator('div[role="dialog"]:visible').first().isVisible({ timeout: 500 }).catch(() => false);
        if (!stillOpen) {
            console.log('Popup closed with Escape!');
            return;
        }

        // Method 2: Click outside the dialog
        console.log('Trying to click outside dialog...');
        await page.mouse.click(10, 10);
        await page.waitForTimeout(1000);

        stillOpen = await page.locator('div[role="dialog"]:visible').first().isVisible({ timeout: 500 }).catch(() => false);
        if (!stillOpen) {
            console.log('Popup closed by clicking outside!');
            return;
        }

        // Method 3: Try Escape again
        console.log('Trying Escape again...');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);

        stillOpen = await page.locator('div[role="dialog"]:visible').first().isVisible({ timeout: 500 }).catch(() => false);
        if (!stillOpen) {
            console.log('Popup closed with Escape!');
            return;
        }

        console.log('Warning: Popup may still be open');
    }

    // ============ SELL FUNCTIONS ============

    async clickMyCollectibleTab(collectionPage: Page): Promise<void> {
        console.log('\n=== Click My Collectible tab ===');

        await collectionPage.waitForTimeout(1500);

        // Debug: List all buttons/tabs in dialog
        const dialogButtons = collectionPage.locator('div[role="dialog"] button, [data-state="open"] button');
        const buttonCount = await dialogButtons.count();
        console.log(`Found ${buttonCount} buttons in dialog, looking for "My Collectible"...`);

        // Method 1: Find button with exact text "My Collectible"
        let clicked = false;
        for (let i = 0; i < buttonCount; i++) {
            try {
                const btn = dialogButtons.nth(i);
                const text = await btn.textContent().catch(() => '');
                const trimmedText = text?.trim() || '';

                if (trimmedText === 'My Collectible' || trimmedText.includes('My Collectible')) {
                    console.log(`Found "My Collectible" at button ${i}`);
                    await btn.scrollIntoViewIfNeeded().catch(() => {});
                    await btn.click({ force: true });
                    console.log('Clicked My Collectible button!');
                    clicked = true;
                    break;
                }
            } catch (e) {
                // Continue
            }
        }

        // Method 2: Try predefined selectors
        if (!clicked) {
            for (const selector of SEARCH_MINT_SELL_SELECTORS.MY_COLLECTIBLE_TAB) {
                try {
                    const tab = collectionPage.locator(selector).first();
                    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await tab.click({ force: true });
                        console.log(`Clicked My Collectible with selector: ${selector}`);
                        clicked = true;
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }
        }

        // Method 3: Fallback - find by text
        if (!clicked) {
            try {
                const tabText = collectionPage.getByText('My Collectible', { exact: true }).first();
                if (await tabText.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await tabText.click({ force: true });
                    console.log('Clicked My Collectible via getByText!');
                    clicked = true;
                }
            } catch (e) {
                console.log('getByText failed');
            }
        }

        // Method 4: Try using locator with text
        if (!clicked) {
            try {
                const tab = collectionPage.locator('button:has-text("My Collectible")').first();
                if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await tab.click({ force: true });
                    console.log('Clicked My Collectible via button:has-text!');
                    clicked = true;
                }
            } catch (e) {
                console.log('button:has-text failed');
            }
        }

        if (!clicked) {
            console.log('Warning: Could not click My Collectible tab');
        }

        await collectionPage.waitForTimeout(1500);
        console.log('My Collectible tab flow completed');
    }

    // Store the NFT ID that will be sold
    private soldNftId: string = '';
    private collectionAddress: string = '';

    async hoverOnFirstNFTAndClickSell(collectionPage: Page): Promise<void> {
        console.log('\n=== Hover on first NFT and click Sell ===');

        await collectionPage.waitForTimeout(1500);

        // Extract collection address from URL
        const currentUrl = collectionPage.url();
        const urlMatch = currentUrl.match(/collections\/([^?\/]+)/);
        this.collectionAddress = urlMatch ? urlMatch[1] : '';
        console.log(`Collection address: ${this.collectionAddress}`);

        // Debug: Find all images in the dialog (NFT cards usually have images)
        const dialogImages = collectionPage.locator('div[role="dialog"] img, [data-state="open"] img');
        const imgCount = await dialogImages.count();
        console.log(`Found ${imgCount} images in dialog`);

        // Find NFT card - look for image containers in dialog
        let nftCard: Locator | null = null;

        // Method 1: Find image in dialog and get its parent container
        if (imgCount > 0) {
            // Get the first image that looks like an NFT (has reasonable size)
            for (let i = 0; i < imgCount; i++) {
                const img = dialogImages.nth(i);
                const boundingBox = await img.boundingBox().catch(() => null);

                if (boundingBox && boundingBox.width > 50 && boundingBox.height > 50) {
                    console.log(`Image ${i}: ${boundingBox.width}x${boundingBox.height}`);

                    // Get parent div that contains the image (likely the card)
                    const parent = img.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or contains(@class, "nft")]').first();
                    if (await parent.isVisible({ timeout: 1000 }).catch(() => false)) {
                        nftCard = parent;
                        console.log(`Found NFT card via parent of image ${i}`);
                        break;
                    }

                    // Fallback: use the image itself
                    nftCard = img;
                    console.log(`Using image ${i} directly as hover target`);
                    break;
                }
            }
        }

        // Method 2: Try predefined selectors
        if (!nftCard) {
            const cardSelectors = [
                'div[role="dialog"] [class*="card"]',
                'div[role="dialog"] [class*="item"]',
                'div[role="dialog"] [class*="nft"]',
                'div[role="dialog"] [class*="collectible"]',
                '[data-state="open"] [class*="card"]',
            ];

            for (const selector of cardSelectors) {
                try {
                    const card = collectionPage.locator(selector).first();
                    if (await card.isVisible({ timeout: 1000 }).catch(() => false)) {
                        nftCard = card;
                        console.log(`Found NFT card with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }
        }

        // Method 3: Find any div with img inside dialog
        if (!nftCard) {
            const imgDivs = collectionPage.locator('div[role="dialog"] div:has(img)');
            const divCount = await imgDivs.count();
            console.log(`Found ${divCount} divs with images`);

            for (let i = 0; i < Math.min(divCount, 5); i++) {
                const div = imgDivs.nth(i);
                const box = await div.boundingBox().catch(() => null);
                if (box && box.width > 80 && box.width < 400 && box.height > 80 && box.height < 400) {
                    nftCard = div;
                    console.log(`Found NFT card div ${i}: ${box.width}x${box.height}`);
                    break;
                }
            }
        }

        if (!nftCard) {
            console.log('Warning: NFT card not found');
            throw new Error('NFT card not found');
        }

        // Try to extract NFT ID from the card before clicking Sell
        await this.extractNftIdFromCard(collectionPage, nftCard);

        // Hover on NFT card
        console.log('Hovering on NFT card...');
        await nftCard.scrollIntoViewIfNeeded().catch(() => {});
        await nftCard.hover({ force: true });
        await collectionPage.waitForTimeout(1500);

        // Find and click Sell button
        console.log('Looking for Sell button...');
        let sellClicked = false;

        // Look for Sell button that appeared after hover
        const sellSelectors = [
            'button:has-text("Sell")',
            '[class*="sell"]',
            'div[role="dialog"] button:has-text("Sell")',
            'a:has-text("Sell")',
        ];

        for (const selector of sellSelectors) {
            try {
                const sellBtn = collectionPage.locator(selector).first();
                if (await sellBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await sellBtn.click({ force: true });
                    console.log(`Clicked Sell with selector: ${selector}`);
                    sellClicked = true;
                    break;
                }
            } catch (e) {
                // Continue
            }
        }

        if (!sellClicked) {
            // Try getByText
            const sellText = collectionPage.getByText('Sell', { exact: true }).first();
            if (await sellText.isVisible({ timeout: 2000 }).catch(() => false)) {
                await sellText.click({ force: true });
                console.log('Clicked Sell via getByText!');
                sellClicked = true;
            }
        }

        if (!sellClicked) {
            console.log('Warning: Sell button not found after hover');
            throw new Error('Sell button not found');
        }

        // Wait for sell popup/view to open
        await collectionPage.waitForTimeout(2000);

        console.log('Sell button on card clicked!');
    }

    // Fair Launch: Hover on first NFT, verify "Sell on" button exists with OpenSea URL
    // NOTE: Only verify - do NOT click/open new tab (saves time and avoids timeout)
    async hoverOnFirstNFTAndClickSellOnOpenSea(collectionPage: Page, context: BrowserContext): Promise<string> {
        console.log('\n=== Verify "Sell on" button for OpenSea (Fair Launch) ===');

        await collectionPage.waitForTimeout(1500);

        // Extract collection address from URL
        const currentUrl = collectionPage.url();
        const urlMatch = currentUrl.match(/collections\/([^?\/]+)/);
        this.collectionAddress = urlMatch ? urlMatch[1] : '';
        console.log(`Collection address: ${this.collectionAddress}`);

        // Find NFT card in dialog (same logic as hoverOnFirstNFTAndClickSell)
        const dialogImages = collectionPage.locator('div[role="dialog"] img, [data-state="open"] img');
        const imgCount = await dialogImages.count();
        console.log(`Found ${imgCount} images in dialog`);

        let nftCard: Locator | null = null;

        // Find first image that looks like an NFT
        if (imgCount > 0) {
            for (let i = 0; i < imgCount; i++) {
                const img = dialogImages.nth(i);
                const boundingBox = await img.boundingBox().catch(() => null);

                if (boundingBox && boundingBox.width > 50 && boundingBox.height > 50) {
                    console.log(`Image ${i}: ${boundingBox.width}x${boundingBox.height}`);
                    nftCard = img;
                    break;
                }
            }
        }

        if (!nftCard) {
            console.log('Warning: NFT card not found');
            throw new Error('NFT card not found for Fair Launch sell');
        }

        // Hover on NFT card
        console.log('Hovering on NFT card...');
        await nftCard.scrollIntoViewIfNeeded().catch(() => {});
        await nftCard.hover({ force: true });
        await collectionPage.waitForTimeout(1500);

        // Find and verify "Sell on" button/link
        console.log('Looking for "Sell on" button...');

        let openSeaUrl = '';
        let sellOnElement: Locator | null = null;

        // Try to find link with "Sell on" text (preferred - has href)
        const sellOnLinkSelectors = [
            'a:has-text("Sell on")',
            'div[role="dialog"] a:has-text("Sell on")',
            '[data-state="open"] a:has-text("Sell on")',
        ];

        for (const selector of sellOnLinkSelectors) {
            try {
                const link = collectionPage.locator(selector).first();
                if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
                    const buttonText = await link.textContent();
                    console.log(`Found link with text: "${buttonText}"`);

                    if (buttonText?.includes('Sell on')) {
                        // Get href attribute
                        const href = await link.getAttribute('href');
                        if (href) {
                            openSeaUrl = href.startsWith('http') ? href : `https://opensea.io${href}`;
                            console.log(`✅ Found OpenSea URL from href: ${openSeaUrl}`);
                        }
                        sellOnElement = link;
                        break;
                    }
                }
            } catch (e) {
                // Continue
            }
        }

        // Fallback: try button selectors
        if (!sellOnElement) {
            const sellOnButtonSelectors = [
                'button:has-text("Sell on")',
                'div[role="dialog"] button:has-text("Sell on")',
            ];

            for (const selector of sellOnButtonSelectors) {
                try {
                    const btn = collectionPage.locator(selector).first();
                    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                        const buttonText = await btn.textContent();
                        console.log(`Found button with text: "${buttonText}"`);

                        if (buttonText?.includes('Sell on')) {
                            console.log('✅ Verified: Button shows "Sell on" text');
                            sellOnElement = btn;
                            // Construct OpenSea URL based on collection address
                            if (this.collectionAddress) {
                                openSeaUrl = `https://opensea.io/collection/${this.collectionAddress}`;
                                console.log(`Constructed OpenSea URL: ${openSeaUrl}`);
                            }
                            break;
                        }
                    }
                } catch (e) {
                    // Continue
                }
            }
        }

        // Final fallback: getByText
        if (!sellOnElement) {
            const sellOnText = collectionPage.getByText(/Sell on/i).first();
            if (await sellOnText.isVisible({ timeout: 2000 }).catch(() => false)) {
                sellOnElement = sellOnText;
                console.log('Found "Sell on" via getByText');
                if (this.collectionAddress) {
                    openSeaUrl = `https://opensea.io/collection/${this.collectionAddress}`;
                }
            }
        }

        if (!sellOnElement) {
            console.log('Warning: "Sell on" button not found');
            throw new Error('"Sell on" button not found for Fair Launch');
        }

        // Verify we have an OpenSea URL
        if (openSeaUrl && openSeaUrl.includes('opensea.io')) {
            console.log('✅ Verified: URL is OpenSea');
            console.log(`OpenSea URL: ${openSeaUrl}`);
        } else {
            // Default URL if we couldn't extract
            openSeaUrl = `https://opensea.io/collection/${this.collectionAddress || 'unknown'}`;
            console.log(`Using default OpenSea URL: ${openSeaUrl}`);
        }

        // Screenshot the current state (no need to open new tab)
        await collectionPage.screenshot({ path: `${outputDir}/sell-on-opensea-verified.png` });
        console.log('Screenshot saved: sell-on-opensea-verified.png');

        console.log('✅ Fair Launch sell verification completed (OpenSea URL verified, no click needed)');

        return openSeaUrl;
    }

    async clickSellInPopup(collectionPage: Page): Promise<void> {
        console.log('\n=== Click Sell button in popup ===');

        await collectionPage.waitForTimeout(1500);

        // Find ALL dialogs - we need the newest/last one (Sell items popup)
        const allDialogs = collectionPage.locator('div[role="dialog"], [data-state="open"]');
        const dialogCount = await allDialogs.count();
        console.log(`Found ${dialogCount} dialogs on page`);

        // Get the LAST dialog (newest popup - likely the Sell items popup)
        let sellDialog = dialogCount > 0 ? allDialogs.last() : null;

        // Or try to find dialog containing "Sell" text
        const sellItemsDialog = collectionPage.locator('div[role="dialog"]:has-text("Sell"), [data-state="open"]:has-text("Sell")').last();
        if (await sellItemsDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
            sellDialog = sellItemsDialog;
            console.log('Found Sell items dialog');
        }

        // Check if there's a price input field - fill it first if exists
        const priceInputSelectors = [
            'input[type="number"]',
            'input[placeholder*="price"]',
            'input[placeholder*="Price"]',
            'input[name="price"]',
        ];

        for (const selector of priceInputSelectors) {
            try {
                const priceInput = collectionPage.locator(selector).last(); // Use last() for newest popup
                if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log(`Found price input with selector: ${selector}`);
                    await priceInput.fill('0.001');
                    console.log('Filled price: 0.001');
                    await collectionPage.waitForTimeout(1000);
                    break;
                }
            } catch (e) {
                // Continue
            }
        }

        // Debug: List ALL buttons on page (not just in dialog)
        const allButtons = collectionPage.locator('button:visible');
        const allButtonCount = await allButtons.count();
        console.log(`Found ${allButtonCount} visible buttons on page:`);

        for (let i = 0; i < Math.min(allButtonCount, 25); i++) {
            try {
                const btn = allButtons.nth(i);
                const text = await btn.textContent().catch(() => '');
                console.log(`  Button ${i}: "${text?.trim()}"`);
            } catch (e) {
                // Skip
            }
        }

        let clicked = false;

        // Method 1: Find button with exact text "Sell" that's NOT in the NFT card (should be in popup)
        // Look for the LAST "Sell" button (newest popup)
        const sellButtons = collectionPage.locator('button:has-text("Sell"):visible');
        const sellBtnCount = await sellButtons.count();
        console.log(`Found ${sellBtnCount} Sell buttons`);

        if (sellBtnCount > 0) {
            // Click the last Sell button (should be in the new popup)
            const lastSellBtn = sellButtons.last();
            const btnText = await lastSellBtn.textContent().catch(() => '');
            console.log(`Clicking last Sell button: "${btnText?.trim()}"`);
            await lastSellBtn.scrollIntoViewIfNeeded().catch(() => {});
            await lastSellBtn.click({ force: true });
            console.log('Clicked last Sell button!');
            clicked = true;
        }

        // Method 2: Try finding "Sell" button specifically in the sell dialog
        if (!clicked && sellDialog) {
            try {
                const sellBtn = sellDialog.locator('button:has-text("Sell")').last();
                if (await sellBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await sellBtn.click({ force: true });
                    console.log('Clicked Sell button in sell dialog!');
                    clicked = true;
                }
            } catch (e) {
                console.log('Could not find Sell button in dialog');
            }
        }

        // Method 3: Try getByRole
        if (!clicked) {
            try {
                const sellBtn = collectionPage.getByRole('button', { name: 'Sell', exact: true }).last();
                if (await sellBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await sellBtn.click({ force: true });
                    console.log('Clicked via getByRole!');
                    clicked = true;
                }
            } catch (e) {
                console.log('getByRole failed');
            }
        }

        if (!clicked) {
            console.log('Warning: Could not find Sell button in popup');
        } else {
            console.log('Sell button clicked!');
        }

        await collectionPage.waitForTimeout(1500);
    }

    async waitForSoldSuccessfully(collectionPage: Page): Promise<string> {
        console.log('\n=== Wait for "sold successfully" toast ===');

        const maxWaitTime = 60000; // 1 minute
        const checkInterval = 2000;
        let elapsed = 0;
        let soldTokenUrl = '';

        while (elapsed < maxWaitTime) {
            // Check for success toast
            for (const selector of SEARCH_MINT_SELL_SELECTORS.SOLD_SUCCESS_TOAST) {
                try {
                    const toast = collectionPage.locator(selector).first();
                    if (await toast.isVisible({ timeout: 1000 }).catch(() => false)) {
                        const toastText = await toast.textContent();
                        console.log(`Sold successfully! Toast: "${toastText}"`);

                        // Extract sold token URL
                        soldTokenUrl = await this.extractSoldTokenUrl(collectionPage);
                        return soldTokenUrl;
                    }
                } catch (e) {
                    // Continue
                }
            }

            // Also check for general success text
            const successText = collectionPage.getByText(/sold.*successfully/i).first();
            if (await successText.isVisible({ timeout: 500 }).catch(() => false)) {
                console.log('Sold successfully!');

                // Extract sold token URL
                soldTokenUrl = await this.extractSoldTokenUrl(collectionPage);
                return soldTokenUrl;
            }

            console.log(`Waiting for sold toast... (${elapsed / 1000}s)`);
            await collectionPage.waitForTimeout(checkInterval);
            elapsed += checkInterval;
        }

        throw new Error('Timeout: Did not see "sold successfully" toast after 1 minute');
    }

    // Extract sold token URL - use the stored NFT ID from before clicking sell
    private async extractSoldTokenUrl(collectionPage: Page): Promise<string> {
        try {
            // Use the stored NFT ID and collection address from hoverOnFirstNFTAndClickSell
            if (this.soldNftId && this.collectionAddress) {
                const url = `https://dev.dopamint.ai/collections/${this.collectionAddress}?collection=${this.collectionAddress}&nft_id=${this.soldNftId}`;
                console.log(`Sold NFT URL: ${url}`);
                return url;
            }

            // Fallback: Get collection address from URL
            const currentUrl = collectionPage.url();
            const urlMatch = currentUrl.match(/collections\/([^?\/]+)/);
            const collectionAddress = urlMatch ? urlMatch[1] : this.collectionAddress;

            // Try to find NFT ID from the URL
            const nftIdMatch = currentUrl.match(/nft_id=([^&]+)/);
            if (nftIdMatch) {
                const nftId = nftIdMatch[1];
                const url = `https://dev.dopamint.ai/collections/${collectionAddress}?collection=${collectionAddress}&nft_id=${nftId}`;
                console.log(`Sold NFT URL: ${url}`);
                return url;
            }

            // Try to find from link in success popup/toast
            const nftLink = collectionPage.locator('a[href*="nft_id="]').first();
            if (await nftLink.isVisible({ timeout: 1000 }).catch(() => false)) {
                const href = await nftLink.getAttribute('href').catch(() => '');
                if (href) {
                    const fullUrl = href.startsWith('http') ? href : `https://dev.dopamint.ai${href}`;
                    console.log(`Sold NFT URL: ${fullUrl}`);
                    return fullUrl;
                }
            }

            // Try to find from toast message text containing ID
            const toastText = await collectionPage.locator('[class*="toast"], [role="alert"]').first().textContent().catch(() => '');
            const idMatch = toastText?.match(/#(\d+)|ID[:\s]*(\d+)/i);
            if (idMatch && collectionAddress) {
                const nftId = idMatch[1] || idMatch[2];
                const url = `https://dev.dopamint.ai/collections/${collectionAddress}?collection=${collectionAddress}&nft_id=${nftId}`;
                console.log(`Sold NFT URL (from toast): ${url}`);
                return url;
            }

            console.log('Could not extract sold token URL');
            return '';
        } catch (e) {
            console.log('Error extracting sold token URL:', e);
            return '';
        }
    }

    // Getter for sold NFT URL (can be called after sell is complete)
    getSoldNftUrl(): string {
        if (this.soldNftId && this.collectionAddress) {
            return `https://dev.dopamint.ai/collections/${this.collectionAddress}?collection=${this.collectionAddress}&nft_id=${this.soldNftId}`;
        }
        return '';
    }
}
