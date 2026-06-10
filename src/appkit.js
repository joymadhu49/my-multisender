// Reown AppKit setup — replaces the deprecated @walletconnect/modal flow.
// createAppKit must run once, at module scope, OUTSIDE any React component.
import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, bsc, base, polygon, arbitrum, optimism, sepolia } from '@reown/appkit/networks'

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

// Order mirrors the app's NETWORK_CONFIG / supported chains:
// Ethereum, BNB Chain, Base, Polygon, Arbitrum, Optimism, Sepolia.
export const networks = [mainnet, bsc, base, polygon, arbitrum, optimism, sepolia]

const metadata = {
  name: 'MultiSend',
  description: 'Send a native token or ERC20 to many wallets in a single transaction.',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://multisend.app',
  icons: [typeof window !== 'undefined' ? `${window.location.origin}/logo-header.png` : '/logo-header.png'],
}

// Single AppKit instance. Exported so the app can sync theme (setThemeMode).
export const appkit = createAppKit({
  adapters: [new EthersAdapter()],
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
