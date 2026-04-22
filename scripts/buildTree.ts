import { buildPoseidon } from 'circomlibjs';
import { MerkleTree } from 'merkletreejs';
import { ethers } from 'ethers';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { fetchAllSanctions } from './fetchSanctions';

dotenv.config();

export interface MerkleTreeResult {
  tree: MerkleTree;
  root: string; // hex string with 0x prefix
  totalLeaves: number;
  buildTimestamp: number; // unix timestamp
  ipfsHash: string; // published metadata hash
}

export interface MerkleProofResult {
  pathElements: string[]; // array of hex siblings
  pathIndices: number[]; // array of 0 or 1
  root: string; // current tree root
  leaf: string; // the address leaf hash
}

/**
 * Converts an Ethereum address to a Merkle tree leaf using Poseidon hash.
 * @param address The Ethereum address.
 * @param poseidon The Poseidon hash function.
 * @returns The leaf as a 32-byte Buffer.
 */
export function addressToLeaf(address: string, poseidon: any): Buffer {
  const addrBigInt = BigInt(address);
  const hash = poseidon([addrBigInt]);
  const hex = '0x' + hash.toString(16).padStart(64, '0');
  return Buffer.from(hex.slice(2), 'hex');
}

/**
 * Builds a Poseidon Merkle tree from clean addresses.
 * @param cleanAddresses Array of clean Ethereum addresses.
 * @returns Promise resolving to the Merkle tree result.
 */
export async function buildComplianceTree(cleanAddresses: string[]): Promise<MerkleTreeResult> {
  try {
    const poseidon = await buildPoseidon();

    const leaves = cleanAddresses.map(addr => addressToLeaf(addr, poseidon));

    const hashFunction = (left: Buffer, right: Buffer): Buffer => {
      const leftBigInt = BigInt('0x' + left.toString('hex'));
      const rightBigInt = BigInt('0x' + right.toString('hex'));
      const hash = poseidon([leftBigInt, rightBigInt]);
      const hex = '0x' + hash.toString(16).padStart(64, '0');
      return Buffer.from(hex.slice(2), 'hex');
    };

    const tree = new MerkleTree(leaves, hashFunction, { sortPairs: true });

    const root = '0x' + tree.getRoot().toString('hex');

    const metadata = {
      root,
      totalLeaves: cleanAddresses.length,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const ipfsHash = await publishToIPFS(metadata);

    console.log(`[TREE] Built tree with root: ${root}`);
    console.log(`[TREE] IPFS hash: ${ipfsHash}`);

    return {
      tree,
      root,
      totalLeaves: cleanAddresses.length,
      buildTimestamp: metadata.timestamp,
      ipfsHash,
    };
  } catch (error) {
    console.error('[TREE] Error building tree:', error);
    throw error;
  }
}

/**
 * Generates a Merkle proof for an address.
 * @param address The Ethereum address.
 * @param tree The Merkle tree.
 * @param poseidon The Poseidon hash function.
 * @returns The Merkle proof result.
 */
export function getMerkleProof(address: string, tree: MerkleTree, poseidon: any): MerkleProofResult {
  try {
    const leaf = addressToLeaf(address, poseidon);
    const proof = tree.getProof(leaf);

    const pathElements = proof.map(p => '0x' + p.data.toString('hex'));
    const pathIndices = proof.map(p => p.position === 'left' ? 0 : 1);
    const root = '0x' + tree.getRoot().toString('hex');

    return {
      pathElements,
      pathIndices,
      root,
      leaf: '0x' + leaf.toString('hex'),
    };
  } catch (error) {
    console.error('[TREE] Error generating proof:', error);
    throw error;
  }
}

/**
 * Publishes data to IPFS via Pinata.
 * @param data The data object to publish.
 * @returns Promise resolving to the IPFS hash.
 */
export async function publishToIPFS(data: object): Promise<string> {
  try {
    const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', data, {
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: process.env.PINATA_API_KEY,
        pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
      },
    });
    return response.data.IpfsHash;
  } catch (error) {
    console.error('[TREE] Error publishing to IPFS:', error);
    return '';
  }
}

/**
 * Main function to build the compliance tree.
 */
export async function main() {
  try {
    console.log('[TREE] Fetching sanctioned addresses...');
    const sanctionedSet = await fetchAllSanctions();

    console.log('[TREE] Generating clean addresses...');
    const cleanAddresses: string[] = [];
    while (cleanAddresses.length < 100) {
      const randomAddr = ethers.Wallet.createRandom().address;
      if (!sanctionedSet.has(randomAddr.toLowerCase())) {
        cleanAddresses.push(randomAddr);
      }
    }

    console.log(`[TREE] Building tree with ${cleanAddresses.length} clean addresses...`);
    const result = await buildComplianceTree(cleanAddresses);

    console.log(`[TREE] Tree built successfully. Root: ${result.root}, Leaves: ${result.totalLeaves}`);
  } catch (error) {
    console.error('[TREE] Error in main:', error);
  }
}

// Run main if executed directly
if (require.main === module) {
  main();
}
