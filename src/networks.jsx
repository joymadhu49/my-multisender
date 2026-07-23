// Single source of truth for supported networks.
//
// Consumed by:
//   - App.jsx (network switcher, display, fallbacks)
//   - config.js APP_CONFIG.NETWORK_CONFIG (re-exported for back-compat)
//   - App.jsx switchNetwork() chainParams (wallet_addEthereumChain)
//
// Do NOT duplicate this map elsewhere — import from here.

import React from 'react'

// ── Network metadata ────────────────────────────────────────────────────────
// `symbol` is the display symbol for the native currency. Polygon's native
// token migrated from MATIC to POL — we use POL consistently here (the old
// inline chainParams in switchNetwork still said MATIC, which was a bug).

export const NETWORKS = {
  1: {
    name: 'Ethereum',
    symbol: 'ETH',
    explorer: 'https://etherscan.io',
    coingeckoId: 'ethereum',
    logo: 'ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    chainParams: {
      chainName: 'Ethereum Mainnet',
      rpcUrls: ['https://eth.llamarpc.com'],
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      blockExplorerUrls: ['https://etherscan.io'],
    },
  },
  56: {
    name: 'BNB Chain',
    symbol: 'BNB',
    explorer: 'https://bscscan.com',
    coingeckoId: 'binancecoin',
    logo: 'bnb',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    chainParams: {
      chainName: 'BNB Smart Chain',
      rpcUrls: ['https://bsc-dataseed.binance.org'],
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      blockExplorerUrls: ['https://bscscan.com'],
    },
  },
  8453: {
    name: 'Base',
    symbol: 'ETH',
    explorer: 'https://basescan.org',
    coingeckoId: 'ethereum',
    logo: 'base',
    rpcUrl: 'https://mainnet.base.org',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    chainParams: {
      chainName: 'Base',
      rpcUrls: ['https://mainnet.base.org'],
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      blockExplorerUrls: ['https://basescan.org'],
    },
  },
  137: {
    name: 'Polygon',
    symbol: 'POL',
    explorer: 'https://polygonscan.com',
    coingeckoId: 'polygon-ecosystem-token',
    logo: 'polygon',
    rpcUrl: 'https://polygon-rpc.com',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    chainParams: {
      chainName: 'Polygon',
      rpcUrls: ['https://polygon-rpc.com'],
      nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
      blockExplorerUrls: ['https://polygonscan.com'],
    },
  },
  42161: {
    name: 'Arbitrum',
    symbol: 'ETH',
    explorer: 'https://arbiscan.io',
    coingeckoId: 'ethereum',
    logo: 'arbitrum',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    chainParams: {
      chainName: 'Arbitrum One',
      rpcUrls: ['https://arb1.arbitrum.io/rpc'],
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      blockExplorerUrls: ['https://arbiscan.io'],
    },
  },
  10: {
    name: 'Optimism',
    symbol: 'ETH',
    explorer: 'https://optimistic.etherscan.io',
    coingeckoId: 'ethereum',
    logo: 'optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    chainParams: {
      chainName: 'Optimism',
      rpcUrls: ['https://mainnet.optimism.io'],
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      blockExplorerUrls: ['https://optimistic.etherscan.io'],
    },
  },
  204: {
    name: 'opBNB',
    symbol: 'BNB',
    explorer: 'https://opbnb.bscscan.com',
    coingeckoId: 'binancecoin',
    logo: 'opbnb',
    rpcUrl: 'https://opbnb-mainnet-rpc.bnbchain.org',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    chainParams: {
      chainName: 'opBNB Mainnet',
      rpcUrls: ['https://opbnb-mainnet-rpc.bnbchain.org'],
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      blockExplorerUrls: ['https://opbnb.bscscan.com'],
    },
  },
  11155111: {
    name: 'Sepolia',
    symbol: 'ETH',
    explorer: 'https://sepolia.etherscan.io',
    coingeckoId: 'ethereum',
    logo: 'sepolia',
    rpcUrl: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    chainParams: {
      chainName: 'Sepolia',
      rpcUrls: ['https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'],
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      blockExplorerUrls: ['https://sepolia.etherscan.io'],
    },
  },
}

// Fallback used by getCurrentNetworkConfig() when chainId is null/unknown.
export const UNKNOWN_NETWORK = {
  name: 'Unknown',
  symbol: 'ETH',
  explorer: 'https://etherscan.io',
  coingeckoId: 'ethereum',
  logo: null,
}

export const getNetwork = (chainId) => NETWORKS[Number(chainId)] || UNKNOWN_NETWORK

// ── Network logos (inline SVG) ───────────────────────────────────────────────
// Hoisted out of the App component body so the JSX elements are not rebuilt
// on every render. Components are stable references.

