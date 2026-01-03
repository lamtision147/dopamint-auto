import dappwright, { Dappwright, MetaMaskWallet } from "@tenkeylabs/dappwright";
import { BrowserContext } from "@playwright/test";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Profile directory for isolated test execution
const PROFILES_DIR = path.resolve(__dirname, '../.metamask-profiles');

// Seed phrase for MetaMask
const SEED_PHRASE = process.env.METAMASK_SEED_PHRASE ||
  "woman open manual riot okay special unique diesel give morning spring mention";

// Only use WALLET_0 for all tests
const WALLET_0_KEY = process.env.WALLET_0;

// Delay between workers in milliseconds (1 minute 10 seconds = 70 seconds)
const WORKER_DELAY_MS = 70000;

/**
 * Setup MetaMask with isolated profile for each worker
 * Each worker gets its own Chrome profile directory to avoid conflicts
 *
 * @param workerIndex - Playwright parallelIndex (0-10 for 11 workers)
 */
export async function setupMetaMask(
  workerIndex: number = 0
): Promise<{ wallet: Dappwright; context: BrowserContext }> {
  // Each worker uses a unique profile based on workerIndex
  const profileId = `worker-${workerIndex}`;
  const profileDir = path.join(PROFILES_DIR, profileId);

  // Delay based on workerIndex (worker 0 starts immediately, worker 1 waits 10s, etc.)
  const delayMs = workerIndex * WORKER_DELAY_MS;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 [WORKER ${workerIndex}] STARTING`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Profile ID: ${profileId}`);
  console.log(`   Profile Dir: ${profileDir}`);
  console.log(`   Delay: ${delayMs / 1000}s`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);

  if (delayMs > 0) {
    console.log(`\n⏳ [Worker ${workerIndex}] Waiting ${delayMs / 1000}s before starting...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    console.log(`✅ [Worker ${workerIndex}] Delay completed, starting now...`);
  }

  // Create profile directory if not exists
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
    console.log(`   📁 Created profile directory: ${profileDir}`);
  } else {
    console.log(`   📁 Using existing profile directory: ${profileDir}`);
  }

  // Bootstrap MetaMask with isolated profile
  console.log(`\n🔧 [Worker ${workerIndex}] Starting MetaMask bootstrap...`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);

  const [wallet, _, context] = await dappwright.bootstrap("", {
    wallet: "metamask",
    version: MetaMaskWallet.recommendedVersion,
    seed: SEED_PHRASE,
    headless: false,
  });

  console.log(`✅ [Worker ${workerIndex}] MetaMask bootstrap completed`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);

  // Always use WALLET_0 for all tests
  if (WALLET_0_KEY) {
    const cleanKey = WALLET_0_KEY.startsWith('0x') ? WALLET_0_KEY.slice(2) : WALLET_0_KEY;
    try {
      await wallet.importPK(cleanKey);
      await wallet.switchAccount('Account 2');
      console.log(`   🔑 Imported WALLET_0 and switched to Account 2`);
    } catch (e) {
      console.log(`   ⚠️ Could not import WALLET_0, using base wallet`);
    }
  } else {
    // Fallback to hardcoded default private key
    try {
      await wallet.importPK('974ba34e85371e6e3b3a443b3f0c5f8b15b2b48aa13d3d60f97fae6b884b9313');
      await wallet.switchAccount('Account 2');
      console.log(`   🔑 Using default wallet, switched to Account 2`);
    } catch (e) {
      console.log(`   ⚠️ Could not import default private key`);
    }
  }

  console.log(`✅ [Worker ${workerIndex}] MetaMask ready!`);

  return { wallet, context };
}
