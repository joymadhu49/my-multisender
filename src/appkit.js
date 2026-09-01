// Reown AppKit setup — replaces the deprecated @walletconnect/modal flow.
// createAppKit must run once, at module scope, OUTSIDE any React component.
import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { mainnet, bsc, base, polygon, arbitrum, optimism, opBNB, sepolia, solana, defineChain } from '@reown/appkit/networks'

// Reown / WalletConnect Cloud project id — sourced from the environment.
// Vite only exposes vars prefixed with VITE_ to the browser bundle.
// Set it in .env (see .env.example). Get a free id at https://dashboard.reown.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

if (!projectId) {
  console.error(
    '[AppKit] Missing VITE_WALLETCONNECT_PROJECT_ID — wallet connection will not work. ' +
    'Copy .env.example to .env and set your Reown project id (https://dashboard.reown.com).'
  )
}

// Robinhood Chain (Arbitrum Nitro L2 on Ethereum, native ETH).
//
// Defined locally rather than imported from '@reown/appkit/networks': AppKit
// re-exports viem/chains, and `robinhood` only landed in viem 2.56 — the
// version this project's lockfile resolves is older, so the import would be
// undefined at runtime and break AppKit init. Keep this local definition even
// after a viem bump unless you verify the export exists.
//
// Explorer is robinscan.io, not robinhoodchain.blockscout.com: Blockscout is
// TLS-blocked on some networks, robinscan resolves reliably (EIP-3091 paths).
export const robinhood = defineChain({
  id: 4663,
  caipNetworkId: 'eip155:4663',
  chainNamespace: 'eip155',
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        'https://rpc.mainnet.chain.robinhood.com',
        'https://robinhood-rpc.publicnode.com',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Robinscan', url: 'https://robinscan.io' },
  },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
})

// Order mirrors the app's NETWORKS / supported chains:
// Ethereum, BNB Chain, Base, Polygon, Arbitrum, Optimism, opBNB, Robinhood, Sepolia, Solana.
export const networks = [mainnet, bsc, base, polygon, arbitrum, optimism, opBNB, robinhood, sepolia, solana]

const metadata = {
  name: 'MultiSend',
  description: 'Send a native token or ERC20 to many wallets in a single transaction.',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://multisend.app',
  icons: [typeof window !== 'undefined' ? `${window.location.origin}/logo-header.png` : '/logo-header.png'],
}

// Single AppKit instance. Exported so the app can sync theme (setThemeMode).
export const appkit = createAppKit({
  // SolanaAdapter picks up Wallet Standard wallets (Phantom, Solflare, …)
  // automatically; WalletConnect-based Solana wallets come via the modal.
  adapters: [new EthersAdapter(), new SolanaAdapter()],
  networks,
  projectId,
  metadata,
  themeMode:
    typeof window !== 'undefined' && localStorage.getItem('theme') === 'light' ? 'light' : 'dark',
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
})