const EthereumLogo = (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#627EEA"/>
    <path d="M16.498 4v8.87l7.497 3.35L16.498 4z" fill="#fff" fillOpacity=".6"/>
    <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/>
    <path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#fff" fillOpacity=".6"/>
    <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#fff"/>
    <path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#fff" fillOpacity=".2"/>
    <path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#fff" fillOpacity=".6"/>
  </svg>
)

const BnbLogo = (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#F3BA2F"/>
    <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003 2.263-2.257zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002L16 13.706l-2.173 2.173-.02.02-.122.122.115.115L16 18.294l2.293-2.293.002-.002-.003-.001z" fill="#fff"/>
  </svg>
)

const PolygonLogo = (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#8247E5"/>
    <path d="M21.092 12.693c-.369-.215-.848-.215-1.254 0l-2.879 1.654-1.955 1.078-2.879 1.653c-.369.216-.848.216-1.254 0l-2.288-1.294c-.369-.215-.627-.61-.627-1.042V12.19c0-.431.221-.826.627-1.042l2.25-1.258c.37-.216.85-.216 1.256 0l2.25 1.258c.37.216.628.611.628 1.042v1.654l1.955-1.115v-1.653a1.16 1.16 0 00-.627-1.042l-4.17-2.372c-.369-.216-.848-.216-1.254 0l-4.244 2.372A1.16 1.16 0 006 11.076v4.78c0 .432.221.827.627 1.043l4.244 2.372c.369.215.849.215 1.254 0l2.879-1.618 1.955-1.114 2.879-1.617c.369-.216.848-.216 1.254 0l2.251 1.258c.37.215.627.61.627 1.042v2.552c0 .431-.22.826-.627 1.042l-2.25 1.294c-.37.216-.85.216-1.255 0l-2.251-1.258c-.37-.216-.628-.611-.628-1.042v-1.654l-1.955 1.115v1.653c0 .431.221.827.627 1.042l4.244 2.372c.369.216.848.216 1.254 0l4.244-2.372c.369-.215.627-.61.627-1.042v-4.78a1.16 1.16 0 00-.627-1.042l-4.28-2.409z" fill="#fff"/>
  </svg>
)

const ArbitrumLogo = (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#213147"/>
    <path d="M16.62 21.54l1.14 3.13.93-.34-1.4-3.86-.67 1.07zm4.86-7.31l-3.41 5.44 1.27 3.49 4.54-7.24-2.4-1.69zm-7.57 5.57l-.85 1.35 1.4 3.87.93-.34-1.48-4.88zm1.76-2.82l2.26-3.6-1.28-3.52-3.93 6.27 2.95.85zm6.27-4.51l-2.59 4.13 2.19.63 2.48-3.96-2.08-.8zM16 6l-6.46 10.31 2.27.65L16 10.15l4.19 6.81 2.27-.65L16 6z" fill="#fff"/>
    <path d="M16 6l-6.46 10.31 2.27.65L16 10.15l4.19 6.81 2.27-.65L16 6z" fill="#9DCCED"/>
    <path d="M9.54 16.31L7 21.37l2.08.8 2.59-4.14-2.13-1.72z" fill="#fff"/>
    <path d="M11.67 17.16l-2.59 4.14.93.34 1.4-3.86-.85-1.35.11.73z" fill="#9DCCED"/>
  </svg>
)

const OptimismLogo = (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#FF0420"/>
    <circle cx="12" cy="16" r="4" fill="#fff"/>
    <circle cx="12" cy="16" r="2" fill="#FF0420"/>
    <path d="M18 12h2.5c1.93 0 3.5 1.57 3.5 3.5v0c0 1.93-1.57 3.5-3.5 3.5H18v-7z" fill="#fff"/>
  </svg>
)

const BaseLogo = (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#0052FF"/>
    <path d="M15.998 26c5.523 0 10-4.477 10-10s-4.477-10-10-10c-5.28 0-9.608 4.099-9.969 9.286h13.192v1.428H6.029C6.39 21.901 10.718 26 15.998 26z" fill="#fff"/>
  </svg>
)

const OpbnbLogo = (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#1E2026"/>
    <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003 2.263-2.257zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002L16 13.706l-2.173 2.173-.02.02-.122.122.115.115L16 18.294l2.293-2.293.002-.002-.003-.001z" fill="#F3BA2F"/>
  </svg>
)

const SepoliaLogo = (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#627EEA"/>
    <path d="M16.498 4v8.87l7.497 3.35L16.498 4z" fill="#fff" fillOpacity=".6"/>
    <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/>
    <path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#fff" fillOpacity=".6"/>
    <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#fff"/>
    <path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#fff" fillOpacity=".2"/>
    <path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#fff" fillOpacity=".6"/>
  </svg>
)

export const NETWORK_LOGOS = {
  ethereum: EthereumLogo,
  bnb: BnbLogo,
  polygon: PolygonLogo,
  arbitrum: ArbitrumLogo,
  optimism: OptimismLogo,
  base: BaseLogo,
  opbnb: OpbnbLogo,
  sepolia: SepoliaLogo,
}
