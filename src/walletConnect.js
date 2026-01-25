import { EthereumProvider } from '@walletconnect/ethereum-provider'
import { WalletConnectModal } from '@walletconnect/modal'

const PROJECT_ID = 'e8d9c40f25d85750af37df5602084b4c'

const chains = [1, 56, 8453, 137, 42161, 10, 11155111]

const rpcMap = {
  1: 'https://eth.llamarpc.com',
  56: 'https://bsc-dataseed.binance.org',
  8453: 'https://mainnet.base.org',
  137: 'https://polygon-rpc.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  10: 'https://mainnet.optimism.io',
  11155111: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
}

let wcProvider = null
let wcModal = null
let currentProvider = null
let connectionType = null // 'injected' or 'walletconnect'

// Device detection
export const isDesktop = () => {
  if (typeof window === 'undefined') return true
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export const isIOS = () => {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

// Get injected provider (MetaMask, Brave, etc.)
export const getInjectedProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum
  }
  return null
}

// Initialize WalletConnect
export const initWalletConnect = async () => {
  if (wcProvider && wcModal) {
    return { provider: wcProvider, modal: wcModal }
  }

  try {
    wcProvider = await EthereumProvider.init({
      projectId: PROJECT_ID,
      chains: chains,
      rpcMap: rpcMap,
      optionalChains: chains,
      metadata: {
        name: 'MultiSend',
        description: 'Send crypto to multiple wallets',
        url: typeof window !== 'undefined' ? window.location.href : '',
        icons: ['/logo.png']
      }
    })

    wcModal = new WalletConnectModal({
      projectId: PROJECT_ID,
      themeMode: typeof window !== 'undefined' && localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
    })

    return { provider: wcProvider, modal: wcModal }
  } catch (error) {
    console.error('Failed to initialize WalletConnect:', error)
    throw error
  }
}

// Connect injected wallet (MetaMask, Brave, etc.) - PC
export const connectInjected = async () => {
  const injected = getInjectedProvider()
  if (!injected) {
    throw new Error('No injected wallet found. Please install MetaMask or use a Web3 browser.')
  }

  try {
    const accounts = await injected.request({
      method: 'eth_requestAccounts'
    })

    currentProvider = injected
    connectionType = 'injected'
    return injected
  } catch (error) {
    console.error('Injected wallet connection failed:', error)
    throw error
  }
}

// Connect WalletConnect - Mobile or desktop with QR
export const connectWalletConnect = async () => {
  try {
    const { provider: wcProv, modal: wcMod } = await initWalletConnect()

    // Open the modal
    await wcMod.openModal()

    // Wait for connection
    return new Promise((resolve, reject) => {
      const handleConnect = () => {
        wcProv?.removeEventListener('connect', handleConnect)
        wcProv?.removeEventListener('error', handleError)
        currentProvider = wcProv
        connectionType = 'walletconnect'
        resolve(wcProv)
      }

      const handleError = (error) => {
        wcProv?.removeEventListener('connect', handleConnect)
        wcProv?.removeEventListener('error', handleError)
        reject(error)
      }

      wcProv?.on('connect', handleConnect)
      wcProv?.on('error', handleError)

      // Timeout after 5 minutes
      setTimeout(() => {
        wcProv?.removeEventListener('connect', handleConnect)
        wcProv?.removeEventListener('error', handleError)
        reject(new Error('Connection timeout'))
      }, 300000)
    })
  } catch (error) {
    console.error('WalletConnect connection failed:', error)
    throw error
  }
}

// Unified connect function - auto-detects and routes appropriately
export const connectWallet = async () => {
  // On desktop: try injected first, fallback to WalletConnect
  // On mobile: use WalletConnect
  
  if (isDesktop()) {
    const injected = getInjectedProvider()
    if (injected) {
      try {
        return await connectInjected()
      } catch (error) {
        console.warn('Injected wallet failed, trying WalletConnect:', error.message)
        return await connectWalletConnect()
      }
    }
    return await connectWalletConnect()
  } else {
    // Mobile: use WalletConnect
    return await connectWalletConnect()
  }
}

// Disconnect wallet
export const disconnectWallet = async () => {
  try {
    // Close the modal if it's open
    if (wcModal) {
      try {
        wcModal.closeModal()
      } catch (e) {
        // Modal might not have closeModal method, ignore
      }
    }
    
    if (connectionType === 'walletconnect' && wcProvider) {
      await wcProvider.disconnect()
    }
    
    // Reset WalletConnect instances so they can be re-initialized
    wcProvider = null
    wcModal = null
    currentProvider = null
    connectionType = null
  } catch (error) {
    console.error('Disconnect failed:', error)
    // Force cleanup even if disconnect fails
    wcProvider = null
    wcModal = null
    currentProvider = null
    connectionType = null
  }
}

// Get current provider
export const getProvider = () => {
  return currentProvider
}

// Get connection type
export const getConnectionType = () => {
  return connectionType
}

// Check if wallet is connected
export const isWalletConnected = () => {
  return currentProvider !== null
}
