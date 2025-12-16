const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.telegram');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('Error: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    console.error('Please create .env.telegram file with your credentials');
    process.exit(1);
}

function sendTelegramMessage(message) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${BOT_TOKEN}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const response = JSON.parse(body);
                if (response.ok) {
                    resolve(response);
                } else {
                    reject(new Error(response.description));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function sendTelegramPhoto(photoPath, caption) {
    return new Promise((resolve, reject) => {
        const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
        const photoData = fs.readFileSync(photoPath);
        const filename = path.basename(photoPath);

        let body = '';
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${CHAT_ID}\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="photo"; filename="${filename}"\r\n`;
        body += `Content-Type: image/png\r\n\r\n`;

        const bodyBuffer = Buffer.concat([
            Buffer.from(body),
            photoData,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${BOT_TOKEN}/sendPhoto`,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': bodyBuffer.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                const response = JSON.parse(responseBody);
                if (response.ok) {
                    resolve(response);
                } else {
                    reject(new Error(response.description));
                }
            });
        });

        req.on('error', reject);
        req.write(bodyBuffer);
        req.end();
    });
}

// Get screenshots based on test status
function getScreenshots(status) {
    const testResultsDir = path.join(__dirname, '..', 'test-results');
    if (!fs.existsSync(testResultsDir)) return [];

    const screenshots = [];

    // Recursive function to find all PNG files
    function findPngFiles(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                findPngFiles(fullPath);
            } else if (item.endsWith('.png')) {
                screenshots.push(fullPath);
            }
        }
    }

    findPngFiles(testResultsDir);

    // Sort by modification time (newest first)
    const sorted = screenshots.sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime);

    if (status === 'PASSED') {
        // Only send success/verification screenshots (max 2)
        const successScreenshots = sorted.filter(f => {
            const name = path.basename(f).toLowerCase();
            return name.includes('success') ||
                   name.includes('connected') ||
                   name.includes('passed') ||
                   name.includes('verify') ||
                   name.includes('mint-success') ||
                   name.includes('publish-success');
        });
        return successScreenshots.slice(0, 2);
    } else {
        // Send debug/failure screenshots (max 3)
        const failScreenshots = sorted.filter(f => {
            const name = path.basename(f).toLowerCase();
            return name.includes('fail') ||
                   name.includes('error') ||
                   name.includes('debug') ||
                   name.includes('step');
        });
        // If no specific fail screenshots, return the most recent ones
        return (failScreenshots.length > 0 ? failScreenshots : sorted).slice(0, 3);
    }
}

// Read collection URL from file (saved by test)
function getCollectionUrl() {
    const urlFile = path.join(__dirname, '..', 'test-results', 'collection-url.txt');
    if (fs.existsSync(urlFile)) {
        return fs.readFileSync(urlFile, 'utf8').trim();
    }
    return null;
}

// Extract error details from log file
function getErrorDetails(logFilePath) {
    if (!logFilePath || !fs.existsSync(logFilePath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(logFilePath, 'utf8');
        const lines = content.split('\n');

        // Look for error patterns in the log
        const errorPatterns = [
            /Error:(.+)/i,
            /TimeoutError:(.+)/i,
            /expect\((.+)\)\.(.+)/i,
            /Locator:(.+)/i,
            /waiting for(.+)/i,
            /failed(.+)/i
        ];

        const errorLines = [];
        let capturing = false;

        for (const line of lines) {
            // Start capturing when we see error indicators
            if (line.includes('Error:') || line.includes('TimeoutError') ||
                line.includes('expect(') || line.includes('Locator:') ||
                line.includes('Call log:') || line.includes('waiting for')) {
                capturing = true;
            }

            if (capturing) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('at ') && !trimmed.startsWith('========')) {
                    errorLines.push(trimmed);
                }
                // Stop after capturing enough context
                if (errorLines.length >= 10) break;
            }
        }

        if (errorLines.length > 0) {
            return errorLines.join('\n').substring(0, 500); // Limit to 500 chars
        }

        return null;
    } catch (err) {
        console.error('Error reading log file:', err.message);
        return null;
    }
}

// Format duration from seconds to human readable
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
        return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    const status = args[0] || 'UNKNOWN';
    const duration = args[1] || '0';
    const testName = args[2] || 'Dopamint Test';
    const testFile = args[3] || '';
    const logFile = args[4] || '';

    const timestamp = new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const emoji = status === 'PASSED' ? '✅' : '❌';
    const statusText = status === 'PASSED' ? 'PASSED' : 'FAILED';
    const formattedDuration = formatDuration(parseFloat(duration));

    // Get collection URL if exists
    const collectionUrl = getCollectionUrl();

    let message = `
${emoji} <b>DOPAMINT AUTO TEST</b>

📋 Test: ${testName}
📁 File: <code>${testFile}</code>
📅 Time: ${timestamp}
📊 Status: <b>${statusText}</b>
⏱ Duration: ${formattedDuration}
`.trim();

    // Add error details if test failed
    if (status === 'FAILED' && logFile) {
        const errorDetails = getErrorDetails(logFile);
        if (errorDetails) {
            message += `\n\n⚠️ <b>Error Details:</b>\n<pre>${errorDetails}</pre>`;
        }
    }

    // Add URL if exists
    if (collectionUrl) {
        message += `\n\n🔗 Collection: ${collectionUrl}`;
    }

    message += `\n\n🤖 Automated by Playwright`;

    try {
        await sendTelegramMessage(message);
        console.log('✅ Telegram message sent!');

        // Send relevant screenshots based on status
        const screenshots = getScreenshots(status);
        console.log(`Found ${screenshots.length} screenshots to send (status: ${status})`);

        for (let i = 0; i < screenshots.length; i++) {
            const screenshot = screenshots[i];
            const filename = path.basename(screenshot, '.png');
            try {
                await sendTelegramPhoto(screenshot, `📸 ${i + 1}/${screenshots.length}: ${filename}`);
                console.log(`✅ Sent: ${filename}`);
                // Small delay between photos to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                console.error(`❌ Failed to send ${filename}:`, err.message);
            }
        }

        console.log('✅ All done!');
    } catch (error) {
        console.error('❌ Failed to send Telegram:', error.message);
        process.exit(1);
    }
}

main();
