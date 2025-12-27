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
const THREAD_ID = process.env.TELEGRAM_THREAD_ID; // Optional: for supergroup topics

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('Error: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    console.error('Please create .env.telegram file with your credentials');
    process.exit(1);
}

function sendTelegramMessage(message) {
    return new Promise((resolve, reject) => {
        const payload = {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        };
        // Add message_thread_id for supergroup topics
        if (THREAD_ID) {
            payload.message_thread_id = parseInt(THREAD_ID, 10);
        }
        const data = JSON.stringify(payload);

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
        // Add message_thread_id for supergroup topics
        if (THREAD_ID) {
            body += `--${boundary}\r\n`;
            body += `Content-Disposition: form-data; name="message_thread_id"\r\n\r\n${THREAD_ID}\r\n`;
        }
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

// Get screenshots based on test status and test file
function getScreenshots(status, testFile = '', outputDir = '') {
    // Use spec-specific output directory if provided, otherwise use default
    let testResultsDir;
    if (outputDir && fs.existsSync(outputDir)) {
        testResultsDir = outputDir;
        console.log(`Using spec-specific output dir: ${outputDir}`);
    } else {
        testResultsDir = path.join(__dirname, '..', 'test-results');
        console.log(`Using default test-results dir: ${testResultsDir}`);
    }

    if (!fs.existsSync(testResultsDir)) {
        console.log('No test-results directory found');
        return [];
    }

    const screenshots = [];

    // Recursive function to find all PNG files
    function findPngFiles(dir) {
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        findPngFiles(fullPath);
                    } else if (item.endsWith('.png')) {
                        screenshots.push(fullPath);
                    }
                } catch (err) {
                    // Skip files we can't access
                }
            }
        } catch (err) {
            console.error('Error reading directory:', dir, err.message);
        }
    }

    findPngFiles(testResultsDir);
    console.log(`Found ${screenshots.length} total screenshots in test-results`);

    // Sort by modification time (oldest first - chronological order)
    const sorted = screenshots.sort((a, b) => {
        try {
            return fs.statSync(a).mtime - fs.statSync(b).mtime;
        } catch {
            return 0;
        }
    });

    if (status === 'PASSED') {
        // Only send success/verification screenshots (max 3)
        const successScreenshots = sorted.filter(f => {
            const name = path.basename(f).toLowerCase();
            return name.includes('success') ||
                   name.includes('connected') ||
                   name.includes('passed') ||
                   name.includes('verify') ||
                   name.includes('mint-success') ||
                   name.includes('publish-success') ||
                   name.includes('sell-success') ||
                   name.includes('search-result');
        });
        console.log(`Found ${successScreenshots.length} success screenshots`);
        return successScreenshots.slice(0, 3);
    } else {
        // Send debug/failure screenshots (max 5 for failed tests)
        const failScreenshots = sorted.filter(f => {
            const name = path.basename(f).toLowerCase();
            // Match FAILED-ModelName-page-X.png and other failure patterns
            return name.startsWith('failed') ||
                   name.includes('fail') ||
                   name.includes('error') ||
                   name.includes('debug');
        });

        console.log(`Found ${failScreenshots.length} failure screenshots:`);
        failScreenshots.forEach(f => console.log(`  - ${path.basename(f)}`));

        // If no specific fail screenshots, return the most recent ones
        const result = (failScreenshots.length > 0 ? failScreenshots : sorted).slice(0, 5);
        console.log(`Returning ${result.length} screenshots for FAILED status`);
        return result;
    }
}

// Read collection URL from file (saved by test)
function getCollectionUrl(outputDir = '') {
    // Try spec-specific directory first, then default
    const dirs = outputDir ? [outputDir, path.join(__dirname, '..', 'test-results')] : [path.join(__dirname, '..', 'test-results')];
    for (const dir of dirs) {
        const urlFile = path.join(dir, 'collection-url.txt');
        if (fs.existsSync(urlFile)) {
            return fs.readFileSync(urlFile, 'utf8').trim();
        }
    }
    return null;
}

