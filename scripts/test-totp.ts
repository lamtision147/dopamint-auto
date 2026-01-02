import { authenticator } from 'otplib';

// The secret from .env.test
const GOOGLE_2FA_SECRET = '3OYILA3IIKTWBYS53AEI4DCFGMW3NAJK';

// Check current system time
console.log('=== TOTP Verification Test ===');
console.log(`System time: ${new Date().toISOString()}`);
console.log(`Unix timestamp: ${Math.floor(Date.now() / 1000)}`);
console.log('');

// Base32 valid characters: A-Z and 2-7 ONLY (no 0, 1, 3, 8, 9)
const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
console.log('=== Secret Key Validation ===');
console.log(`Original secret: ${GOOGLE_2FA_SECRET}`);

const invalidChars: string[] = [];
for (const char of GOOGLE_2FA_SECRET.toUpperCase()) {
    if (!base32Chars.includes(char)) {
        invalidChars.push(char);
    }
}

if (invalidChars.length > 0) {
    console.log(`⚠️ INVALID Base32 characters found: ${[...new Set(invalidChars)].join(', ')}`);
    console.log('   Base32 only uses: A-Z and 2-7 (no 0, 1, 3, 8, 9)');
} else {
    console.log('✅ All characters are valid Base32');
}
console.log('');

// Try variations - replace invalid '3' with likely characters
console.log('=== Trying variations (3 might be E or B) ===');

const variations = [
    { name: 'Original (invalid)', secret: GOOGLE_2FA_SECRET },
    { name: '3 -> E', secret: GOOGLE_2FA_SECRET.replace(/3/g, 'E') },
    { name: '3 -> B', secret: GOOGLE_2FA_SECRET.replace(/3/g, 'B') },
    { name: 'First 3 -> E only', secret: GOOGLE_2FA_SECRET.replace('3', 'E') },
];

for (const { name, secret } of variations) {
    try {
        const code = authenticator.generate(secret);
        console.log(`${name}: ${code}  (secret: ${secret})`);
    } catch (e: any) {
        console.log(`${name}: ERROR - ${e.message}`);
    }
}

console.log('');
console.log('=== INSTRUCTIONS ===');
console.log('1. Open Google Authenticator app on your phone');
console.log('2. Find the code for your Google account (vutesttran99@gmail.com)');
console.log('3. Compare with the codes above');
console.log('4. If one matches, that\'s the correct secret key format!');
console.log('');
console.log('The time remaining until next code:');
const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
console.log(`${timeRemaining} seconds`);
