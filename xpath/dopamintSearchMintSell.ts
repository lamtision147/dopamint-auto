export const SEARCH_MINT_SELL_SELECTORS = {
    // ============ SEARCH SELECTORS ============

    // Search button on header bar - look for magnifying glass icon or Search text
    SEARCH_BUTTON: [
        // Look for button/link with "Search" text
        'header a:has-text("Search")',
        'nav a:has-text("Search")',
        'header button:has-text("Search")',
        'nav button:has-text("Search")',
        // Look for search icon button
        'button[aria-label="Search"]',
        'a[aria-label="Search"]',
        '[data-testid="search-button"]',
        // Search icon in header/nav
        'header button:has(svg)',
        'nav button:has(svg)',
        // Generic clickable with search
        '[href*="search"]',
        'a[href*="marketplace"]',
    ],

    // Search input field
    SEARCH_INPUT: [
        'input[type="search"]',
        'input[placeholder*="Search"]',
        'input[placeholder*="search"]',
        'input[placeholder*="Find"]',
        '[data-testid="search-input"]',
        'input[name="search"]',
        'input[name="q"]',
        // Generic visible input in search area
        '[class*="search"] input',
        'form input[type="text"]',
    ],

    // Search result item
    SEARCH_RESULT_ITEM: [
        '[class*="search-result"]',
        '[data-testid="search-result"]',
        '[class*="dropdown"] [class*="item"]',
        'li:has-text("Auto Banana Pro")',
        'div[role="option"]',
    ],

    // ============ COLLECTION DETAILS SELECTORS ============

    // Collection title/name on details page
    COLLECTION_TITLE: [
        'h1',
        '[class*="collection-title"]',
        '[class*="collection-name"]',
        '[data-testid="collection-title"]',
    ],

    // My Collectible tab
    MY_COLLECTIBLE_TAB: [
        'button:has-text("My Collectible")',
        '[role="tab"]:has-text("My Collectible")',
        'a:has-text("My Collectible")',
        '[data-testid="my-collectible-tab"]',
    ],

    // NFT card in grid
    NFT_CARD: [
        '[class*="nft-card"]',
        '[class*="collectible-card"]',
        '[data-testid="nft-card"]',
        'div[class*="card"]:has(img)',
    ],

    // ============ MINT SELECTORS ============

    // Mint this button on collection page
    MINT_THIS_BUTTON: [
        'button:has-text("Mint this")',
        'a:has-text("Mint this")',
        '[data-testid="mint-button"]',
    ],

    // Upload image in mint dialog
    MINT_UPLOAD_INPUT: '//div[contains(@id, "content-buy")]//input[@type="file"]',

    // Add button to add more NFT slot
    ADD_NFT_BUTTON: [
        'button:has-text("+ Add")',
        'button:has-text("+Add")',
        'button:has-text("Add"):not(:has-text("Add Network"))',
        '[data-testid="add-nft"]',
    ],

    // Mint button in mint dialog
    MINT_BUTTON: [
        'button:has-text("Mint"):not(:has-text("Mint this"))',
        'button[type="submit"]:has-text("Mint")',
        '[data-testid="mint-submit"]',
    ],

    // Generate button in mint confirm popup
    MINT_GENERATE_BUTTON: [
        'div[role="dialog"] button:has-text("Generate")',
        '[data-state="open"] button:has-text("Generate")',
        'button:has-text("Generate")',
    ],

    // Minted Successfully text
    MINTED_SUCCESS_TEXT: [
        'text=/Minted.*NFT.*Successfully/i',
        'div:has-text("Minted"):has-text("Successfully")',
        'text=Minted',
    ],

    // ============ SELL SELECTORS ============

    // Sell button that appears on hover
    SELL_BUTTON_ON_CARD: [
        'button:has-text("Sell")',
        '[data-testid="sell-button"]',
        '[class*="sell-btn"]',
    ],

    // Sell button in popup
    SELL_BUTTON_IN_POPUP: [
        'div[role="dialog"] button:has-text("Sell")',
        '[data-state="open"] button:has-text("Sell")',
        'button[type="submit"]:has-text("Sell")',
    ],

    // Sold successfully toast/notification
    SOLD_SUCCESS_TOAST: [
        'text=/sold.*successfully/i',
        'text=/Sold.*Successfully/i',
        '[class*="toast"]:has-text("sold")',
        '[class*="notification"]:has-text("sold")',
        '[role="alert"]:has-text("sold")',
    ],

    // ============ COMMON POPUP SELECTORS ============

    // Close popup button (x button) - more specific selectors
    CLOSE_POPUP_BUTTON: [
        // X button in dialog header
        'div[role="dialog"] button[class*="close"]',
        '[data-state="open"] button[class*="close"]',
        // SVG close button in dialog
        'div[role="dialog"] > div > button:has(svg)',
        '[data-state="open"] > div > button:has(svg)',
        // Aria labeled close
        'button[aria-label="Close"]',
        'button[aria-label="close"]',
        // Generic SVG button in dialog
        'div[data-state="open"] button:has(svg)',
        '.dialog-close-button',
        '[data-radix-collection-item] button:has(svg)',
        // Button with X text
        'div[role="dialog"] button:has-text("×")',
        'div[role="dialog"] button:has-text("X")',
    ],

    // Mint Success popup specific - "Go to collection" or close
    MINT_SUCCESS_CLOSE: [
        // First try close button specifically
        'div[role="dialog"] button[class*="close"]',
        '[data-state="open"] button[class*="close"]',
        // X button at top right of dialog
        'div[role="dialog"] > div:first-child button:has(svg)',
        // Absolute positioned close button
        'div[role="dialog"] button[class*="absolute"]',
        // Any button with SVG that's not "Go to collection"
        'div[role="dialog"] button:has(svg):not(:has-text("Go"))',
    ],

    // "Go to collection" button in success popup (if we need to click it)
    GO_TO_COLLECTION_BUTTON: [
        'button:has-text("Go to collection")',
        'a:has-text("Go to collection")',
        'button:has-text("View collection")',
        '[data-testid="go-to-collection"]',
    ],

    // Dialog/Modal
    DIALOG: [
        'div[role="dialog"]',
        '[data-state="open"]',
        '[class*="modal"]',
        '[class*="popup"]',
    ],
};