// Read token URLs from file (saved by searchMintSell test)
function getTokenUrls(outputDir = '') {
    // Try spec-specific directory first, then default
    const dirs = outputDir ? [outputDir, path.join(__dirname, '..', 'test-results')] : [path.join(__dirname, '..', 'test-results')];
    for (const dir of dirs) {
        const tokenFile = path.join(dir, 'token-urls.json');
        if (fs.existsSync(tokenFile)) {
            try {
                const content = fs.readFileSync(tokenFile, 'utf8');
                return JSON.parse(content);
            } catch (e) {
                console.error('Error reading token-urls.json:', e.message);
            }
        }
    }
    return null;
}

// Read create info from file (saved by create test) - returns array of all model results
function getCreateInfo(outputDir = '') {
    // Try spec-specific directory first, then default
    const dirs = outputDir ? [outputDir, path.join(__dirname, '..', 'test-results')] : [path.join(__dirname, '..', 'test-results')];
    for (const dir of dirs) {
        const createFile = path.join(dir, 'create-info.json');
        if (fs.existsSync(createFile)) {
            try {
                const content = fs.readFileSync(createFile, 'utf8');
                const parsed = JSON.parse(content);
                // Ensure it's always an array
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                console.error('Error reading create-info.json:', e.message);
            }
        }
    }
    return null;
}

// Collection to Model mapping for display
const COLLECTION_TO_MODEL = {
    'Auto Banana - OLD': 'Nano Banana',
    'Auto ChatGPT - OLD': 'ChatGPT',
    'Auto Banana Pro - OLD': 'Nano Banana Pro',
    'Vu testChatGPT': 'ChatGPT image 1.5'
};

// Get model name from collection name
function getModelName(collectionName) {
    return COLLECTION_TO_MODEL[collectionName] || collectionName;
}

// Escape HTML special characters
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Create hyperlink (shorter text for table cells)
function createLink(text, url) {
    if (!url) return text;
    return `<a href="${url}">${escapeHtml(text)}</a>`;
}

// Create hyperlink with link icon
function createLinkWithIcon(text, url) {
    if (!url) return text;
    return `🔗 <a href="${url}">${escapeHtml(text)}</a>`;
}

// Extract ID from URL (last part of path)
function extractIdFromUrl(url) {
    if (!url) return null;
    try {
        const parts = url.split('/').filter(p => p);
        return parts[parts.length - 1];
    } catch (e) {
        return null;
    }
}

// Pad string to fixed width (for monospace alignment)
function padRight(str, width) {
    const text = str || '';
    // Count actual display length (excluding HTML tags)
    const displayLen = text.replace(/<[^>]*>/g, '').length;
    if (displayLen >= width) return text;
    return text + ' '.repeat(width - displayLen);
}

