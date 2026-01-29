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
let connectionType = null

export const isDesktop = () => {
  if (typeof window === 'undefined') return true
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export const isMobile = () => {
  if (typeof window === 'undefined') return false
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export const getInjectedProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum
  }
  return null
}

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
      showQrModal: false,
      methods: ['eth_sendTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
      events: ['chainChanged', 'accountsChanged'],
      metadata: {
        name: 'MultiSend',
        description: 'Send crypto to multiple wallets',
        url: typeof window !== 'undefined' ? window.location.origin : '',
        icons: [typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png']
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

export const connectWalletConnect = async () => {
  try {
    const { provider: wcProv, modal: wcMod } = await initWalletConnect()

    const uri = await new Promise((resolve) => {
      wcProv.on('display_uri', (uri) => {
        resolve(uri)
      })
      wcProv.enable()
    })

    await wcMod.openModal({ uri })

    return new Promise((resolve, reject) => {
      const handleConnect = (payload) => {
        wcProv.removeListener('connect', handleConnect)
        wcProv.removeListener('disconnect', handleDisconnect)
        currentProvider = wcProv
        connectionType = 'walletconnect'
        wcMod.closeModal()
        resolve(wcProv)
      }

      const handleDisconnect = () => {
        wcProv.removeListener('connect', handleConnect)
        wcProv.removeListener('disconnect', handleDisconnect)
        wcMod.closeModal()
        reject(new Error('Connection cancelled'))
      }

      wcProv.on('connect', handleConnect)
      wcProv.on('disconnect', handleDisconnect)

      setTimeout(() => {
        wcProv.removeListener('connect', handleConnect)
        wcProv.removeListener('disconnect', handleDisconnect)
        wcMod.closeModal()
        reject(new Error('Connection timeout'))
      }, 300000)
    })
  } catch (error) {
    console.error('WalletConnect connection failed:', error)
    throw error
  }
}

export const connectWallet = async () => {
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
    return await connectWalletConnect()
  }
}

export const disconnectWallet = async () => {
  try {
    if (wcModal) {
      try {
        wcModal.closeModal()
      } catch (e) {
        // ignore
      }
    }
    
    if (connectionType === 'walletconnect' && wcProvider) {
      await wcProvider.disconnect()
    }
    
    wcProvider = null
    wcModal = null
    currentProvider = null
    connectionType = null
  } catch (error) {
    console.error('Disconnect failed:', error)
    wcProvider = null
    wcModal = null
    currentProvider = null
    connectionType = null
  }
}

export const getProvider = () => {
  return currentProvider
}

export const getConnectionType = () => {
  return connectionType
}

export const isWalletConnected = () => {
  return currentProvider !== null
}
