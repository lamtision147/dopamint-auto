import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Gmail IMAP configuration
const IMAP_CONFIG = {
    imap: {
        user: process.env.GMAIL_EMAIL || '',
        password: process.env.GMAIL_APP_PASSWORD || '',
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
    }
};

/**
 * Wait for OTP email from Thirdweb and extract the 6-digit code
 * @param email - The email address that received the OTP
 * @param maxWaitMs - Maximum time to wait for OTP email (default: 60 seconds)
 * @param pollIntervalMs - Polling interval (default: 3 seconds)
 * @returns The 6-digit OTP code
 */
export async function getOtpFromGmail(
email: string, maxWaitMs: number = 60000, pollIntervalMs: number = 3000, p0: number): Promise<string> {
    console.log(`\n📧 [Gmail OTP] Waiting for OTP email sent to ${email}...`);

    const startTime = Date.now();
    const searchStartTime = new Date(startTime - 60000); // Look for emails from last 1 minute

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const connection = await imaps.connect(IMAP_CONFIG);
            await connection.openBox('INBOX');

            // Search for recent emails from Thirdweb
            const searchCriteria = [
                ['SINCE', searchStartTime],
                ['OR',
                    ['FROM', 'thirdweb'],
                    ['FROM', 'noreply']
                ]
            ];

            const fetchOptions = {
                bodies: ['HEADER', 'TEXT', ''],
                markSeen: false,
                struct: true
            };

            const messages = await connection.search(searchCriteria, fetchOptions);

            // Sort by date descending (newest first)
            messages.sort((a, b) => {
                const dateA = new Date(a.attributes.date).getTime();
                const dateB = new Date(b.attributes.date).getTime();
                return dateB - dateA;
            });

            for (const message of messages) {
                const allParts = message.parts.find((part: { which: string }) => part.which === '');
                if (!allParts) continue;

                const parsed: ParsedMail = await simpleParser(allParts.body);
                const subject = parsed.subject || '';
                const textBody = parsed.text || '';
                const htmlBody = parsed.html || '';

                // Check if this is a verification email
                if (subject.toLowerCase().includes('verification') ||
                    subject.toLowerCase().includes('code') ||
                    subject.toLowerCase().includes('otp') ||
                    textBody.toLowerCase().includes('verification code')) {

                    // Extract 6-digit OTP from email body
                    const otpMatch = textBody.match(/\b(\d{6})\b/) ||
                                    htmlBody.match(/\b(\d{6})\b/) ||
                                    subject.match(/\b(\d{6})\b/);

                    if (otpMatch) {
                        const otp = otpMatch[1];
                        console.log(`✅ [Gmail OTP] Found OTP: ${otp}`);
                        console.log(`   Subject: ${subject}`);
                        console.log(`   Received: ${parsed.date}`);

                        await connection.end();
                        return otp;
                    }
                }
            }

            await connection.end();

        } catch (error) {
            console.log(`⚠️ [Gmail OTP] Error checking email: ${error}`);
        }

        // Wait before next poll
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`⏳ [Gmail OTP] No OTP found yet... (${elapsed}s elapsed, max ${maxWaitMs / 1000}s)`);
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`[Gmail OTP] Timeout: No OTP email received within ${maxWaitMs / 1000} seconds`);
}

/**
 * Delete old verification emails to avoid confusion
 * @param email - The email address
 */
export async function clearOldOtpEmails(email: string): Promise<void> {
    try {
        console.log(`🗑️ [Gmail OTP] Clearing old verification emails...`);

        const connection = await imaps.connect(IMAP_CONFIG);
        await connection.openBox('INBOX');

        // Search for verification emails older than 5 minutes
        const searchCriteria = [
            ['OR',
                ['FROM', 'thirdweb'],
                ['FROM', 'noreply']
            ],
            ['OR',
                ['SUBJECT', 'verification'],
                ['SUBJECT', 'code']
            ]
        ];

        const fetchOptions = {
            bodies: ['HEADER'],
            markSeen: false
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length > 0) {
            const uids = messages.map((msg: { attributes: { uid: number } }) => msg.attributes.uid);
            await connection.deleteMessage(uids);
            console.log(`✅ [Gmail OTP] Deleted ${messages.length} old verification emails`);
        } else {
            console.log(`✅ [Gmail OTP] No old verification emails to delete`);
        }

        await connection.end();

    } catch (error) {
        console.log(`⚠️ [Gmail OTP] Error clearing old emails: ${error}`);
    }
}

/**
 * Test Gmail connection
 */
export async function testGmailConnection(): Promise<boolean> {
    try {
        console.log(`🔌 [Gmail OTP] Testing connection to ${IMAP_CONFIG.imap.user}...`);

        const connection = await imaps.connect(IMAP_CONFIG);
        await connection.openBox('INBOX');

        console.log(`✅ [Gmail OTP] Connection successful!`);

        await connection.end();
        return true;

    } catch (error) {
        console.error(`❌ [Gmail OTP] Connection failed: ${error}`);
        return false;
    }
}
