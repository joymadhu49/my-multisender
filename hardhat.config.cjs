require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    // Match the verified on-chain deployments (ETH/BSC/Base/etc.):
    // optimizer OFF, evmVersion shanghai — keeps opBNB bytecode identical.
    settings: {
      optimizer: {
        enabled: false,
        runs: 200
      },
      evmVersion: "shanghai"
    }
  },
  networks: {
    // Ethereum Mainnet
    mainnet: {
      url: process.env.MAINNET_RPC || "https://eth.llamarpc.com",
      accounts: [PRIVATE_KEY],
      chainId: 1
    },
    // Sepolia Testnet
    sepolia: {
      url: process.env.SEPOLIA_RPC || "https://rpc.sepolia.org",
      accounts: [PRIVATE_KEY],
      chainId: 11155111
    },
    // Polygon Mainnet
    polygon: {
      url: process.env.POLYGON_RPC || "https://polygon-rpc.com",
      accounts: [PRIVATE_KEY],
      chainId: 137
    },
    // Base Mainnet
    base: {
      url: process.env.BASE_RPC || "https://mainnet.base.org",
      accounts: [PRIVATE_KEY],
      chainId: 8453
    },
    // BSC Mainnet
    bsc: {
      url: process.env.BSC_RPC || "https://bsc-dataseed.binance.org",
      accounts: [PRIVATE_KEY],
      chainId: 56
    },
    // Arbitrum
    arbitrum: {
      url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
      accounts: [PRIVATE_KEY],
      chainId: 42161
    },
    // opBNB Mainnet
    opbnb: {
      url: process.env.OPBNB_RPC || "https://opbnb-mainnet-rpc.bnbchain.org",
      accounts: [PRIVATE_KEY],
      chainId: 204
    },
    // opBNB Testnet
    opbnbTestnet: {
      url: process.env.OPBNB_TESTNET_RPC || "https://opbnb-testnet-rpc.bnbchain.org",
      accounts: [PRIVATE_KEY],
      chainId: 5611
    },
    // Robinhood Chain (Arbitrum Nitro L2 on Ethereum, native ETH)
    robinhood: {
      url: process.env.ROBINHOOD_RPC || "https://rpc.mainnet.chain.robinhood.com",
      accounts: [PRIVATE_KEY],
      chainId: 4663
    },
    // Robinhood Chain Testnet (settles to Sepolia)
    robinhoodTestnet: {
      url: process.env.ROBINHOOD_TESTNET_RPC || "https://rpc.testnet.chain.robinhood.com/rpc",
      accounts: [PRIVATE_KEY],
      chainId: 46630
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "opbnb",
        chainId: 204,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=204",
          browserURL: "https://opbnb.bscscan.com"
        }
      },
      {
        network: "opbnbTestnet",
        chainId: 5611,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=5611",
          browserURL: "https://opbnb-testnet.bscscan.com"
        }
      }
    ]
  },
  // Robinhood Chain has no Etherscan V2 coverage. Its explorers are Blockscout
  // instances, so they belong here rather than in etherscan.customChains.
  //
  // Caveat: robinhoodchain.blockscout.com is TLS-blocked on some networks
  // (including the one this repo was developed on), so `hardhat verify
  // --network robinhood` can fail before it reaches the explorer. The working
  // path from here is Sourcify, which supports chain 4663 and produced an
  // exact match for the deployed contract:
  //
  //   node scripts/verify-sourcify.cjs <address> [creationTxHash]
  //
  // (The plugin's own `sourcify: { enabled: true }` does not work with this
  // version — it still calls Sourcify's retired v1 API and gets back HTML.)
  blockscout: {
    enabled: true,
    customChains: [
      {
        network: "robinhood",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com"
        }
      },
      {
        network: "robinhoodTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com"
        }
      }
    ]
  }
};
