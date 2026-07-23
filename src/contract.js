// Multi-network contract addresses
export const MULTISENDER_ADDRESSES = {
  1: "0x33b82Ad6f62332D6359e582b642466591A6a9DDA",      // Ethereum Mainnet
  56: "0x3439e381c835C41427448970847309A28CEC51F7",     // BNB Chain
  8453: "0x41b5E7466A2923906c46Bbb77CE348c58365D851",   // Base
  137: "0x309A155c84E5576Bfb1FA45E3ed473dB83A0F3fF",    // Polygon
  42161: "0xEdA338C8C54bA991C612E91e3773D8Cfd3AFE058",   // Arbitrum
  10: "0x3F744ce2DCD69ca257839766Ce522e14D731D1e2",     // Optimism
  204: "0x69bdDA148672C7C9DB2d2CEA0C8513Ab3C4D971c",    // opBNB
  11155111: "0x33b82Ad6f62332D6359e582b642466591A6a9DDA", // Sepolia (testnet)
};

// Supported chain IDs
export const SUPPORTED_CHAINS = Object.keys(MULTISENDER_ADDRESSES).map(Number);

// Get contract address for a chain
export const getContractAddress = (chainId) => {
  return MULTISENDER_ADDRESSES[Number(chainId)] || null;
};

// Legacy export for backwards compatibility
export const MULTISENDER_ADDRESS = MULTISENDER_ADDRESSES[1];

export const MULTISENDER_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "recipients",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalAmount",
        "type": "uint256"
      }
    ],
    "name": "BatchSent",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address[]",
        "name": "recipients",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "amounts",
        "type": "uint256[]"
      }
    ],
    "name": "sendERC20",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "recipients",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "amounts",
        "type": "uint256[]"
      }
    ],
    "name": "sendNative",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

export const ERC20_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
