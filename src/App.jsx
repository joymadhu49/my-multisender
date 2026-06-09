import { useState, useEffect, useCallback, useRef } from 'react'
import { ethers } from 'ethers'
import { MULTISENDER_ADDRESSES, SUPPORTED_CHAINS, getContractAddress, MULTISENDER_ABI, ERC20_ABI } from './contract'
import { getNativePrice, getTokenPrice } from './priceApi'
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from '@reown/appkit/react'
import { appkit } from './appkit'
import SummaryBar from './components/SummaryBar'
import ModeSelector from './components/ModeSelector'
import RecipientInput from './components/RecipientInput'
import ApprovalCard from './components/ApprovalCard'

// Parse blockchain errors into user-friendly messages
const parseError = (err) => {
  const message = err?.message || err?.reason || String(err)

  // User rejected transaction
  if (err?.code === 'ACTION_REJECTED' || message.includes('user rejected') || message.includes('User rejected') || err?.info?.error?.code === 4001) {
    return 'Transaction cancelled'
  }

  // Insufficient funds
  if (message.includes('insufficient funds') || message.includes('Insufficient funds')) {
    return 'Insufficient funds for gas fees'
  }

  // Gas estimation failed
  if (message.includes('cannot estimate gas') || message.includes('gas required exceeds')) {
    return 'Transaction would fail - check your balance and inputs'
  }

  // Allowance/approval issues
  if (message.includes('allowance') || message.includes('ERC20: insufficient allowance')) {
    return 'Token approval required - please approve first'
  }

  // Transfer failed
  if (message.includes('transfer amount exceeds balance')) {
    return 'Insufficient token balance'
  }

  // Network issues
  if (message.includes('network') || message.includes('disconnected')) {
    return 'Network error - please check your connection'
  }

  // Contract errors
  if (message.includes('No recipients')) {
    return 'Please add at least one recipient'
  }
  if (message.includes('Length mismatch')) {
    return 'Recipients and amounts count mismatch'
  }
  if (message.includes('Incorrect ETH value')) {
    return 'ETH amount calculation error'
  }

  // Default: return a cleaned up message
  if (message.length > 100) {
    return 'Transaction failed - please try again'
  }
  return message
}

