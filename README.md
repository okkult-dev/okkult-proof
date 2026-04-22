# okkult-proof

```bash
$ cat description.txt
> Zero-knowledge compliance proof for Ethereum.
> Prove your address is clean. Reveal nothing.
```

---

## Overview

Core compliance primitive of the Okkult Protocol.

Generates a ZK proof that cryptographically proves
a wallet address is not on any sanctions list —
without revealing the address, its balance,
or its transaction history.

```
Address processed locally
         ↓
Sanctions check (OFAC + Chainalysis Oracle)
         ↓
ZK proof generated in browser
         ↓
Proof submitted on-chain
         ↓
Certificate valid 30 days
```

---

## What is proven

| Claim | Hidden |
|-------|--------|
| Address is not sanctioned | Wallet address |
| Funds are from clean sources | Balance |
| Proof has not been used before | Transaction history |

---

## Structure

```
circuits/          Circom ZK circuits
contracts/         Solidity smart contracts
scripts/           Off-chain proof generation
test/              Full test suite
deployments/       Deployed contract addresses
```

---

## Deployed Contracts

### Ethereum Mainnet

| Contract | Address |
|----------|---------|
| OkkultVerifier | `0x...` |
| ComplianceTree | `0x...` |
| NullifierRegistry | `0x...` |

---

## Install

```bash
git clone https://github.com/okkult-dev/okkult-proof
cd okkult-proof
npm install
```

---

## Generate a proof

```typescript
import { generateComplianceProof } from './scripts/generateProof'

const proof = await generateComplianceProof(
  walletAddress,
  secret,
  merkleData
)
```

---

## Run tests

```bash
npm test
```

---

## Deploy contracts

```bash
# Testnet
npx hardhat run scripts/deploy.ts --network sepolia

# Mainnet
npx hardhat run scripts/deploy.ts --network mainnet
```

---

## Part of Okkult Protocol

```
okkult-proof      ← you are here
okkult-circuits
okkult-contracts
okkult-sdk
okkult-app
okkult-subgraph
okkult-docs
```

---

## License

MIT — [okkult.io](https://okkult.io) · [@Okkult_](https://x.com/Okkult_)
