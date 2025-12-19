import dappwright, { Dappwright, MetaMaskWallet } from "@tenkeylabs/dappwright";
import fs from 'fs';
import path from 'path';

// Multiple RPC endpoints to avoid rate limiting when running tests in parallel
const BASE_SEPOLIA_RPC_ENDPOINTS = [
  "https://base-sepolia-rpc.publicnode.com",
  "https://sepolia.base.org",
  "https://base-sepolia.blockpi.network/v1/rpc/public"
];

export async function setupMetaMask(testIndex: number = 0) {
  // Staggered delay to avoid MetaMask connection conflicts in parallel tests
  const delayMs = testIndex * 30000; // 0s, 30s, 60s for each test

  if (delayMs > 0) {
    console.log(`⏳ Waiting ${delayMs / 1000}s before MetaMask bootstrap to avoid conflicts...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  console.log('Starting MetaMask bootstrap...');

  const [wallet, _, context] = await dappwright.bootstrap("", {
    wallet: "metamask",
    version: MetaMaskWallet.recommendedVersion,
    seed: "woman open manual riot okay special unique diesel give morning spring mention",
    fresh: true,
    headless: false,
  });

  // // Use different RPC endpoint for each test
  // const rpcEndpoint = BASE_SEPOLIA_RPC_ENDPOINTS[testIndex % BASE_SEPOLIA_RPC_ENDPOINTS.length];
  // console.log(`Using RPC endpoint: ${rpcEndpoint}`);
  // await wallet.addNetwork({
  //   networkName: "Base Sepolia",
  //   rpc: rpcEndpoint,
  //   chainId: 84532,
  //   symbol: "ETH",
  // });

  await wallet.importPK('974ba34e85371e6e3b3a443b3f0c5f8b15b2b48aa13d3d60f97fae6b884b9313');
  //await wallet.importPK('541f46393f05c9d8eb924b9c2c9f05e431654145cbaac9aae5670f53cedcca45');
  await wallet.switchAccount('Account 2')//;wallet.switchAccount(2);
  return { wallet, context };
}
