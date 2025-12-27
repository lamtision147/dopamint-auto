export const CREATE_SELECTORS = {
    // Header
    CREATE_BUTTON: 'button:has-text("Create"), a:has-text("Create"), [href*="create"]',

    // Tutorial/Dialog popup close button
    TUTORIAL_BUTTON: [
        'div[data-state="open"] button:has(svg)',
        'button[aria-label="Close"]',
        'button[aria-label="close"]',
        '.dialog-close-button',
        '[data-radix-collection-item] button:has(svg)',
    ],

    // Choose Template - use more specific selectors
    CHANGE_BUTTON_TEMPLATE: [
        // Try to find card/button containing text "Change"
        '[class*="template"] >> text=Change',
        'div[class*="card"]:has-text("Change")',
        'button:has-text("Change")',
        // May be a clickable card
        '[data-template="change"]',
        'div:has-text("Change button") >> visible=true',
        // Or find by exact text
        'text=Change >> nth=0',
    ],

    // Card Selection - Motorbike
    MOTORBIKE_CARD: [
        '[class*="card"]:has-text("Motorbike")',
        'div[class*="template"]:has-text("Motorbike")',
        'button:has-text("Motorbike")',
        '[data-card="motorbike"]',
        'text=Motorbike',
    ],

    // Card Selection - Studio
    STUDIO_CARD: [
        '[class*="card"]:has-text("Studio")',
        'div[class*="template"]:has-text("Studio")',
        'button:has-text("Studio")',
        '[data-card="studio"]',
        'text=Studio',
    ],

    // Model Selection dropdown
    MODEL_SELECT: [
        'button:has-text("Select model")',
        '[role="combobox"]',
        'select',
        '[class*="select"]:has-text("Select")',
        'div[class*="dropdown"]',
    ],

    // Nano Banana Pro option in dropdown
    NANO_BANANA_PRO_OPTION: [
        '[role="option"]:has-text("Nano Banana Pro")',
        'li:has-text("Nano Banana Pro")',
        'div[role="listbox"] >> text=Nano Banana Pro',
        'text=Nano Banana Pro',
    ],

    // Nano Banana option in dropdown
    NANO_BANANA_OPTION: [
        '[role="option"]:has-text("Nano Banana"):not(:has-text("Pro"))',
        'li:has-text("Nano Banana"):not(:has-text("Pro"))',
        'div[role="listbox"] >> text=Nano Banana',
        'text=Nano Banana',
    ],

    // ChatGPT option in dropdown
    CHATGPT_OPTION: [
        '[role="option"]:has-text("ChatGPT"):not(:has-text("1.5"))',
        'li:has-text("ChatGPT"):not(:has-text("1.5"))',
        'div[role="listbox"] >> text=ChatGPT',
        'text=ChatGPT',
    ],

    // ChatGPT image 1.5 option in dropdown
    CHATGPT_15_OPTION: [
        '[role="option"]:has-text("ChatGPT image 1.5")',
        '[role="option"]:has-text("ChatGPT 1.5")',
        'li:has-text("ChatGPT image 1.5")',
        'li:has-text("ChatGPT 1.5")',
        'div[role="listbox"] >> text=ChatGPT image 1.5',
        'text=ChatGPT image 1.5',
        'text=ChatGPT 1.5',
    ],

    // Image Upload
    UPLOAD_IMAGE_AREA: 'input[type="file"], button:has-text("Upload"), div:has-text("Upload image")',
    UPLOAD_INPUT: 'input[type="file"]',

    // Generate Button
    GENERATE_BUTTON: [
        'button:has-text("Generate")',
        '[data-testid="generate-button"]',
        'button[type="submit"]:has-text("Generate")',
    ],

    // Generate Confirmation Popup
    GENERATE_CONFIRM_POPUP: [
        'div[role="dialog"]:has-text("Generate")',
        '[data-state="open"]:has-text("Generate")',
    ],
    GENERATE_CONFIRM_BUTTON: [
        'div[role="dialog"] button:has-text("Generate")',
        '[data-state="open"] button:has-text("Generate")',
        'button:has-text("Generate") >> nth=1',
    ],

    // Publish & Monetize Button (appears after image generation)
    PUBLISH_MONETIZE_BUTTON: [
        'button:has-text("Publish & Monetize")',
        'button:has-text("Publish")',
        '[data-testid="publish-button"]',
    ],

    // Publish Collection Popup
    COLLECTION_NAME_INPUT: [
        'input[name="collectionName"]',
        'input[placeholder*="Collection"]',
        'input[placeholder*="name"]',
        'label:has-text("Collection name") + input',
        'label:has-text("Collection name") ~ input',
    ],
    DESCRIPTION_INPUT: [
        'textarea[name="description"]',
        'textarea[placeholder*="Description"]',
        'label:has-text("Description") + textarea',
        'label:has-text("Description") ~ textarea',
    ],
    SYMBOL_INPUT: [
        'input[name="symbol"]',
        'input[placeholder*="Symbol"]',
        'label:has-text("Symbol") + input',
        'label:has-text("Symbol") ~ input',
    ],

    // Publish Button in popup
    PUBLISH_BUTTON: [
        'div[role="dialog"] button:has-text("Publish")',
        '[data-state="open"] button:has-text("Publish")',
        'button[type="submit"]:has-text("Publish")',
    ],

    // Confirm Publish Popup
    CONFIRM_PUBLISH_BUTTON: [
        'div[role="dialog"] button:has-text("Confirm")',
        '[data-state="open"] button:has-text("Confirm")',
        'button:has-text("Confirm")',
    ],

    // Published Successfully Popup
    PUBLISHED_SUCCESS_TEXT: [
        'text=Published Successfully',
        'text=Success',
        'div:has-text("Published Successfully")',
    ],

    // Go to Collection Button
    GO_TO_COLLECTION_BUTTON: [
        'button:has-text("Go to collection")',
        'a:has-text("Go to collection")',
        'button:has-text("View collection")',
    ],

    // ============ MINT NFT SELECTORS ============

    // Mint this button
    MINT_THIS_BUTTON: [
        'button:has-text("Mint this")',
        'a:has-text("Mint this")',
        '[data-testid="mint-button"]',
    ],

    // Upload image in mint UI - multiple selectors for file input
    MINT_UPLOAD_IMAGE: 'input[type="file"]',
    MINT_UPLOAD_AREA: [
        'div:has-text("Upload")',
        'div:has-text("Drop")',
        'button:has-text("Upload")',
        '[data-testid="upload-area"]',
        'label:has-text("Upload")',
        '[class*="upload"]',
        '[class*="dropzone"]',
    ],

    // Add button to add more NFT - more specific selectors
    ADD_NFT_BUTTON: [
        'button:has-text("+ Add")',
        'button:has-text("+Add")',
        'button:has-text("Add"):not(:has-text("Add Network"))',
        'button >> text=/\\+\\s*Add/i',
        '[data-testid="add-nft"]',
        'button[class*="add"]',
    ],

    // Mint button in mint UI
    MINT_BUTTON: [
        'button:has-text("Mint"):not(:has-text("Mint this"))',
        'button[type="submit"]:has-text("Mint")',
        '[data-testid="mint-submit"]',
    ],

    // Mint confirmation popup
    MINT_CONFIRM_POPUP: [
        'div[role="dialog"]:has-text("Mint")',
        '[data-state="open"]:has-text("Mint")',
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

    // Close popup button (x button)
    CLOSE_POPUP_BUTTON: [
        'div[data-state="open"] button:has(svg)',
        'button[aria-label="Close"]',
        'button[aria-label="close"]',
        '.dialog-close-button',
        '[data-radix-collection-item] button:has(svg)',
    ],

    // ============ FAIR LAUNCH / FIXED PRICE SELECTORS ============

    // Setting collection type dropdown/options
    COLLECTION_TYPE_DROPDOWN: [
        'button:has-text("Setting collection type")',
        '[role="combobox"]:has-text("Setting")',
        'button:has-text("Free Mint")',
        'div[class*="select"]:has-text("collection type")',
    ],

    // Fixed Price option in dropdown
    FIXED_PRICE_OPTION: [
        '[role="option"]:has-text("Fixed Price")',
        'li:has-text("Fixed Price")',
        'div[role="listbox"] >> text=Fixed Price',
        'text=Fixed Price',
    ],

    // Fair launch settings - Price input
    FAIR_LAUNCH_PRICE_INPUT: [
        'input[name="price"]',
        'input[placeholder*="price"]',
        'input[placeholder*="Price"]',
        'label:has-text("Price") + input',
        'label:has-text("Price") ~ input',
        'div:has-text("Fair launch") input[type="number"]',
        'input[type="number"]',
    ],

    // Fair launch settings - Unlimited checkbox
    UNLIMITED_CHECKBOX: [
        'input[type="checkbox"]:near(:text("Unlimited"))',
        'label:has-text("Unlimited") input[type="checkbox"]',
        'button[role="checkbox"]:near(:text("Unlimited"))',
        '[data-state]:near(:text("Unlimited"))',
        'input[name="unlimited"]',
    ],

    // Fair launch settings - Supply input (visible after unchecking Unlimited)
    SUPPLY_INPUT: [
        'input[name="supply"]',
        'input[placeholder*="supply"]',
        'input[placeholder*="Supply"]',
        'label:has-text("Supply") + input',
        'label:has-text("Supply") ~ input',
        'div:has-text("Supply") input[type="number"]',
    ],

};
