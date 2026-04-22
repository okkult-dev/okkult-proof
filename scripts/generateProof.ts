import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';

export interface ProofInput {
  address: string; // wallet address
  secret: string; // hex string — stored locally
  pathElements: string[]; // from getMerkleProof()
  pathIndices: number[]; // from getMerkleProof()
  root: string; // current Merkle root
}

export interface ProofOutput {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  publicInputs: {
    root: string; // hex with 0x prefix
    nullifier: string; // hex with 0x prefix
  };
  address: string;
  generatedAt: number; // unix timestamp
  validUntil: number; // unix timestamp (+30 days)
}

export interface CircuitInputs {
  address: string; // BigInt as string
  secret: string; // BigInt as string
  pathElements: string[]; // BigInt array as strings
  pathIndices: number[];
  root: string; // BigInt as string
  nullifier: string; // BigInt as string
}

const PROOF_VALIDITY_SECONDS = 30 * 24 * 60 * 60;

const WASM_PATH_BROWSER = '/circuits/compliance.wasm';
const ZKEY_PATH_BROWSER = '/circuits/compliance_final.zkey';
const WASM_PATH_NODE = './build/compliance_wasm/compliance.js';
const ZKEY_PATH_NODE = './build/compliance_final.zkey';

/**
 * Computes the nullifier from address and secret using Poseidon.
 * @param address The wallet address.
 * @param secret The secret hex string.
 * @param poseidon The Poseidon hash function.
 * @returns The nullifier as hex string with 0x prefix.
 */
export function computeNullifier(address: string, secret: string, poseidon: any): string {
  const addrBigInt = BigInt(address);
  const secretBigInt = BigInt(secret);
  const hash = poseidon([addrBigInt, secretBigInt]);
  return '0x' + hash.toString(16).padStart(64, '0');
}

/**
 * Builds the circuit inputs for the ZK proof.
 * @param input The proof input.
 * @param poseidon The Poseidon hash function.
 * @returns The circuit inputs object.
 */
export function buildCircuitInputs(input: ProofInput, poseidon: any): CircuitInputs {
  const nullifier = computeNullifier(input.address, input.secret, poseidon);
  return {
    address: BigInt(input.address).toString(),
    secret: BigInt(input.secret).toString(),
    pathElements: input.pathElements.map(el => BigInt(el).toString()),
    pathIndices: input.pathIndices,
    root: BigInt(input.root).toString(),
    nullifier: BigInt(nullifier).toString(),
  };
}

/**
 * Generates a compliance ZK proof.
 * @param input The proof input.
 * @returns Promise resolving to the proof output.
 */
export async function generateComplianceProof(input: ProofInput): Promise<ProofOutput> {
  try {
    const poseidon = await buildPoseidon();
    const circuitInputs = buildCircuitInputs(input, poseidon);

    const isBrowser = typeof window !== 'undefined';
    const wasmPath = isBrowser ? WASM_PATH_BROWSER : WASM_PATH_NODE;
    const zkeyPath = isBrowser ? ZKEY_PATH_BROWSER : ZKEY_PATH_NODE;

    console.log(`[PROOF] Generating proof for address: ${input.address}`);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInputs, wasmPath, zkeyPath);

    const root = '0x' + BigInt(publicSignals[0]).toString(16).padStart(64, '0');
    const nullifier = '0x' + BigInt(publicSignals[1]).toString(16).padStart(64, '0');

    const generatedAt = Math.floor(Date.now() / 1000);
    const validUntil = generatedAt + PROOF_VALIDITY_SECONDS;

    console.log(`[PROOF] Proof generated successfully. Nullifier: ${nullifier}`);

    return {
      proof: {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
      },
      publicInputs: {
        root,
        nullifier,
      },
      address: input.address,
      generatedAt,
      validUntil,
    };
  } catch (error) {
    console.error('[PROOF] Error generating proof:', error);
    throw error;
  }
}

/**
 * Verifies a proof locally using the verification key.
 * @param proof The proof output.
 * @param vkPath The path to the verification key.
 * @returns Promise resolving to true if valid, false otherwise.
 */
export async function verifyProofLocally(proof: ProofOutput, vkPath: string): Promise<boolean> {
  try {
    const vkey = await snarkjs.zKey.exportVerificationKey(vkPath);
    const publicSignals = [proof.publicInputs.root, proof.publicInputs.nullifier];
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof.proof);
    console.log(`[PROOF] Local verification: ${isValid}`);
    return isValid;
  } catch (error) {
    console.error('[PROOF] Error verifying proof locally:', error);
    return false;
  }
}

/**
 * Generates a cryptographically secure random secret.
 * @returns The secret as hex string with 0x prefix.
 */
export function generateSecret(): string {
  const bytes = new Uint8Array(32);
  if (typeof window !== 'undefined') {
    // Browser
    crypto.getRandomValues(bytes);
  } else {
    // Node.js
    const crypto = require('crypto');
    crypto.randomFillSync(bytes);
  }
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Stores the secret in localStorage for the given address.
 * @param address The wallet address.
 * @param secret The secret hex string.
 */
export function storeSecret(address: string, secret: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`okkult_secret_${address}`, secret);
  }
  // No-op in Node.js
}

/**
 * Loads the secret from localStorage for the given address.
 * @param address The wallet address.
 * @returns The secret hex string or null if not found.
 */
export function loadSecret(address: string): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(`okkult_secret_${address}`);
  }
  return null; // No-op in Node.js
}