// Pad string to center (for headers)
function padCenter(str, width) {
    const text = str || '';
    const displayLen = text.replace(/<[^>]*>/g, '').length;
    if (displayLen >= width) return text;
    const leftPad = Math.floor((width - displayLen) / 2);
    const rightPad = width - displayLen - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

// Format table row with fixed column widths
function formatTableRow(columns, widths) {
    return columns.map((col, i) => padRight(col, widths[i])).join('│');
}

// Format table header row with fixed column widths
function formatTableHeaderRow(columns, widths) {
    const paddedCols = columns.map((col, i) => padCenter(col, widths[i]));
    return `<b>${paddedCols.join('│')}</b>`;
}

// Format table separator line with fixed widths
function formatTableSeparator(widths) {
    return widths.map(w => '─'.repeat(w)).join('┼');
}

// Format table top border
function formatTableTopBorder(widths) {
    return widths.map(w => '─'.repeat(w)).join('┬');
}

// Format table bottom border
function formatTableBottomBorder(widths) {
    return widths.map(w => '─'.repeat(w)).join('┴');
}

// Check if any result has failed status
function hasAnyFailed(results) {
    if (!results || !Array.isArray(results)) return false;
    return results.some(r => r.status === 'FAILED');
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
    const outputDir = args[5] || '';  // Spec-specific output directory

    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dateStr = now.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const emoji = status === 'PASSED' ? '✅' : '❌';
    const statusText = status === 'PASSED' ? 'PASSED' : 'FAILED';
    const formattedDuration = formatDuration(parseFloat(duration));

    // Get collection URL if exists (check spec-specific dir first)
    const collectionUrl = getCollectionUrl(outputDir);

    // Get token URLs if exists (for searchMintSell test)
    const tokenUrls = getTokenUrls(outputDir);

    // Get create info if exists (for create test)
    const createInfo = getCreateInfo(outputDir);

    // Calculate summary for header (will be filled later based on test type)
    let passedCount = 0;
    let failedCount = 0;
    let totalCount = 0;

    // Pre-calculate counts for summary in header
    if (createInfo && Array.isArray(createInfo)) {
        passedCount = createInfo.filter(r => r.status === 'PASSED').length;
        failedCount = createInfo.filter(r => r.status === 'FAILED').length;
        totalCount = createInfo.length;
    } else if (tokenUrls) {
        const resultsArray = Array.isArray(tokenUrls) ? tokenUrls : [tokenUrls];
        passedCount = resultsArray.filter(r => r.status === 'PASSED').length;
        failedCount = resultsArray.filter(r => r.status === 'FAILED').length;
        totalCount = resultsArray.length;
    }

    let message = `${emoji} <b>DAILY AUTOMATION TEST</b>
────────────────────────
📋 Test     : ${testName}
📁 File     : <code>${testFile}</code>
📅 Time     : ${timeStr} ${dateStr}
📊 Status   : ${emoji} <b>${statusText}</b>
⏱️ Duration : ${formattedDuration}`;

    // Add summary in header if we have test results
    if (totalCount > 0) {
        message += `\n📈 Summary  : ✅ Passed : ${passedCount} | ❌ Failed : ${failedCount}`;
    }

    message += `\n────────────────────────`;

    // Format based on test type
    if (testFile.includes('login')) {
        // LOGIN TEST FORMAT - Column widths: Method(10), Status(8), Note(15)
        const loginWidths = [10, 8, 15];
        message += `\n<pre>`;
        message += `\n${formatTableTopBorder(loginWidths)}`;
        message += `\n${formatTableHeaderRow(['Method', 'Status', 'NOTE'], loginWidths)}`;
        message += `\n${formatTableSeparator(loginWidths)}`;

        const note = status === 'FAILED' ? 'See error' : '-';
        message += `\n${formatTableRow(['MetaMask', statusText, note], loginWidths)}`;
        message += `\n${formatTableBottomBorder(loginWidths)}`;
        message += `</pre>`;

        // Add error details if test failed
        if (status === 'FAILED' && logFile) {
            const errorDetails = getErrorDetails(logFile);
            if (errorDetails) {
                const shortError = errorDetails.split('\n')[0].substring(0, 100);
                message += `\n\n💬 <b>Error:</b>\n<code>${shortError}</code>`;
            }
        }
    } else if (createInfo && testFile.includes('create') && Array.isArray(createInfo)) {
        // CREATE TEST FORMAT - Card style for each model
        message += `\n`;

        createInfo.forEach((result, index) => {
            const statusIcon = result.status === 'PASSED' ? '🟢' : '🔴';
            const statusTxt = result.status === 'PASSED' ? 'Passed' : 'Failed';
            const modelName = result.model || 'Unknown';

            // Collection with hyperlink - extract ID from URL
            let collectionLink = '-';
            if (result.collectionUrl) {
                const collectionId = extractIdFromUrl(result.collectionUrl) || 'LINK';
                collectionLink = createLinkWithIcon(collectionId, result.collectionUrl);
            }

            // Minted count (no individual URLs for create test)
            const mintedText = result.status === 'PASSED' ? `${result.mintedCount || 0} NFT` : '-';

            message += `\n<b>${statusIcon} ${index + 1}. 🧠${modelName}</b>`;
            message += `\n   ├ 📦 Collection: ${collectionLink}`;
            message += `\n   ├ 🎨 Minted: ${mintedText}`;
            message += `\n   └ 📌 Status: ${statusIcon} ${statusTxt}`;

            // Note - only show error for failed tests
            if (result.status === 'FAILED' && result.error) {
                const errorText = result.error.substring(0, 50).replace(/\n/g, ' ');
                message += `\n   💬 <code>${escapeHtml(errorText)}</code>`;
            }

            // Add separator between models (except last one)
            if (index < createInfo.length - 1) {
                message += `\n────────────────────────`;
            }
        });
    } else if (tokenUrls && testFile.includes('searchMintSell')) {
        // SEARCH MINT SELL TEST FORMAT - Card style for each model
        message += `\n`;

        const resultsArray = Array.isArray(tokenUrls) ? tokenUrls : [tokenUrls];

        resultsArray.forEach((result, index) => {
            const statusIcon = result.status === 'PASSED' ? '✅' : '❌';
            const statusTxt = result.status === 'PASSED' ? 'Passed' : 'Failed';
            // Use model mapping for display name
            const modelName = getModelName(result.collectionName) || result.collectionName || 'Unknown';

            // Collection link - extract ID from URL
            let collectionLink = '-';
            if (result.collectionUrl) {
                const collectionId = extractIdFromUrl(result.collectionUrl) || 'LINK';
                collectionLink = createLinkWithIcon(collectionId, result.collectionUrl);
            }

            // Minted URLs with hyperlinks (LINK#1 LINK#2)
            let mintedLinks = '-';
            if (result.status === 'PASSED' && result.mintedUrls && result.mintedUrls.length > 0) {
                mintedLinks = result.mintedUrls
                    .map((url, i) => createLinkWithIcon(`LINK#${i + 1}`, url))
                    .join(' ');
            }

            // Sold URL with hyperlink
            let soldLink = '-';
            if (result.status === 'PASSED' && result.soldUrl) {
                soldLink = createLinkWithIcon('LINK', result.soldUrl);
            }

            message += `\n<b>${statusIcon} ${index + 1}. 🧠${modelName}</b>`;
            message += `\n   ├ 📦 Collection: ${collectionLink}`;
            message += `\n   ├ 🎨 Minted: ${mintedLinks}`;
            message += `\n   ├ 💰 Sold: ${soldLink}`;
            message += `\n   └ 📌 Status: ${statusIcon} ${statusTxt}`;

            // Note - only show error for failed tests
            if (result.status === 'FAILED' && result.error) {
                const errorText = result.error.substring(0, 50).replace(/\n/g, ' ');
                message += `\n   💬 <code>${escapeHtml(errorText)}</code>`;
            }

            // Add separator between models (except last one)
            if (index < resultsArray.length - 1) {
                message += `\n────────────────────────`;
            }
        });
    } else {
        // DEFAULT FORMAT (for other tests)
        message += `\n\n📊 Status: <b>${statusText}</b>`;

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
    }

    message += `\n\n🤖 <i>Automated by <a href="https://t.me/VuTran1902">Vu Tran</a></i>`;

    try {
        await sendTelegramMessage(message);
        console.log('✅ Telegram message sent!');

        // Send relevant screenshots based on status (use spec-specific output dir)
        const screenshots = getScreenshots(status, testFile, outputDir);
        console.log(`Will send ${screenshots.length} screenshots (status: ${status})`);

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
