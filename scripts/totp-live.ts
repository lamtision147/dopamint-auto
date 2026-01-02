import { authenticator } from 'otplib';

const GOOGLE_2FA_SECRET = '3OYILA3IIKTWBYS53AEI4DCFGMW3NAJK';

console.log('=== LIVE TOTP Code Comparison ===');
console.log(`Secret: ${GOOGLE_2FA_SECRET}`);
console.log('');
console.log('Compare these codes with your Google Authenticator app.');
console.log('Press Ctrl+C to stop.\n');

// Update every second for 60 seconds
let count = 0;
const interval = setInterval(() => {
    const code = authenticator.generate(GOOGLE_2FA_SECRET);
    const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
    const time = new Date().toLocaleTimeString();

    // Clear line and print
    process.stdout.write(`\r[${time}] Code: ${code}  (${timeRemaining}s remaining)  `);

    count++;
    if (count > 60) {
        clearInterval(interval);
        console.log('\n\nDone. If codes matched -> secret is correct. If not -> need new secret key.');
    }
}, 1000);
