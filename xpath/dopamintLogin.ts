export const DOPAMINT_SELECTORS = {
    // Login Page
    LOGIN_BUTTON: 'button:has-text("Login")',
    EMAIL_INPUT: 'role=textbox[name="name@host.com"]',
    PASSWORD_INPUT: 'role=textbox[name="Password"]',
    SUBMIT_BUTTON: 'role=button[name="submit"]',
    
    // Connect Wallet
    SIGN_IN_WITH_WALLET: 'button:has-text("Sign in with wallet")',
    METAMASK_OPTION: 'button:has-text("MetaMask")',
    
    // Dashboard
    MARKETPLACE_TEXT: 'text=MARKETPLACE',
    
    // Popups
    TERMS_POPUP_BUTTON: 'button:has-text("I have read")',
    CLOSE_DIALOG_BUTTONS: [
        'div[data-state="open"] button:has(svg)',
        'button[aria-label="Close"]',
        '.dialog-close-button'
    ],
    
    // MetaMask Popup
    METAMASK_SIGN_BUTTONS: [
        'button[data-testid="page-container-footer-next"]',
        'button[data-testid="request-signature__sign"]',
        'button:has-text("Sign")', 
        'button:has-text("Confirm")', 
        'button:has-text("Ký")', 
        'button:has-text("Xác nhận")',
        '.btn-primary',
        'button.btn-primary'
    ],
    METAMASK_SCROLL_BUTTON: '.fa-arrow-down, [data-testid="signature-request-scroll-button"]'
};