function App() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(null)
  const [network, setNetwork] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [activeTab, setActiveTab] = useState('native')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showNetworkSwitcher, setShowNetworkSwitcher] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  // Whether the visitor has entered the app (send console) without yet connecting a wallet.
  // Lets users explore and build a batch in a preview state; connecting is required only at send time.
  const [entered, setEntered] = useState(false)

  // FAQ toggle
  const [openFaq, setOpenFaq] = useState(null)

  // Live stats
  const [liveStats, setLiveStats] = useState({ totalTx: 0, totalEth: 0 })

  // Price data
  const [ethPrice, setEthPrice] = useState(null)
  const [tokenPrice, setTokenPrice] = useState(null)

  // Send mode: 'same' or 'custom'
  const [sendMode, setSendMode] = useState('same')

  // Native token form
  const [recipients, setRecipients] = useState('')
  const [sameAmount, setSameAmount] = useState('')
  const [useUsd, setUseUsd] = useState(false)

  // ERC20 form
  const [tokenAddress, setTokenAddress] = useState('')
  const [tokenInfo, setTokenInfo] = useState(null)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [approving, setApproving] = useState(false)

  // Quick add
  const [quickAddAddress, setQuickAddAddress] = useState('')
  const [quickAddAmount, setQuickAddAmount] = useState('')

  // Confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingTx, setPendingTx] = useState(null)

  // Parse warnings (invalid addresses, duplicates)
  const [parseWarnings, setParseWarnings] = useState({ invalid: 0, duplicates: 0 })

  // ── Reown AppKit wallet state (replaces the old WalletConnect provider plumbing) ──
  const { open: openAppKit } = useAppKit()
  const { address: akAddress, isConnected: akIsConnected } = useAppKitAccount()
  const { chainId: akChainId } = useAppKitNetwork()
  const { walletProvider } = useAppKitProvider('eip155')
  const { disconnect: akDisconnect } = useDisconnect()

  // Keep the latest EIP-1193 provider in a ref so the imperative helpers (send,
  // approve, balance, network switch) can keep using the same getProvider() pattern.
  const providerRef = useRef(null)
  const getProvider = () => providerRef.current

  // Network logos as inline SVGs
  const NetworkLogos = {
    ethereum: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#627EEA"/>
        <path d="M16.498 4v8.87l7.497 3.35L16.498 4z" fill="#fff" fillOpacity=".6"/>
        <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/>
        <path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#fff" fillOpacity=".6"/>
        <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#fff"/>
        <path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#fff" fillOpacity=".2"/>
        <path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#fff" fillOpacity=".6"/>
      </svg>
    ),
    bnb: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#F3BA2F"/>
        <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003 2.263-2.257zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002L16 13.706l-2.173 2.173-.02.02-.122.122.115.115L16 18.294l2.293-2.293.002-.002-.003-.001z" fill="#fff"/>
      </svg>
    ),
    polygon: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#8247E5"/>
        <path d="M21.092 12.693c-.369-.215-.848-.215-1.254 0l-2.879 1.654-1.955 1.078-2.879 1.653c-.369.216-.848.216-1.254 0l-2.288-1.294c-.369-.215-.627-.61-.627-1.042V12.19c0-.431.221-.826.627-1.042l2.25-1.258c.37-.216.85-.216 1.256 0l2.25 1.258c.37.216.628.611.628 1.042v1.654l1.955-1.115v-1.653a1.16 1.16 0 00-.627-1.042l-4.17-2.372c-.369-.216-.848-.216-1.254 0l-4.244 2.372A1.16 1.16 0 006 11.076v4.78c0 .432.221.827.627 1.043l4.244 2.372c.369.215.849.215 1.254 0l2.879-1.618 1.955-1.114 2.879-1.617c.369-.216.848-.216 1.254 0l2.251 1.258c.37.215.627.61.627 1.042v2.552c0 .431-.22.826-.627 1.042l-2.25 1.294c-.37.216-.85.216-1.255 0l-2.251-1.258c-.37-.216-.628-.611-.628-1.042v-1.654l-1.955 1.115v1.653c0 .431.221.827.627 1.042l4.244 2.372c.369.216.848.216 1.254 0l4.244-2.372c.369-.215.627-.61.627-1.042v-4.78a1.16 1.16 0 00-.627-1.042l-4.28-2.409z" fill="#fff"/>
      </svg>
    ),
    arbitrum: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#213147"/>
        <path d="M16.62 21.54l1.14 3.13.93-.34-1.4-3.86-.67 1.07zm4.86-7.31l-3.41 5.44 1.27 3.49 4.54-7.24-2.4-1.69zm-7.57 5.57l-.85 1.35 1.4 3.87.93-.34-1.48-4.88zm1.76-2.82l2.26-3.6-1.28-3.52-3.93 6.27 2.95.85zm6.27-4.51l-2.59 4.13 2.19.63 2.48-3.96-2.08-.8zM16 6l-6.46 10.31 2.27.65L16 10.15l4.19 6.81 2.27-.65L16 6z" fill="#fff"/>
        <path d="M16 6l-6.46 10.31 2.27.65L16 10.15l4.19 6.81 2.27-.65L16 6z" fill="#9DCCED"/>
        <path d="M9.54 16.31L7 21.37l2.08.8 2.59-4.14-2.13-1.72z" fill="#fff"/>
        <path d="M11.67 17.16l-2.59 4.14.93.34 1.4-3.86-.85-1.35.11.73z" fill="#9DCCED"/>
      </svg>
    ),
    optimism: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#FF0420"/>
        <circle cx="12" cy="16" r="4" fill="#fff"/>
        <circle cx="12" cy="16" r="2" fill="#FF0420"/>
        <path d="M18 12h2.5c1.93 0 3.5 1.57 3.5 3.5v0c0 1.93-1.57 3.5-3.5 3.5H18v-7z" fill="#fff"/>
      </svg>
    ),
    base: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#0052FF"/>
        <path d="M15.998 26c5.523 0 10-4.477 10-10s-4.477-10-10-10c-5.28 0-9.608 4.099-9.969 9.286h13.192v1.428H6.029C6.39 21.901 10.718 26 15.998 26z" fill="#fff"/>
      </svg>
    ),
    sepolia: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#627EEA"/>
        <path d="M16.498 4v8.87l7.497 3.35L16.498 4z" fill="#fff" fillOpacity=".6"/>
        <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/>
        <path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#fff" fillOpacity=".6"/>
        <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#fff"/>
        <path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#fff" fillOpacity=".2"/>
        <path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#fff" fillOpacity=".6"/>
        <text x="16" y="18" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="bold">T</text>
      </svg>
    ),
  }

  // Network configurations
  const NETWORK_CONFIG = {
    1: { name: 'Ethereum', symbol: 'ETH', explorer: 'https://etherscan.io', coingeckoId: 'ethereum', logo: 'ethereum' },
    56: { name: 'BNB Chain', symbol: 'BNB', explorer: 'https://bscscan.com', coingeckoId: 'binancecoin', logo: 'bnb' },
    8453: { name: 'Base', symbol: 'ETH', explorer: 'https://basescan.org', coingeckoId: 'ethereum', logo: 'base' },
    137: { name: 'Polygon', symbol: 'POL', explorer: 'https://polygonscan.com', coingeckoId: 'polygon-ecosystem-token', logo: 'polygon' },
    42161: { name: 'Arbitrum', symbol: 'ETH', explorer: 'https://arbiscan.io', coingeckoId: 'ethereum', logo: 'arbitrum' },
    10: { name: 'Optimism', symbol: 'ETH', explorer: 'https://optimistic.etherscan.io', coingeckoId: 'ethereum', logo: 'optimism' },
    11155111: { name: 'Sepolia', symbol: 'ETH', explorer: 'https://sepolia.etherscan.io', coingeckoId: 'ethereum', logo: 'sepolia' },
  }

  // Function to reset all app state when wallet disconnects
  const clearAllState = () => {
    setAccount(null)
    setBalance(null)
    setNetwork(null)
    setChainId(null)
    setActiveTab('native')
    setTokenAddress('')
    setTokenInfo(null)
    setRecipients('')
    setSameAmount('')
    setError(null)
    setSuccess(null)
    setTokenPrice(null)
    setEthPrice(null)
    setNeedsApproval(false)
    setApproving(false)
    setQuickAddAddress('')
    setQuickAddAmount('')
    setShowNetworkSwitcher(false)
    setPendingTx(null)
    setShowConfirmation(false)
    setUseUsd(false)
    setSendMode('same')
    setParseWarnings({ invalid: 0, duplicates: 0 })
  }

  const getCurrentNetworkConfig = () => NETWORK_CONFIG[Number(chainId)] || { name: 'Unknown', symbol: 'ETH', explorer: 'https://etherscan.io', coingeckoId: 'ethereum' }
  const getCurrentContractAddress = () => getContractAddress(chainId)
  const isNetworkSupported = () => chainId !== null && SUPPORTED_CHAINS.includes(Number(chainId))

  // Theme toggle function
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  // Apply theme to body + keep the AppKit modal in sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { appkit?.setThemeMode?.(theme) } catch (e) { /* noop */ }
  }, [theme])

  // Fetch live stats from Etherscan (Ethereum mainnet contract)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const contractAddr = '0x33b82Ad6f62332D6359e582b642466591A6a9DDA'
        const resp = await fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${contractAddr}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=YourApiKeyToken`)
        const data = await resp.json()
        if (data.status === '1' && data.result) {
          const txs = data.result.filter(tx => tx.to?.toLowerCase() === contractAddr.toLowerCase())
          const totalEth = txs.reduce((sum, tx) => sum + parseFloat(tx.value || 0) / 1e18, 0)
          setLiveStats({ totalTx: txs.length, totalEth: Math.round(totalEth * 100) / 100 })
        }
      } catch (e) {
        // Fallback stats if API fails
        setLiveStats({ totalTx: 142, totalEth: 28.5 })
      }
    }
    fetchStats()
  }, [])

  // Keep the provider ref in sync with AppKit's current wallet provider.
  // Declared first so providerRef is set before the balance effect runs.
  useEffect(() => {
    providerRef.current = walletProvider || null
  }, [walletProvider])

  // Sync the connected account from AppKit.
  useEffect(() => {
    if (akIsConnected && akAddress) {
      setAccount(akAddress)
    } else {
      setAccount(null)
      setBalance(null)
    }
  }, [akIsConnected, akAddress])

  // Sync the active network from AppKit.
  useEffect(() => {
    if (akChainId) {
      const id = Number(akChainId)
      setChainId(id)
      const config = NETWORK_CONFIG[id]
      setNetwork(config?.name || `Chain ${id}`)
    } else {
      setChainId(null)
      setNetwork(null)
    }
  }, [akChainId])

  // Refresh balance whenever the account, network, or provider changes.
  useEffect(() => {
    if (akIsConnected && akAddress && walletProvider) {
      updateBalance(akAddress)
    }
  }, [akIsConnected, akAddress, akChainId, walletProvider])

  // Fetch native token price when chainId changes
  useEffect(() => {
    if (chainId) {
      fetchNativePrice(chainId)
      // Clear old token price and info when switching networks
      setTokenPrice(null)
      setTokenInfo(null)
    }
  }, [chainId])

  // Lock body scroll + close on Escape when modal open
  useEffect(() => {
    if (!showConfirmation && !showNetworkSwitcher) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (showConfirmation) setShowConfirmation(false)
        if (showNetworkSwitcher) setShowNetworkSwitcher(false)
      }
    }
    if (showConfirmation) {
      document.body.style.overflow = 'hidden'
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [showConfirmation, showNetworkSwitcher])

  const fetchNativePrice = async (networkChainId) => {
    try {
      const config = NETWORK_CONFIG[Number(networkChainId)] || { coingeckoId: 'ethereum' }
      const price = await getNativePrice(config.coingeckoId)
      setEthPrice(price)
    } catch (err) {
      console.error('Failed to fetch native token price:', err)
    }
  }

  const fetchTokenPrice = async (address) => {
    try {
      const price = await getTokenPrice(address, chainId)
      setTokenPrice(price)
    } catch (err) {
      console.error('Failed to fetch token price:', err)
      setTokenPrice(null)
    }
  }

  const updateBalance = async (address) => {
    const wcProvider = getProvider()
    if (!wcProvider) return
    const provider = new ethers.BrowserProvider(wcProvider)
    const bal = await provider.getBalance(address)
    setBalance(ethers.formatEther(bal))
  }

  const updateNetwork = async () => {
    try {
      const wcProvider = getProvider()
      if (!wcProvider) {
        console.warn('No provider available')
        return
      }
      const provider = new ethers.BrowserProvider(wcProvider)
      const net = await provider.getNetwork()
      setChainId(net.chainId)
      const config = NETWORK_CONFIG[Number(net.chainId)]
      setNetwork(config?.name || `Chain ${net.chainId}`)
    } catch (err) {
      console.error('Failed to update network:', err)
    }
  }

  const handleConnectWallet = async () => {
    // Opens the Reown AppKit modal; account/network/provider then flow in via
    // the AppKit sync effects above. AppKit renders its own connecting UI.
    try {
      setError(null)
      await openAppKit()
    } catch (err) {
      setError(parseError(err))
    }
  }

  const handleDisconnectWallet = async () => {
    try {
      await akDisconnect()
    } catch (err) {
      console.error('Error disconnecting wallet:', err)
    } finally {
      // Always clear all state, regardless of disconnect success
      // This ensures the UI shows login screen even if disconnect partially fails
      clearAllState()
      // Return the user to the landing page on disconnect (clearer mental model)
      setEntered(false)
    }
  }

  const switchNetwork = async (targetChainId) => {
    const chainHex = '0x' + targetChainId.toString(16)
    try {
      const wcProvider = getProvider()
      if (!wcProvider) {
        setError('Wallet not connected')
        return
      }

      await wcProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainHex }],
      })

      // Update state after successful switch
      await updateNetwork()
      // Update balance for the new network
      if (account) {
        await updateBalance(account)
      }
      setShowNetworkSwitcher(false)
      setError(null)
    } catch (err) {
      // Network not added - try to add it
      if (err.code === 4902) {
        try {
          const wcProvider = getProvider()
          const networkParams = {
            1: { chainName: 'Ethereum Mainnet', rpcUrls: ['https://eth.llamarpc.com'], nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://etherscan.io'] },
            56: { chainName: 'BNB Smart Chain', rpcUrls: ['https://bsc-dataseed.binance.org'], nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, blockExplorerUrls: ['https://bscscan.com'] },
            8453: { chainName: 'Base', rpcUrls: ['https://mainnet.base.org'], nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://basescan.org'] },
            137: { chainName: 'Polygon', rpcUrls: ['https://polygon-rpc.com'], nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, blockExplorerUrls: ['https://polygonscan.com'] },
            42161: { chainName: 'Arbitrum One', rpcUrls: ['https://arb1.arbitrum.io/rpc'], nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://arbiscan.io'] },
            10: { chainName: 'Optimism', rpcUrls: ['https://mainnet.optimism.io'], nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://optimistic.etherscan.io'] },
            11155111: { chainName: 'Sepolia', rpcUrls: ['https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'], nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://sepolia.etherscan.io'] },
          }
          const params = networkParams[targetChainId]
          if (params) {
            await wcProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{ chainId: chainHex, ...params }],
            })
            // Update state after adding network
            await updateNetwork()
            // Update balance for the new network
            if (account) {
              await updateBalance(account)
            }
            setShowNetworkSwitcher(false)
            setError(null)
          }
        } catch (addErr) {
          setError('Failed to add network')
          console.error(addErr)
        }
      } else {
        setError(err.message || 'Failed to switch network')
        console.error(err)
      }
    }
  }

  // Parse addresses only (for same amount mode) - with validation tracking
  const parseAddresses = (text, trackWarnings = false) => {
    if (!text.trim()) {
      if (trackWarnings) setParseWarnings({ invalid: 0, duplicates: 0 })
      return []
    }
    const lines = text.trim().split('\n').filter(line => line.trim())
    const addresses = []
    const seen = new Set()
    let invalidCount = 0
    let duplicateCount = 0

    for (const line of lines) {
      const address = line.split(/[,\s\t]+/)[0].trim()
      if (address) {
        if (ethers.isAddress(address)) {
          const normalized = address.toLowerCase()
          if (seen.has(normalized)) {
            duplicateCount++
          } else {
            seen.add(normalized)
            addresses.push(address)
          }
        } else {
          invalidCount++
        }
      }
    }

    if (trackWarnings) {
      setParseWarnings({ invalid: invalidCount, duplicates: duplicateCount })
    }
    return addresses
  }

  // Parse addresses with custom amounts - with validation tracking
  const parseRecipientsWithAmounts = (text, trackWarnings = false) => {
    if (!text.trim()) {
      if (trackWarnings) setParseWarnings({ invalid: 0, duplicates: 0 })
      return { recipients: [], amounts: [] }
    }
    const lines = text.trim().split('\n').filter(line => line.trim())
    const recipients = []
    const amounts = []
    const seen = new Set()
    let invalidCount = 0
    let duplicateCount = 0

    for (const line of lines) {
      const parts = line.split(/[,\s\t]+/).map(p => p.trim()).filter(p => p)
      if (parts.length >= 2) {
        if (ethers.isAddress(parts[0])) {
          const amount = parseFloat(parts[1].replace('$', ''))
          if (!isNaN(amount) && amount > 0) {
            const normalized = parts[0].toLowerCase()
            if (seen.has(normalized)) {
              duplicateCount++
            } else {
              seen.add(normalized)
              recipients.push(parts[0])
              amounts.push(parts[1].replace('$', ''))
            }
          } else {
            invalidCount++ // Invalid amount
          }
        } else {
          invalidCount++ // Invalid address
        }
      } else if (parts.length === 1 && parts[0]) {
        invalidCount++ // Missing amount
      }
    }

    if (trackWarnings) {
      setParseWarnings({ invalid: invalidCount, duplicates: duplicateCount })
    }
    return { recipients, amounts }
  }

  const getRecipientsAndAmounts = () => {
    if (sendMode === 'same') {
      const addresses = parseAddresses(recipients, false)
      let amount = parseFloat(sameAmount) || 0

      // Convert USD to crypto if needed
      if (useUsd && activeTab === 'native' && ethPrice) {
        amount = amount / ethPrice
      } else if (useUsd && activeTab === 'erc20' && tokenPrice) {
        amount = amount / tokenPrice
      }

      return {
        recipients: addresses,
        amounts: addresses.map(() => amount.toString())
      }
    } else {
      const parsed = parseRecipientsWithAmounts(recipients, false)

      if (useUsd) {
        const price = activeTab === 'native' ? ethPrice : tokenPrice
        if (price) {
          parsed.amounts = parsed.amounts.map(a => (parseFloat(a) / price).toString())
        }
      }

      return parsed
    }
  }

  // Update parse warnings when recipients text changes
  useEffect(() => {
    if (sendMode === 'same') {
      parseAddresses(recipients, true)
    } else {
      parseRecipientsWithAmounts(recipients, true)
    }
  }, [recipients, sendMode])

  const getTotalAmount = () => {
    const { amounts } = getRecipientsAndAmounts()
    return amounts.reduce((sum, a) => sum + parseFloat(a || 0), 0)
  }

  const getRecipientCount = () => {
    if (sendMode === 'same') {
      return parseAddresses(recipients).length
    }
    return parseRecipientsWithAmounts(recipients).recipients.length
  }

  const addQuickRecipient = () => {
    if (!quickAddAddress || !ethers.isAddress(quickAddAddress)) return
    if (sendMode === 'custom') {
      const amount = parseFloat(quickAddAmount)
      if (!quickAddAmount || Number.isNaN(amount) || amount <= 0) return
    }

    let newLine = quickAddAddress
    if (sendMode === 'custom' && quickAddAmount) {
      newLine += `, ${quickAddAmount}`
    }

    setRecipients(prev => prev ? `${prev}\n${newLine}` : newLine)
    setQuickAddAddress('')
    setQuickAddAmount('')
  }

  const clearAll = () => {
    setRecipients('')
    setSameAmount('')
    setQuickAddAddress('')
    setQuickAddAmount('')
    setParseWarnings({ invalid: 0, duplicates: 0 })
    setError(null)
    setSuccess(null)
  }

  const verifyContract = async (provider) => {
    const contractAddress = getCurrentContractAddress()
    if (!contractAddress) {
      throw new Error('Contract not deployed on this network yet.')
    }
    const code = await provider.getCode(contractAddress)
    if (code === '0x' || code === '0x0') {
      throw new Error('Contract not found on this network.')
    }
    return contractAddress
  }

  // Show confirmation before sending native token
  const confirmSendNative = () => {
    const { recipients: addrs, amounts } = getRecipientsAndAmounts()
    if (addrs.length === 0) {
      setError('No valid recipients')
      return
    }
    const total = amounts.reduce((sum, a) => sum + parseFloat(a || 0), 0)
    setPendingTx({
      type: 'native',
      recipients: addrs,
      amounts,
      total,
      symbol: nativeSymbol,
      usdTotal: ethPrice ? total * ethPrice : null
    })
    setShowConfirmation(true)
  }

  const sendNative = async () => {
    try {
      setShowConfirmation(false)
      setLoading(true)
      setError(null)
      setSuccess(null)

      const { recipients: addrs, amounts } = getRecipientsAndAmounts()

      if (addrs.length === 0) {
        throw new Error('No valid recipients')
      }

      const wcProvider = getProvider()
      const provider = new ethers.BrowserProvider(wcProvider)
      const contractAddress = await verifyContract(provider)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, MULTISENDER_ABI, signer)

      const amountsInWei = amounts.map(a => ethers.parseEther(parseFloat(a).toFixed(18)))
      const totalWei = amountsInWei.reduce((sum, amt) => sum + amt, 0n)

      const tx = await contract.sendNative(addrs, amountsInWei, { value: totalWei })
      setSuccess({ message: 'Transaction submitted...', hash: tx.hash })

      await tx.wait()
      setSuccess({ message: 'Transaction confirmed!', hash: tx.hash, total: totalAmount, symbol: nativeSymbol, count: addrs.length })
      await updateBalance(account)

    } catch (err) {
      console.error(err)
      setError(parseError(err))
    } finally {
      setLoading(false)
      setPendingTx(null)
    }
  }

  const loadTokenInfo = async () => {
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      setTokenInfo(null)
      setTokenPrice(null)
      return
    }

     try {
       const wcProvider = getProvider()
       const provider = new ethers.BrowserProvider(wcProvider)
       const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)

       const [name, symbol, decimals, userBalance] = await Promise.all([
         token.name(),
         token.symbol(),
         token.decimals(),
         token.balanceOf(account)
       ])

       setTokenInfo({
         name,
         symbol,
         decimals: Number(decimals),
         balance: ethers.formatUnits(userBalance, decimals)
       })

       // Fetch price - won't throw even if unavailable
       fetchTokenPrice(tokenAddress)
     } catch (err) {
       console.error('Failed to load token info:', err)
       setTokenInfo(null)
       setTokenPrice(null)
     }
  }

  useEffect(() => {
    if (account && tokenAddress) {
      loadTokenInfo()
    }
  }, [tokenAddress, account])

  const checkAllowance = async () => {
    if (!tokenAddress || !tokenInfo) return

    const contractAddress = getCurrentContractAddress()
    if (!contractAddress) return

    const { amounts } = getRecipientsAndAmounts()
    if (amounts.length === 0) return

     const total = amounts.reduce((sum, amt) => sum + parseFloat(amt), 0)
     const totalInUnits = ethers.parseUnits(total.toFixed(tokenInfo.decimals), tokenInfo.decimals)

     const wcProvider = getProvider()
     const provider = new ethers.BrowserProvider(wcProvider)
     const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const allowance = await token.allowance(account, contractAddress)

    setNeedsApproval(allowance < totalInUnits)
  }

  useEffect(() => {
    if (tokenInfo && recipients) {
      checkAllowance()
    }
  }, [recipients, tokenInfo, sameAmount, sendMode, useUsd])

  const approveToken = async () => {
    try {
      setApproving(true)
      setError(null)

      const contractAddress = getCurrentContractAddress()
      if (!contractAddress) {
        throw new Error('Contract not deployed on this network')
      }

       const wcProvider = getProvider()
       const provider = new ethers.BrowserProvider(wcProvider)
       const signer = await provider.getSigner()
       const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer)

       const tx = await token.approve(contractAddress, ethers.MaxUint256)
       await tx.wait()

       setNeedsApproval(false)
     } catch (err) {
       setError(parseError(err))
    } finally {
      setApproving(false)
    }
  }

  // Show confirmation before sending ERC20 token
  const confirmSendERC20 = () => {
    const { recipients: addrs, amounts } = getRecipientsAndAmounts()
    if (addrs.length === 0) {
      setError('No valid recipients')
      return
    }
    const total = amounts.reduce((sum, a) => sum + parseFloat(a || 0), 0)
    setPendingTx({
      type: 'erc20',
      recipients: addrs,
      amounts,
      total,
      symbol: tokenInfo?.symbol || 'tokens',
      usdTotal: tokenPrice ? total * tokenPrice : null
    })
    setShowConfirmation(true)
  }

  const sendERC20 = async () => {
    try {
      setShowConfirmation(false)
      setLoading(true)
      setError(null)
      setSuccess(null)

      const { recipients: addrs, amounts } = getRecipientsAndAmounts()

      if (addrs.length === 0) {
        throw new Error('No valid recipients')
      }

      const wcProvider = getProvider()
      const provider = new ethers.BrowserProvider(wcProvider)
      const contractAddress = await verifyContract(provider)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, MULTISENDER_ABI, signer)

      const amountsInUnits = amounts.map(a =>
        ethers.parseUnits(parseFloat(a).toFixed(tokenInfo.decimals), tokenInfo.decimals)
      )

      const tx = await contract.sendERC20(tokenAddress, addrs, amountsInUnits)
      setSuccess({ message: 'Transaction submitted...', hash: tx.hash })

      await tx.wait()
      setSuccess({ message: 'Transaction confirmed!', hash: tx.hash, total: totalAmount, symbol: tokenInfo?.symbol, count: addrs.length })
      await loadTokenInfo()

    } catch (err) {
      console.error(err)
      setError(parseError(err))
    } finally {
      setLoading(false)
      setPendingTx(null)
    }
  }

  const networkConfig = getCurrentNetworkConfig()
  const contractAddress = getCurrentContractAddress()
  const isUnsupportedNetwork = chainId !== null && !isNetworkSupported()
  const recipientCount = getRecipientCount()
  const totalAmount = getTotalAmount()
  const nativeSymbol = networkConfig.symbol
  const symbol = activeTab === 'native' ? nativeSymbol : (tokenInfo?.symbol || 'tokens')
  const price = activeTab === 'native' ? ethPrice : tokenPrice
  const explorerUrl = networkConfig.explorer
  const isQuickAddDisabled = !quickAddAddress || !ethers.isAddress(quickAddAddress) || (sendMode === 'custom' && (!quickAddAmount || Number(quickAddAmount) <= 0))
  const heroStats = [
    { value: `${liveStats.totalTx || 142}+`, label: 'Batched transfers' },
    { value: `${liveStats.totalEth || 28.5}+`, label: 'Native tokens sent' },
    { value: '7', label: 'Deployments live' },
    { value: '0%', label: 'Platform fee' },
  ]
  const workflowSteps = [
    {
      step: '01',
      title: 'Connect and pick an asset',
      description: 'Bring in your wallet, choose the active network, and decide between native token or ERC20 payouts.',
    },
    {
      step: '02',
      title: 'Paste recipients or build them inline',
      description: 'Use one address per line for equal payouts or address + amount pairs for custom distribution.',
    },
    {
      step: '03',
      title: 'Review totals and send once',
      description: 'See approval state, recipient count, total value, and explorer details before submitting one transaction.',
    },
  ]
  const featureCards = [
    {
      title: 'Review-first sending flow',
      description: 'The app keeps totals, warnings, approval state, and send actions in one place so you do not bounce between panels.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
      ),
    },
    {
      title: 'Native and ERC20 support',
      description: 'Switch between network currency payouts and token distributions without losing your current recipient list.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
        </svg>
      ),
    },
    {
      title: 'Paste-friendly input',
      description: 'Handle bulk imports from spreadsheets, quick-add one-offs inline, and ignore duplicates before signing.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
          <rect x="8" y="2" width="8" height="4" rx="1"/>
          <path d="M9 12h6M9 16h4"/>
        </svg>
      ),
    },
    {
      title: 'Explorer visibility',
      description: 'Jump straight to the active contract and confirmed transaction from the same dashboard session.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
          <path d="M15 3h6v6"/><path d="M10 14L21 3"/>
        </svg>
      ),
    },
  ]
  const faqItems = [
    { q: 'What is MultiSend?', a: 'MultiSend is a smart contract tool that lets you send a native token or ERC20 asset to many wallet addresses in a single blockchain transaction.' },
    { q: 'How much gas can it save?', a: 'Batching transfers usually costs much less than sending each transfer manually. Savings grow as the recipient list gets larger.' },
    { q: 'Is it custodial?', a: 'No. You sign from your own wallet and funds move directly to recipients through the deployed contract.' },
    { q: 'Which networks are supported?', a: 'The app supports Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, and Sepolia.' },
  ]
  const checklistItems = [
    'Double-check the recipient list after pasting.',
    'Use the approval step only when sending ERC20 tokens.',
    'Review the confirmation modal before signing.',
  ]

   return (
     <div className="app">


      {/* Header */}
      <header className="header">
        <div className="header-inner">
        <a
          href="/"
          className="logo"
          onClick={(e) => {
            if (!account) {
              e.preventDefault()
              setEntered(false)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          }}
          aria-label="MultiSend home"
        >
          <img src="/logo.png" alt="" className="logo-img" />
          <span>MultiSend</span>
        </a>
        <div className="header-right">
          {/* Theme Toggle Button */}
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 1v2M12 21v2M23 12h-2M3 12H1M20.5 20.5l-1.4-1.4M4.9 4.9L3.5 3.5M20.5 3.5l-1.4 1.4M4.9 19.1L3.5 20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          {account && (
            <>
              <div className="network-switcher">
                <button
                  className="network-switcher-btn"
                  onClick={() => setShowNetworkSwitcher(!showNetworkSwitcher)}
                  aria-haspopup="listbox"
                  aria-expanded={showNetworkSwitcher}
                  aria-label={`Network: ${network}. Click to switch.`}
                >
                  <span className="network-btn-logo">
                    {NetworkLogos[networkConfig.logo] || <span className="network-dot"></span>}
                  </span>
                  <span className="network-name">{network}</span>
                  <svg className={`network-chevron ${showNetworkSwitcher ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {showNetworkSwitcher && (
                  <>
                    <div className="network-switcher-backdrop" onClick={() => setShowNetworkSwitcher(false)}></div>
                    <div className="network-switcher-dropdown">
                      <div className="network-switcher-title">Switch Network</div>
                      {Object.entries(NETWORK_CONFIG).map(([id, config]) => (
                        <button
                           key={id}
                           className={`network-option ${Number(chainId) === Number(id) ? 'active' : ''}`}
                           onClick={async () => {
                             await switchNetwork(Number(id))
                           }}
                         >
                          <span className="network-option-icon">
                            {NetworkLogos[config.logo]}
                          </span>
                          <span className="network-option-name">{config.name}</span>
                          {Number(chainId) === Number(id) && <span className="network-check">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
               <button className="wallet-pill" onClick={handleDisconnectWallet} title="Disconnect wallet">
                 <div className="wallet-status"></div>
                 <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
               </button>
            </>
          )}
          {!account && (
            <button className="header-connect" onClick={handleConnectWallet} disabled={loading}>
              {loading ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
        </div>
      </header>

      <main className="main">
        {!account && !entered ? (
          <div className="homepage">
            <section className="hero hero-grid">
              <div className="hero-copy">
                <div className="hero-badge">Multi-chain · Non-custodial</div>
                <h1 className="hero-title">
                  Send to many wallets in <span className="hero-highlight">one transaction</span>.
                </h1>
                <p className="hero-subtitle">
                  Batch native and ERC20 payouts across seven networks. Connect, paste, send.
                </p>
                <div className="hero-actions">
                  <button className="btn-hero" onClick={() => setEntered(true)}>
                    Launch App
                  </button>
                  <button className="btn-secondary" onClick={handleConnectWallet} disabled={loading}>
                    {loading ? 'Connecting…' : 'Connect wallet'}
                  </button>
                </div>
                <p className="hero-actions-note">No wallet needed to explore — connect only when you send.</p>

                <div className="hero-stats">
                  {heroStats.map((stat) => (
                    <div className="hero-stat" key={stat.label}>
                      <span className="hero-stat-value">{stat.value}</span>
                      <span className="hero-stat-label">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hero-preview">
                <div className="preview-window">
                  <div className="preview-metrics">
                    <div className="preview-metric">
                      <span className="preview-metric-label">Recipients</span>
                      <strong>184</strong>
                    </div>
                    <div className="preview-metric">
                      <span className="preview-metric-label">Total</span>
                      <strong>14.32 ETH</strong>
                    </div>
                  </div>

                  <div className="preview-list">
                    <div className="preview-row">
                      <span className="preview-address">0x742d...5bE91</span>
                      <span className="preview-amount">0.125 ETH</span>
                    </div>
                    <div className="preview-row">
                      <span className="preview-address">0xAb58...eC9B</span>
                      <span className="preview-amount">0.125 ETH</span>
                    </div>
                    <div className="preview-row">
                      <span className="preview-address">0x66f8...A4d2</span>
                      <span className="preview-amount">0.125 ETH</span>
                    </div>
                    <div className="preview-row muted">
                      <span className="preview-address">+181 more</span>
                      <span className="preview-amount">Single tx</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="chains-section">
              <p className="chains-label">Supported networks</p>
              <div className="chains-marquee" aria-label="Supported networks">
                <div className="chains-track" aria-hidden="false">
                  {[...Array(2)].map((_, dup) => (
                    <div className="chains-row" key={dup} aria-hidden={dup === 1}>
                      <div className="chain-item">{NetworkLogos.ethereum}<span>Ethereum</span></div>
                      <div className="chain-item">{NetworkLogos.base}<span>Base</span></div>
                      <div className="chain-item">{NetworkLogos.polygon}<span>Polygon</span></div>
                      <div className="chain-item">{NetworkLogos.arbitrum}<span>Arbitrum</span></div>
                      <div className="chain-item">{NetworkLogos.optimism}<span>Optimism</span></div>
                      <div className="chain-item">{NetworkLogos.bnb}<span>BNB</span></div>
                      <div className="chain-item">{NetworkLogos.sepolia}<span>Sepolia</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="how-section" id="how-it-works">
              <h2 className="section-title">How it works</h2>
              <p className="section-subtitle">Three steps from a list of addresses to a single on-chain transaction.</p>
              <div className="steps-row">
                {workflowSteps.map((item) => (
                  <div key={item.step} className="step-card">
                    <div className="step-number">{item.step}</div>
                    <h3>{item.title}</h3>
                    <p className="step-desc">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="feature-grid-section">
              <h2 className="section-title">Built for speed and clarity</h2>
              <p className="section-subtitle">Everything you need to review a batch and send it with confidence — nothing you don't.</p>
              <div className="feature-grid">
                {featureCards.map((item) => (
                  <article key={item.title} className="feature-card">
                    <div className="feature-icon">{item.icon}</div>
                    <h3>{item.title}</h3>
                    <p className="feature-desc">{item.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="contract-section modern-contract">
              <div className="contract-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Verified · Open-source · Non-custodial</span>
              </div>
              <a href="https://etherscan.io/address/0x33b82Ad6f62332D6359e582b642466591A6a9DDA#code" target="_blank" rel="noopener noreferrer" className="contract-link">
                View contract on Etherscan
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>
            </section>

            <section className="faq-section">
              <h2 className="section-title">FAQ</h2>
              <p className="section-subtitle">Answers to the questions people ask before their first batch send.</p>
              <div className="faq-list">
                {faqItems.map((item, i) => (
                  <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                    <button
                      className="faq-question"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      aria-expanded={openFaq === i}
                      aria-controls={`faq-panel-${i}`}
                    >
                      <span>{item.q}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <div id={`faq-panel-${i}`} className="faq-answer-wrap" role="region">
                      <div className="faq-answer">{item.a}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="cta-section">
              <h2>Start batching</h2>
              <p className="cta-subtitle">Non-custodial and free to explore — open the console now, connect your wallet only when you're ready to send.</p>
              <div className="cta-actions">
                <button className="btn-hero" onClick={() => setEntered(true)}>
                  Launch App
                </button>
                <button className="btn-secondary" onClick={handleConnectWallet} disabled={loading}>
                  {loading ? 'Connecting…' : 'Connect wallet'}
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="dashboard">
            <div className="dashboard-hero">
              <div className="page-header">
                <span className="page-kicker">Distribution Console</span>
                <h1 className="page-title">
                  {activeTab === 'native' ? `Send ${nativeSymbol}` : (tokenInfo ? `Send ${tokenInfo.symbol}` : 'Send Token')}
                </h1>
                <p className="page-description">
                  Review recipients, approval state, totals, and explorer details before you submit the transaction.
                </p>
              </div>
              <div className="dashboard-meta">
                <span className={`dashboard-chip ${account ? '' : 'preview'}`}>{account ? (network || 'Connected') : 'Preview mode'}</span>
                <span className="dashboard-chip">{sendMode === 'same' ? 'Same amount mode' : 'Custom amounts mode'}</span>
                {contractAddress ? (
                  <a href={`${explorerUrl}/address/${contractAddress}`} target="_blank" rel="noopener noreferrer" className="dashboard-chip link">
                    Contract {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                  </a>
                ) : account ? (
                  <span className="dashboard-chip muted">Contract unavailable on this network</span>
                ) : (
                  <a href="https://etherscan.io/address/0x33b82Ad6f62332D6359e582b642466591A6a9DDA" target="_blank" rel="noopener noreferrer" className="dashboard-chip link">
                    View contract
                  </a>
                )}
              </div>
            </div>

            {isUnsupportedNetwork && (
              <div className="alert alert-warning">
                <span>Network not supported! Switch to a supported network:</span>
                <div className="network-buttons">
                  <button onClick={() => switchNetwork(1)}>Ethereum</button>
                  <button onClick={() => switchNetwork(56)}>BNB Chain</button>
                  <button onClick={() => switchNetwork(8453)}>Base</button>
                </div>
              </div>
            )}

            <SummaryBar
              recipientCount={recipientCount}
              totalAmount={totalAmount}
              usdValue={price ? totalAmount * price : undefined}
              symbol={symbol}
              isApprovalRequired={activeTab === 'erc20' && needsApproval}
              className="dashboard-summary"
            />

            <div className="dashboard-layout dashboard-layout-modern">
              <div className="main-content">
                <div className="send-card send-card-modern">
                  <div className="send-card-top">
                    <div>
                      <div className="section-label">Asset</div>
                      <div className="asset-switch" role="tablist" aria-label="Asset type">
                        <button
                          className={`asset-switch-btn ${activeTab === 'native' ? 'active' : ''}`}
                          onClick={() => { setActiveTab('native'); setError(null); setSuccess(null) }}
                        >
                          <span className="asset-switch-icon">{NetworkLogos[networkConfig.logo]}</span>
                          <span>Send {nativeSymbol}</span>
                        </button>
                        <button
                          className={`asset-switch-btn ${activeTab === 'erc20' ? 'active' : ''}`}
                          onClick={() => { setActiveTab('erc20'); setError(null); setSuccess(null) }}
                        >
                          <span className="asset-switch-icon erc20">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M12 6v12M6 12h12"/>
                            </svg>
                          </span>
                          <span>Send Token</span>
                        </button>
                      </div>
                    </div>
                    <div className="send-card-note">
                      {activeTab === 'native'
                        ? `Using ${nativeSymbol} on ${networkConfig.name}.`
                        : 'ERC20 mode requires a token address and approval when needed.'}
                    </div>
                  </div>

                  {activeTab === 'erc20' && (
                    <div className="token-input-section">
                      <label>Token Contract Address</label>
                      <input
                        type="text"
                        value={tokenAddress}
                        onChange={(e) => setTokenAddress(e.target.value)}
                        placeholder="0x..."
                        className="input-token"
                      />
                      {tokenInfo && (
                        <div className="token-badge">
                          <span className="token-name">{tokenInfo.name}</span>
                          <span className="token-symbol">{tokenInfo.symbol}</span>
                          <span className="token-balance">{parseFloat(tokenInfo.balance).toFixed(2)} available</span>
                        </div>
                      )}
                    </div>
                  )}

                  <ModeSelector activeMode={sendMode} onChange={setSendMode} />

                  {sendMode === 'same' && (
                    <div className="amount-section">
                      <label>Amount per recipient</label>
                      <div className="amount-input-wrapper">
                        <input
                          type="number"
                          value={sameAmount}
                          onChange={(e) => setSameAmount(e.target.value)}
                          placeholder="0.00"
                          className="input-amount"
                          step="any"
                        />
                        <div className="amount-toggle">
                          <button
                            className={!useUsd ? 'active' : ''}
                            onClick={() => setUseUsd(false)}
                          >
                            {symbol}
                          </button>
                          <button
                            className={useUsd ? 'active' : ''}
                            onClick={() => setUseUsd(true)}
                            disabled={!price}
                          >
                            USD
                          </button>
                        </div>
                      </div>
                      {useUsd && price && sameAmount && (
                        <div className="conversion-hint">
                          ≈ {(parseFloat(sameAmount) / price).toFixed(6)} {symbol} per recipient
                        </div>
                      )}
                    </div>
                  )}

                  <div className="recipients-section modern">
                    <div className="recipients-header modern">
                      <div>
                        <label>{sendMode === 'same' ? 'Recipient Addresses' : 'Recipients & Amounts'}</label>
                        <p className="recipients-subtitle">
                          {sendMode === 'same'
                            ? 'Paste one address per line or build your list inline.'
                            : 'Use address and amount pairs, one recipient per line.'}
                        </p>
                      </div>
                      <button className="btn-clear" onClick={clearAll}>Clear All</button>
                    </div>

                    <RecipientInput
                      value={recipients}
                      onChange={setRecipients}
                      sendMode={sendMode}
                      parseWarnings={parseWarnings}
                      quickAddAddress={quickAddAddress}
                      onQuickAddAddressChange={setQuickAddAddress}
                      quickAddAmount={quickAddAmount}
                      onQuickAddAmountChange={setQuickAddAmount}
                      onQuickAdd={addQuickRecipient}
                      isQuickAddDisabled={isQuickAddDisabled}
                    />
                  </div>

                  {activeTab === 'erc20' && needsApproval && tokenInfo && !isUnsupportedNetwork && (
                    <ApprovalCard
                      tokenSymbol={tokenInfo.symbol}
                      isApproving={approving}
                      isApproved={false}
                      onApprove={approveToken}
                    />
                  )}

                  {error && (
                    <div className="alert alert-error" role="alert" aria-live="assertive">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="alert alert-success" role="status" aria-live="polite">
                      <div className="success-message">
                        {success.total && success.count ? (
                          <>Sent {success.total.toFixed(4)} {success.symbol} to {success.count} {success.count === 1 ? 'address' : 'addresses'}</>
                        ) : (
                          success.message
                        )}
                      </div>
                      {success.hash && (
                        <a href={`${explorerUrl}/tx/${success.hash}`} target="_blank" rel="noopener noreferrer">
                          View Transaction
                        </a>
                      )}
                    </div>
                  )}

                  <button
                    className="btn-send"
                    onClick={!account ? handleConnectWallet : (activeTab === 'native' ? confirmSendNative : confirmSendERC20)}
                    disabled={account ? (loading || recipientCount === 0 || totalAmount === 0 || isUnsupportedNetwork || (activeTab === 'erc20' && (!tokenInfo || needsApproval))) : loading}
                  >
                    {!account ? (
                      loading ? (
                        <span className="btn-loading">
                          <span className="spinner"></span>
                          Connecting…
                        </span>
                      ) : (
                        'Connect Wallet to Send'
                      )
                    ) : loading ? (
                      <span className="btn-loading">
                        <span className="spinner"></span>
                        Processing...
                      </span>
                    ) : isUnsupportedNetwork ? (
                      'Switch to Supported Network'
                    ) : activeTab === 'erc20' && !tokenInfo ? (
                      'Enter Token Address'
                    ) : activeTab === 'erc20' && needsApproval ? (
                      'Approve Token First'
                    ) : recipientCount === 0 ? (
                      'Add Recipients'
                    ) : totalAmount === 0 ? (
                      'Enter Amount'
                    ) : (
                      `Send ${totalAmount.toFixed(4)} ${symbol} to ${recipientCount} ${recipientCount === 1 ? 'address' : 'addresses'}`
                    )}
                  </button>
                </div>
              </div>

              <aside className="sidebar">
                <div className="sidebar-card">
                  <div className="sidebar-section-title">Wallet</div>
                  {account ? (
                    <div className="sidebar-wallet">
                      <div className="sidebar-wallet-address">
                        <span className="wallet-status"></span>
                        <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                      </div>
                      <div className="sidebar-balance">
                        <div className="sidebar-balance-label">Balance</div>
                        <div className="sidebar-balance-value">
                          {parseFloat(balance || 0).toFixed(4)} <span>{nativeSymbol}</span>
                        </div>
                        {ethPrice && (
                          <div className="sidebar-balance-usd">${(parseFloat(balance || 0) * ethPrice).toFixed(2)} USD</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="sidebar-wallet">
                      <div className="sidebar-wallet-address disconnected">
                        <span className="wallet-status off"></span>
                        <span>Not connected</span>
                      </div>
                      <button className="btn-connect-inline" onClick={handleConnectWallet} disabled={loading}>
                        {loading ? 'Connecting…' : 'Connect Wallet'}
                      </button>
                      <p className="sidebar-wallet-hint">Connect to load your balance and send your batch.</p>
                    </div>
                  )}
                </div>

                <div className="sidebar-card">
                  <div className="sidebar-section-title">Review</div>
                  <div className="sidebar-stats">
                    <div className="sidebar-stat">
                      <span className="sidebar-stat-label">Recipients</span>
                      <span className="sidebar-stat-value">{recipientCount}</span>
                    </div>
                    <div className="sidebar-stat">
                      <span className="sidebar-stat-label">Total {symbol}</span>
                      <span className="sidebar-stat-value">{totalAmount.toFixed(6)}</span>
                    </div>
                    {price && (
                      <div className="sidebar-stat">
                        <span className="sidebar-stat-label">USD Value</span>
                        <span className="sidebar-stat-value accent">${(totalAmount * price).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="sidebar-stat">
                      <span className="sidebar-stat-label">Mode</span>
                      <span className="sidebar-stat-value">{sendMode === 'same' ? 'Same amount' : 'Custom amounts'}</span>
                    </div>
                    <div className="sidebar-stat">
                      <span className="sidebar-stat-label">Network</span>
                      <span className="sidebar-stat-value">{account ? networkConfig.name : 'Not connected'}</span>
                    </div>
                  </div>
                </div>

                <div className="sidebar-card accent-card">
                  <div className="sidebar-section-title">Before You Send</div>
                  <div className="sidebar-tips">
                    {checklistItems.map((item) => (
                      <div key={item} className="sidebar-tip">
                        <span className="sidebar-tip-dot"></span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmation && pendingTx && (
          <div className="confirmation-overlay" onClick={() => setShowConfirmation(false)} role="presentation">
            <div
              className="confirmation-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-tx-title"
            >
              <div className="confirmation-header">
                <h3 id="confirm-tx-title">Confirm Transaction</h3>
                <button
                  className="confirmation-close"
                  onClick={() => setShowConfirmation(false)}
                  aria-label="Close confirmation dialog"
                >×</button>
              </div>

              <div className="confirmation-body">
                <div className="confirmation-summary">
                  <div className="confirmation-row">
                    <span className="confirmation-label">Recipients</span>
                    <span className="confirmation-value">{pendingTx.recipients.length} {pendingTx.recipients.length === 1 ? 'address' : 'addresses'}</span>
                  </div>
                  <div className="confirmation-row">
                    <span className="confirmation-label">Total Amount</span>
                    <span className="confirmation-value highlight">{pendingTx.total.toFixed(6)} {pendingTx.symbol}</span>
                  </div>
                  {pendingTx.usdTotal && (
                    <div className="confirmation-row">
                      <span className="confirmation-label">USD Value</span>
                      <span className="confirmation-value">${pendingTx.usdTotal.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="confirmation-preview">
                  <span className="preview-label">Preview (first 5 recipients)</span>
                  <div className="preview-list">
                    {pendingTx.recipients.slice(0, 5).map((addr, i) => (
                      <div key={addr} className="preview-item">
                        <span className="preview-address">{addr.slice(0, 10)}...{addr.slice(-8)}</span>
                        <span className="preview-amount">{parseFloat(pendingTx.amounts[i]).toFixed(4)} {pendingTx.symbol}</span>
                      </div>
                    ))}
                    {pendingTx.recipients.length > 5 && (
                      <div className="preview-more">
                        +{pendingTx.recipients.length - 5} more recipients
                      </div>
                    )}
                  </div>
                </div>

                <div className="confirmation-warning">
                  ⚠️ This action is irreversible. Please verify the details above.
                </div>
              </div>

              <div className="confirmation-actions">
                <button className="btn-cancel" onClick={() => setShowConfirmation(false)}>
                  Cancel
                </button>
                <button
                  className="btn-confirm"
                  onClick={pendingTx.type === 'native' ? sendNative : sendERC20}
                  autoFocus
                >
                  Confirm & Send
                </button>
              </div>
            </div>
          </div>
        )}
      </main>


    </div>
  )
}

export default App
