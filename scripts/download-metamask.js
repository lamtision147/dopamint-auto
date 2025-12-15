const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSIONS_DIR = path.join(__dirname, '..', 'extensions');
const METAMASK_DIR = path.join(EXTENSIONS_DIR, 'metamask');

// MetaMask extension ID from Chrome Web Store
const METAMASK_ID = 'nkbihfbeogaeaoehlefnkodbefgpgknn';

// Chrome Web Store CRX download URL
function getCrxUrl(extensionId) {
  return `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;
}

async function downloadWithRedirect(url, dest, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const protocol = url.startsWith('https') ? https : require('http');

    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        console.log('Redirecting to:', redirectUrl.substring(0, 80) + '...');
        downloadWithRedirect(redirectUrl, dest, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function extractCrx(crxPath, destDir) {
  // CRX3 files have a specific header that we need to skip
  const buffer = fs.readFileSync(crxPath);

  // CRX3 format: 4 bytes magic + 4 bytes version + 4 bytes header length + header + zip
  const magic = buffer.toString('utf8', 0, 4);
  if (magic !== 'Cr24') {
    throw new Error('Invalid CRX file');
  }

  const version = buffer.readUInt32LE(4);
  let zipStart;

  if (version === 3) {
    // CRX3 format
    const headerLength = buffer.readUInt32LE(8);
    zipStart = 12 + headerLength;
  } else if (version === 2) {
    // CRX2 format
    const pubKeyLength = buffer.readUInt32LE(8);
    const sigLength = buffer.readUInt32LE(12);
    zipStart = 16 + pubKeyLength + sigLength;
  } else {
    throw new Error(`Unknown CRX version: ${version}`);
  }

  // Extract the ZIP portion
  const zipBuffer = buffer.slice(zipStart);
  const zipPath = crxPath.replace('.crx', '.zip');
  fs.writeFileSync(zipPath, zipBuffer);

  // Extract using adm-zip
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);

  // Cleanup
  fs.unlinkSync(zipPath);
}

async function main() {
  console.log('=== MetaMask Extension Setup for Playwright ===\n');

  // Create directories
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
  }

  if (fs.existsSync(METAMASK_DIR)) {
    console.log('MetaMask extension already exists at:', METAMASK_DIR);
    console.log('Delete the folder to re-download.\n');
    return METAMASK_DIR;
  }

  const crxPath = path.join(EXTENSIONS_DIR, 'metamask.crx');
  const url = getCrxUrl(METAMASK_ID);

  console.log('Downloading MetaMask from Chrome Web Store...');
  console.log('Extension ID:', METAMASK_ID);

  try {
    await downloadWithRedirect(url, crxPath);
    console.log('\nDownload complete!');
    console.log('File size:', (fs.statSync(crxPath).size / 1024 / 1024).toFixed(2), 'MB\n');

    console.log('Extracting CRX...');
    await extractCrx(crxPath, METAMASK_DIR);

    // Clean up CRX file
    fs.unlinkSync(crxPath);

    console.log('\n✅ MetaMask extension setup complete!');
    console.log('Extension path:', METAMASK_DIR);
    return METAMASK_DIR;
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n--- Manual Installation Instructions ---');
    console.log('1. Download MetaMask manually from: https://metamask.io/download');
    console.log('2. Or use Chrome Web Store extension downloader');
    console.log('3. Extract to:', METAMASK_DIR);
    process.exit(1);
  }
}

main();
