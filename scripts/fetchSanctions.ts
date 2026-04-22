import axios from 'axios';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

export interface SanctionedAddress {
  address: string; // checksummed Ethereum address
  source: 'OFAC' | 'CHAINALYSIS';
  addedAt: string; // ISO timestamp
}

const OFAC_XML_URL = 'https://sanctionslist.ofac.treas.gov/Full/SDN.XML';

const CHAINALYSIS_ORACLE = '0x40C57923924B5c5c5455c48D93317139ADDaC8fb';

const CHAINALYSIS_ORACLE_ABI = [
  {
    name: 'isSanctioned',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
];

/**
 * Fetches sanctioned addresses from OFAC XML API.
 * @returns Promise resolving to array of sanctioned addresses from OFAC.
 */
export async function fetchOFACSanctions(): Promise<SanctionedAddress[]> {
  try {
    const response = await axios.get(OFAC_XML_URL);
    const xml = response.data;
    const ethRegex = /ETH\s+([0-9a-fA-Fx]+)/g;
    const addresses: SanctionedAddress[] = [];
    let match;
    while ((match = ethRegex.exec(xml)) !== null) {
      const rawAddress = match[1];
      try {
        const normalized = ethers.getAddress(rawAddress);
        addresses.push({
          address: normalized,
          source: 'OFAC',
          addedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Skip invalid addresses
        console.log(`[OFAC] Skipping invalid address: ${rawAddress}`);
      }
    }
    console.log(`[OFAC] Found ${addresses.length} sanctioned addresses`);
    return addresses;
  } catch (error) {
    console.error('[OFAC] Error fetching sanctions:', error);
    return [];
  }
}

/**
 * Checks if an address is sanctioned according to Chainalysis oracle.
 * @param address The Ethereum address to check.
 * @returns Promise resolving to true if sanctioned, false otherwise.
 */
export async function checkChainalysis(address: string): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_MAINNET_URL);
    const contract = new ethers.Contract(CHAINALYSIS_ORACLE, CHAINALYSIS_ORACLE_ABI, provider);
    const result = await contract.isSanctioned(address);
    return result;
  } catch (error) {
    console.error(`[CHAINALYSIS] Error checking address ${address}:`, error);
    return false;
  }
}

/**
 * Fetches all sanctioned addresses from OFAC and returns a deduplicated set.
 * @returns Promise resolving to a Set of lowercased sanctioned addresses.
 */
export async function fetchAllSanctions(): Promise<Set<string>> {
  const ofacAddresses = await fetchOFACSanctions();
  const sanctionedSet = new Set<string>();
  for (const addr of ofacAddresses) {
    sanctionedSet.add(addr.address.toLowerCase());
  }
  console.log(`[SANCTIONS] Total unique sanctioned addresses: ${sanctionedSet.size}`);
  return sanctionedSet;
}

/**
 * Checks if an address is sanctioned by either OFAC or Chainalysis.
 * @param address The Ethereum address to check.
 * @returns Promise resolving to true if sanctioned, false otherwise.
 */
export async function isSanctioned(address: string): Promise<boolean> {
  try {
    const normalized = ethers.getAddress(address);
    const lower = normalized.toLowerCase();

    // Check OFAC
    const ofacSanctions = await fetchAllSanctions();
    if (ofacSanctions.has(lower)) {
      return true;
    }

    // Check Chainalysis
    const chainalysisResult = await checkChainalysis(normalized);
    return chainalysisResult;
  } catch (error) {
    console.error(`[SANCTIONS] Error checking address ${address}:`, error);
    return false;
  }
}
