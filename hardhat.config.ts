import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import * as dotenv from "dotenv";

dotenv.config();

// Warn about missing environment variables
if (!process.env.ALCHEMY_MAINNET_URL) {
  console.warn("Warning: ALCHEMY_MAINNET_URL not set. Hardhat forking and mainnet deployment will fail.");
}
if (!process.env.ALCHEMY_SEPOLIA_URL) {
  console.warn("Warning: ALCHEMY_SEPOLIA_URL not set. Sepolia deployment will fail.");
}
if (!process.env.DEPLOYER_PRIVATE_KEY) {
  console.warn("Warning: DEPLOYER_PRIVATE_KEY not set. Deployments will fail.");
}
if (!process.env.ETHERSCAN_API_KEY) {
  console.warn("Warning: ETHERSCAN_API_KEY not set. Contract verification will fail.");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },
  networks: {
    // Local Hardhat network with mainnet forking for testing against real contracts
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_MAINNET_URL || "",
      },
      chainId: 31337,
      mining: {
        auto: true,
      },
    },
    // Localhost network for connecting to a local Hardhat node
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Sepolia testnet for testing deployments
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    // Ethereum mainnet for production deployments
    mainnet: {
      url: process.env.ALCHEMY_MAINNET_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 1,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  namedAccounts: {
    deployer: 0, // First account for deployments
    treasury: 1, // Second account for fee collection
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
    currency: "USD",
  },
};

export default config;
