import { ethers } from 'ethers';
import * as cron from 'node-cron';
import * as dotenv from 'dotenv';
import { fetchAllSanctions } from './fetchSanctions';
import { buildComplianceTree } from './buildTree';

dotenv.config();

export interface UpdateResult {
  success: boolean;
  oldRoot: string;
  newRoot: string;
  txHash: string;
  timestamp: number;
  totalLeaves: number;
}

const COMPLIANCE_TREE_ABI = [
  {
    name: 'updateRoot',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newRoot', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'currentRoot',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    name: 'isRootValid',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'lastUpdated',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
];

/**
 * Gets the current root from the on-chain ComplianceTree contract.
 * @returns Promise resolving to the current root as hex string.
 */
export async function getCurrentOnChainRoot(): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_MAINNET_URL);
    const contract = new ethers.Contract(process.env.COMPLIANCE_TREE_ADDRESS!, COMPLIANCE_TREE_ABI, provider);
    const root = await contract.currentRoot();
    return root;
  } catch (error) {
    console.error('[UPDATE] Error getting current root:', error);
    throw error;
  }
}

/**
 * Checks if the compliance tree needs an update.
 * @returns Promise resolving to true if update is needed.
 */
export async function needsUpdate(): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_MAINNET_URL);
    const contract = new ethers.Contract(process.env.COMPLIANCE_TREE_ADDRESS!, COMPLIANCE_TREE_ABI, provider);
    const isValid = await contract.isRootValid();
    const lastUpdated = await contract.lastUpdated();
    const now = Math.floor(Date.now() / 1000);
    const sixHours = 6 * 60 * 60;
    const needs = !isValid || (now - Number(lastUpdated)) > sixHours;
    console.log(`[UPDATE] Root valid: ${isValid}, last updated: ${lastUpdated}, needs update: ${needs}`);
    return needs;
  } catch (error) {
    console.error('[UPDATE] Error checking if update needed:', error);
    return true; // Assume needs update on error
  }
}

/**
 * Updates the root on-chain by calling updateRoot.
 * @param newRoot The new Merkle root.
 * @returns Promise resolving to the transaction hash.
 */
export async function updateOnChainRoot(newRoot: string): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_MAINNET_URL);
    const signer = new ethers.Wallet(process.env.UPDATER_PRIVATE_KEY!, provider);
    const contract = new ethers.Contract(process.env.COMPLIANCE_TREE_ADDRESS!, COMPLIANCE_TREE_ABI, signer);
    const tx = await contract.updateRoot(newRoot);
    const receipt = await tx.wait();
    console.log(`[UPDATE] Root updated on-chain. Tx hash: ${receipt.hash}`);
    return receipt.hash;
  } catch (error) {
    console.error('[UPDATE] Error updating root on-chain:', error);
    throw error;
  }
}

/**
 * Runs the full update process: fetch sanctions, rebuild tree, update on-chain if needed.
 * @returns Promise resolving to the update result.
 */
export async function runUpdate(): Promise<UpdateResult> {
  try {
    console.log('[UPDATE] Starting compliance tree update');
    const oldRoot = await getCurrentOnChainRoot();
    console.log(`[UPDATE] Current on-chain root: ${oldRoot}`);

    const sanctionedSet = await fetchAllSanctions();
    console.log(`[UPDATE] Fetched ${sanctionedSet.size} sanctioned addresses`);

    // Generate clean addresses (in production, use all known ETH addresses minus sanctioned)
    const cleanAddresses: string[] = [];
    while (cleanAddresses.length < 1000) { // Use more in production
      const randomAddr = ethers.Wallet.createRandom().address;
      if (!sanctionedSet.has(randomAddr.toLowerCase())) {
        cleanAddresses.push(randomAddr);
      }
    }

    const treeResult = await buildComplianceTree(cleanAddresses);
    const newRoot = treeResult.root;
    console.log(`[UPDATE] New tree root: ${newRoot}, leaves: ${treeResult.totalLeaves}`);

    if (newRoot === oldRoot) {
      console.log('[UPDATE] Roots are the same, no update needed');
      return {
        success: true,
        oldRoot,
        newRoot,
        txHash: '',
        timestamp: Math.floor(Date.now() / 1000),
        totalLeaves: treeResult.totalLeaves,
      };
    }

    const txHash = await updateOnChainRoot(newRoot);
    console.log(`[UPDATE] Update successful. Old root: ${oldRoot}, New root: ${newRoot}, Tx: ${txHash}`);

    return {
      success: true,
      oldRoot,
      newRoot,
      txHash,
      timestamp: Math.floor(Date.now() / 1000),
      totalLeaves: treeResult.totalLeaves,
    };
  } catch (error) {
    console.error('[UPDATE] Error in runUpdate:', error);
    return {
      success: false,
      oldRoot: '',
      newRoot: '',
      txHash: '',
      timestamp: Math.floor(Date.now() / 1000),
      totalLeaves: 0,
    };
  }
}

/**
 * Starts the cron job to run updates every 6 hours.
 */
export function startCronJob(): void {
  cron.schedule('0 */6 * * *', async () => {
    try {
      await runUpdate();
    } catch (error) {
      console.error('[CRON] Error in scheduled update:', error);
    }
  });
  console.log('[CRON] Next update scheduled every 6 hours');
}

/**
 * Main function to start the update service.
 */
export async function main(): Promise<void> {
  console.log('[UPDATE] Starting Okkult root update service');

  // Run initial update
  await runUpdate();

  // Start cron job
  startCronJob();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('[UPDATE] Received SIGINT, shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[UPDATE] Received SIGTERM, shutting down...');
    process.exit(0);
  });
}

// Run main if executed directly
if (require.main === module) {
  main();
}
