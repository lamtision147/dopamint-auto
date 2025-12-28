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
            parse_mode: 'HTML',
            disable_web_page_preview: true
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

// Check if screenshot is blank/empty (very small file size indicates blank image)
function isBlankScreenshot(filePath) {
    try {
        const stats = fs.statSync(filePath);
        // Blank screenshots are usually under 10KB
        // Real screenshots with content are typically 50KB+
        if (stats.size < 10000) {
            console.log(`  Skipping blank screenshot (${(stats.size/1024).toFixed(1)}KB): ${path.basename(filePath)}`);
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
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
        // Filter out blank screenshots
        const successScreenshots = sorted.filter(f => {
            if (isBlankScreenshot(f)) return false;
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
        console.log(`Found ${successScreenshots.length} success screenshots (after blank filter)`);
        return successScreenshots.slice(0, 3);
    } else {
        // Send ONLY failure screenshots for failed tests
        // Filter out blank screenshots
        const failScreenshots = sorted.filter(f => {
            if (isBlankScreenshot(f)) return false;
            const name = path.basename(f).toLowerCase();
            // Only match explicit FAILED screenshots
            return name.startsWith('failed') ||
                   name.includes('fail') ||
                   name.includes('error') ||
                   name.includes('debug') ||
                   name.includes('timeout');
        });

        console.log(`Found ${failScreenshots.length} failure screenshots (after blank filter):`);
        failScreenshots.forEach(f => console.log(`  - ${path.basename(f)} (${(fs.statSync(f).size/1024).toFixed(1)}KB)`));

        if (failScreenshots.length > 0) {
            // Return only FAILED screenshots (max 3)
            return failScreenshots.slice(0, 3);
        } else {
            // No explicit fail screenshots - return only the LAST screenshot (likely shows failure state)
            // Filter out success/blank screenshots
            const lastScreenshots = sorted.filter(f => {
                if (isBlankScreenshot(f)) return false;
                const name = path.basename(f).toLowerCase();
                // Exclude success/verification screenshots
                return !name.includes('success') &&
                       !name.includes('passed') &&
                       !name.includes('connected') &&
                       !name.includes('verify');
            });

            if (lastScreenshots.length > 0) {
                // Return only the last 1-2 screenshots
                console.log(`No FAILED screenshots, returning last ${Math.min(2, lastScreenshots.length)} screenshot(s)`);
                return lastScreenshots.slice(-2);
            }

            console.log('No suitable failure screenshots found');
            return [];
        }
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

// Helper: strip ANSI escape codes from text
function stripAnsi(text) {
    if (!text) return '';
    // Remove ANSI escape codes like [31m, [39m, [0m, etc.
    return text.toString()
        .replace(/\x1b\[[0-9;]*m/g, '')
        .replace(/\[[\d;]*m/g, '')
        .trim();
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

    // Debug logging
    console.log('=== Telegram Script Args ===');
    console.log(`status: ${status}`);
    console.log(`testName: ${testName}`);
    console.log(`testFile: ${testFile}`);
    console.log(`outputDir: ${outputDir}`);
    console.log('============================');

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
===================
📋 Test     : ${testName}
📁 File     : <code>${testFile}</code>
📅 Time     : ${timeStr} ${dateStr}
📊 Status   : ${emoji} <b>${statusText}</b>
⏱️ Duration : ${formattedDuration}`;

    // Add summary in header if we have test results
    if (totalCount > 0) {
        message += `\n📈 Summary  : ✅ Passed : ${passedCount} | ❌ Failed : ${failedCount}`;
    }

    message += `\n===================`;

    // Format based on test type
    if (testFile.toLowerCase().includes('login')) {
        // LOGIN TEST FORMAT - Plain text table (copyable)
        // Build table manually without HTML tags inside <pre>
        const w1 = 10, w2 = 8, w3 = 15;

        const topLine    = '─'.repeat(w1) + '┬' + '─'.repeat(w2) + '┬' + '─'.repeat(w3);
        const midLine    = '─'.repeat(w1) + '┼' + '─'.repeat(w2) + '┼' + '─'.repeat(w3);
        const bottomLine = '─'.repeat(w1) + '┴' + '─'.repeat(w2) + '┴' + '─'.repeat(w3);

        const header = padCenter('Method', w1) + '│' + padCenter('Status', w2) + '│' + padCenter('NOTE', w3);

        const note = status === 'FAILED' ? 'See error' : '-';
        const dataRow = padRight('MetaMask', w1) + '│' + padRight(statusText, w2) + '│' + padRight(note, w3);

        message += `\n<pre>`;
        message += `${topLine}\n`;
        message += `${header}\n`;
        message += `${midLine}\n`;
        message += `${dataRow}\n`;
        message += `${bottomLine}`;
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
        // CREATE TEST FORMAT - Table format with full content

        // Separate results by collection type
        const bondingResults = createInfo.filter(r => r.collectionType !== 'fairlaunch');
        const fairLaunchResults = createInfo.filter(r => r.collectionType === 'fairlaunch');

        // Column widths for CREATE table (increased for full content)
        const cw = { model: 20, collection: 26, minted: 8, status: 8 };

        // Helper function to build table for a collection type
        function buildCreateTable(results, title, statusIcon) {
            const passedCount = results.filter(r => r.status === 'PASSED').length;
            const failedCount = results.filter(r => r.status === 'FAILED').length;

            let table = `\n\n<b>${title}</b> ${statusIcon} (✅${passedCount} ❌${failedCount})`;
            table += `\n<pre>`;

            // Top line
            table += '─'.repeat(cw.model) + '┬' + '─'.repeat(cw.collection) + '┬' + '─'.repeat(cw.minted) + '┬' + '─'.repeat(cw.status) + '\n';

            // Header
            table += padCenter('Model AI', cw.model) + '│' + padCenter('Collection', cw.collection) + '│' + padCenter('Minted', cw.minted) + '│' + padCenter('Status', cw.status) + '\n';

            // Mid line
            table += '─'.repeat(cw.model) + '┼' + '─'.repeat(cw.collection) + '┼' + '─'.repeat(cw.minted) + '┼' + '─'.repeat(cw.status) + '\n';

            // Data rows
            const errors = [];
            results.forEach((result, idx) => {
                const model = padRight(result.model || 'Unknown', cw.model);
                const collection = padRight(result.collectionName || '-', cw.collection);
                const minted = padCenter(result.status === 'PASSED' ? `${result.mintedCount || 0} NFT` : '-', cw.minted);
                const statusTxt = padCenter(result.status === 'PASSED' ? '✅Pass' : '❌Fail', cw.status);

                table += model + '│' + collection + '│' + minted + '│' + statusTxt + '\n';

                // Collect errors for display below table
                if (result.status === 'FAILED' && result.error) {
                    errors.push({ model: result.model || 'Unknown', error: stripAnsi(result.error).replace(/\n/g, ' ') });
                }
            });

            // Bottom line
            table += '─'.repeat(cw.model) + '┴' + '─'.repeat(cw.collection) + '┴' + '─'.repeat(cw.minted) + '┴' + '─'.repeat(cw.status);
            table += '</pre>';

            // Add errors section if any
            if (errors.length > 0) {
                table += '\n\n💬 <b>Errors:</b>';
                errors.forEach(e => {
                    table += `\n• <b>${escapeHtml(e.model)}</b>: <code>${escapeHtml(e.error)}</code>`;
                });
            }

            return table;
        }

        // Show Bonding Curve table if has results
        if (bondingResults.length > 0) {
            const bondingStatus = bondingResults.some(r => r.status === 'FAILED') ? '🔴' : '🟢';
            message += buildCreateTable(bondingResults, '📦 Bonding Curve', bondingStatus);
        }

        // Show Fair Launch table if has results
        if (fairLaunchResults.length > 0) {
            const fairLaunchStatus = fairLaunchResults.some(r => r.status === 'FAILED') ? '🔴' : '🟢';
            message += buildCreateTable(fairLaunchResults, '💰 Fixed Price (Fair Launch)', fairLaunchStatus);
        }
    } else if (tokenUrls && testFile.toLowerCase().includes('searchmintsell')) {
        // SEARCH MINT SELL TEST FORMAT - Table format with full content

        const resultsArray = Array.isArray(tokenUrls) ? tokenUrls : [tokenUrls];

        // Separate results by collection type
        const bondingResults = resultsArray.filter(r => r.collectionType !== 'fairlaunch');
        const fairLaunchResults = resultsArray.filter(r => r.collectionType === 'fairlaunch');

        // Helper to extract nft_id from URL
        function extractNftId(url) {
            if (!url) return '';
            const match = url.match(/nft_id=(\d+)/);
            return match ? match[1] : '';
        }

        // Column widths for Bonding Curve table (with Sold column)
        const bw = { model: 20, collection: 20, minted: 14, sold: 10, status: 8 };
        // Column widths for Fair Launch table (no Sold column, wider collection)
        const fw = { model: 20, collection: 32, minted: 14, status: 8 };

        // Helper function to build Bonding Curve table (with Sold column)
        function buildBondingTable(results, title, statusIcon) {
            const passedCount = results.filter(r => r.status === 'PASSED').length;
            const failedCount = results.filter(r => r.status === 'FAILED').length;

            let table = `\n\n<b>${title}</b> ${statusIcon} (✅${passedCount} ❌${failedCount})`;
            table += `\n<pre>`;

            // Top line
            table += '─'.repeat(bw.model) + '┬' + '─'.repeat(bw.collection) + '┬' + '─'.repeat(bw.minted) + '┬' + '─'.repeat(bw.sold) + '┬' + '─'.repeat(bw.status) + '\n';

            // Header
            table += padCenter('Model AI', bw.model) + '│' + padCenter('Collection', bw.collection) + '│' + padCenter('Minted', bw.minted) + '│' + padCenter('Sold', bw.sold) + '│' + padCenter('Status', bw.status) + '\n';

            // Mid line
            table += '─'.repeat(bw.model) + '┼' + '─'.repeat(bw.collection) + '┼' + '─'.repeat(bw.minted) + '┼' + '─'.repeat(bw.sold) + '┼' + '─'.repeat(bw.status) + '\n';

            // Data rows
            const errors = [];
            results.forEach((result) => {
                const modelName = result.model || getModelName(result.collectionName) || result.collectionName || 'Unknown';
                const collectionNameDisplay = result.actualCollectionName || result.collectionName || '-';

                const model = padRight(modelName, bw.model);
                const collection = padRight(collectionNameDisplay, bw.collection);

                // Minted: extract nft_ids from URLs
                let minted = '-';
                if (result.status === 'PASSED' && result.mintedUrls && result.mintedUrls.length > 0) {
                    const nftIds = result.mintedUrls.map(url => extractNftId(url)).filter(id => id);
                    minted = nftIds.length > 0 ? nftIds.map(id => `id=${id}`).join(',') : `${result.mintedUrls.length} NFT`;
                }

                // Sold: extract nft_id from URL
                let sold = '-';
                if (result.status === 'PASSED' && result.soldUrl) {
                    const soldId = extractNftId(result.soldUrl);
                    sold = soldId ? `id=${soldId}` : 'Sold';
                }

                const statusTxt = padCenter(result.status === 'PASSED' ? '✅Pass' : '❌Fail', bw.status);

                table += model + '│' + collection + '│' + padCenter(minted, bw.minted) + '│' + padCenter(sold, bw.sold) + '│' + statusTxt + '\n';

                if (result.status === 'FAILED' && result.error) {
                    errors.push({ model: modelName, error: stripAnsi(result.error).replace(/\n/g, ' ') });
                }
            });

            // Bottom line
            table += '─'.repeat(bw.model) + '┴' + '─'.repeat(bw.collection) + '┴' + '─'.repeat(bw.minted) + '┴' + '─'.repeat(bw.sold) + '┴' + '─'.repeat(bw.status);
            table += '</pre>';

            if (errors.length > 0) {
                table += '\n\n💬 <b>Errors:</b>';
                errors.forEach(e => {
                    table += `\n• <b>${escapeHtml(e.model)}</b>: <code>${escapeHtml(e.error)}</code>`;
                });
            }

            return table;
        }

        // Helper function to build Fair Launch table (NO Sold column)
        function buildFairLaunchTable(results, title, statusIcon) {
            const passedCount = results.filter(r => r.status === 'PASSED').length;
            const failedCount = results.filter(r => r.status === 'FAILED').length;

            let table = `\n\n<b>${title}</b> ${statusIcon} (✅${passedCount} ❌${failedCount})`;
            table += `\n<pre>`;

            // Top line (no Sold column)
            table += '─'.repeat(fw.model) + '┬' + '─'.repeat(fw.collection) + '┬' + '─'.repeat(fw.minted) + '┬' + '─'.repeat(fw.status) + '\n';

            // Header (no Sold column)
            table += padCenter('Model AI', fw.model) + '│' + padCenter('Collection', fw.collection) + '│' + padCenter('Minted', fw.minted) + '│' + padCenter('Status', fw.status) + '\n';

            // Mid line (no Sold column)
            table += '─'.repeat(fw.model) + '┼' + '─'.repeat(fw.collection) + '┼' + '─'.repeat(fw.minted) + '┼' + '─'.repeat(fw.status) + '\n';

            // Data rows
            const errors = [];
            results.forEach((result) => {
                const modelName = result.model || getModelName(result.collectionName) || result.collectionName || 'Unknown';
                const collectionNameDisplay = result.actualCollectionName || result.collectionName || '-';

                const model = padRight(modelName, fw.model);
                const collection = padRight(collectionNameDisplay, fw.collection);

                // Minted: extract nft_ids from URLs
                let minted = '-';
                if (result.status === 'PASSED' && result.mintedUrls && result.mintedUrls.length > 0) {
                    const nftIds = result.mintedUrls.map(url => extractNftId(url)).filter(id => id);
                    minted = nftIds.length > 0 ? nftIds.map(id => `id=${id}`).join(',') : `${result.mintedUrls.length} NFT`;
                }

                const statusTxt = padCenter(result.status === 'PASSED' ? '✅Pass' : '❌Fail', fw.status);

                // No Sold column for Fair Launch
                table += model + '│' + collection + '│' + padCenter(minted, fw.minted) + '│' + statusTxt + '\n';

                if (result.status === 'FAILED' && result.error) {
                    errors.push({ model: modelName, error: stripAnsi(result.error).replace(/\n/g, ' ') });
                }
            });

            // Bottom line (no Sold column)
            table += '─'.repeat(fw.model) + '┴' + '─'.repeat(fw.collection) + '┴' + '─'.repeat(fw.minted) + '┴' + '─'.repeat(fw.status);
            table += '</pre>';

            if (errors.length > 0) {
                table += '\n\n💬 <b>Errors:</b>';
                errors.forEach(e => {
                    table += `\n• <b>${escapeHtml(e.model)}</b>: <code>${escapeHtml(e.error)}</code>`;
                });
            }

            return table;
        }

        // Show Bonding Curve table if has results (with Sold column)
        if (bondingResults.length > 0) {
            const bondingStatus = bondingResults.some(r => r.status === 'FAILED') ? '🔴' : '🟢';
            message += buildBondingTable(bondingResults, '📦 Bonding Curve', bondingStatus);
        }

        // Show Fair Launch table if has results (NO Sold column)
        if (fairLaunchResults.length > 0) {
            const fairLaunchStatus = fairLaunchResults.some(r => r.status === 'FAILED') ? '🔴' : '🟢';
            message += buildFairLaunchTable(fairLaunchResults, '💰 Fixed Price (Fair Launch)', fairLaunchStatus);
        }
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
