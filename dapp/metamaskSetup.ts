import dappwright, { Dappwright, MetaMaskWallet } from "@tenkeylabs/dappwright";
import fs from 'fs';
import path from 'path';

// Generate unique session ID for parallel execution
const sessionId = `${Date.now()}_${process.pid}_${Math.random().toString(36).substring(7)}`;

// Helper function to cleanup old session folders (older than 1 hour)
function cleanupOldSessions(basePath: string): void {
  try {
    if (!fs.existsSync(basePath)) return;

    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const items = fs.readdirSync(basePath);

    for (const item of items) {
      // Clean up old numbered folders and old_ folders
      if (item.match(/^\d+$/) || item.includes('_old_')) {
        const fullPath = path.join(basePath, item);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.mtimeMs < oneHourAgo) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`Cleaned up old session: ${item}`);
          }
        } catch (e) {
          // Ignore - folder may be in use
        }
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}

export async function setupMetaMask() {
  // Create unique TEMP directory for this worker to enable parallel execution
  const originalTemp = process.env.TEMP || process.env.TMP || '/tmp';
  const uniqueTempPath = path.join(originalTemp, 'dappwright-workers', sessionId);

  // Create the unique temp directory
  fs.mkdirSync(uniqueTempPath, { recursive: true });

  // Set TEMP/TMP to unique path so dappwright uses isolated session
  process.env.TEMP = uniqueTempPath;
  process.env.TMP = uniqueTempPath;

  console.log(`Session ID: ${sessionId}`);
  console.log(`Using isolated TEMP: ${uniqueTempPath}`);

  // Cleanup old sessions from original temp (older than 1 hour)
  const oldSessionsPath = path.join(originalTemp, 'dappwright', 'session', 'metamask');
  cleanupOldSessions(oldSessionsPath);

  // Also cleanup old worker folders
  const workersPath = path.join(originalTemp, 'dappwright-workers');
  if (fs.existsSync(workersPath)) {
    try {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const workers = fs.readdirSync(workersPath);
      for (const worker of workers) {
        if (worker !== sessionId) {
          const workerPath = path.join(workersPath, worker);
          try {
            const stats = fs.statSync(workerPath);
            if (stats.mtimeMs < oneHourAgo) {
              fs.rmSync(workerPath, { recursive: true, force: true });
              console.log(`Cleaned up old worker: ${worker}`);
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  console.log('Starting MetaMask bootstrap...');

  const [wallet, _, context] = await dappwright.bootstrap("", {
    wallet: "metamask",
    version: MetaMaskWallet.recommendedVersion,
    seed: "woman open manual riot okay special unique diesel give morning spring mention",
    fresh: true,
    headless: false,
  });

  await wallet.addNetwork({
    networkName: "Base Sepolia",
    rpc: "https://base-sepolia-rpc.publicnode.com",
    chainId: 84532,
    symbol: "ETH",
  });

  await wallet.importPK('974ba34e85371e6e3b3a443b3f0c5f8b15b2b48aa13d3d60f97fae6b884b9313');
  //await wallet.importPK('541f46393f05c9d8eb924b9c2c9f05e431654145cbaac9aae5670f53cedcca45');
  await wallet.switchAccount('Account 2')//;wallet.switchAccount(2);
  return { wallet, context };
}
