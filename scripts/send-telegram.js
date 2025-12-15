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

// Main function
async function main() {
    const args = process.argv.slice(2);
    const status = args[0] || 'UNKNOWN';
    const duration = args[1] || '0';
    const testName = args[2] || 'Dopamint Test';
    const screenshotPath = args[3] || '';

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
    
    const message = `
${emoji} <b>DOPAMINT AUTO TEST</b>

📋 Test: ${testName}
📅 Time: ${timestamp}
📊 Status: <b>${statusText}</b>
⏱ Duration: ${duration}s

🤖 Automated by Playwright
    `.trim();

    try {
        await sendTelegramMessage(message);
        console.log('✅ Telegram message sent!');

        // Send screenshot if exists
        if (screenshotPath && fs.existsSync(screenshotPath)) {
            await sendTelegramPhoto(screenshotPath, `📸 Screenshot: ${testName}`);
            console.log('✅ Screenshot sent!');
        }
    } catch (error) {
        console.error('❌ Failed to send Telegram:', error.message);
        process.exit(1);
    }
}

main();
