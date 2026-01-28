import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { MULTISENDER_ADDRESSES, SUPPORTED_CHAINS, getContractAddress, MULTISENDER_ABI, ERC20_ABI } from './contract'
import { getNativePrice, getTokenPrice } from './priceApi'
import { initWalletConnect, connectWallet, disconnectWallet, getProvider } from './walletConnect'

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
    137: { name: 'Polygon', symbol: 'MATIC', explorer: 'https://polygonscan.com', coingeckoId: 'matic-network', logo: 'polygon' },
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

  // Apply theme to body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])



  // Initialize wallet connection on mount
  useEffect(() => {
    checkConnection()
  }, [])

  // Set up event listeners for wallet provider - only when account changes
  useEffect(() => {
    const wcProvider = getProvider()
    
    // If no provider, ensure we're showing login screen
    if (!wcProvider) {
      return
    }

    const handleDisconnect = () => {
      // Clear all application state when wallet disconnects
      clearAllState()
    }

    const handleAccountsChange = (accounts) => {
      handleAccountsChanged(accounts)
    }

    const handleChainChange = async () => {
      await updateNetwork()
      if (account) {
        await updateBalance(account)
      }
    }
    
    // Attach listeners
    wcProvider.on('accountsChanged', handleAccountsChange)
    wcProvider.on('chainChanged', handleChainChange)
    wcProvider.on('disconnect', handleDisconnect)
    
    // Cleanup: remove listeners
    return () => {
      try {
        wcProvider.removeEventListener('accountsChanged', handleAccountsChange)
        wcProvider.removeEventListener('chainChanged', handleChainChange)
        wcProvider.removeEventListener('disconnect', handleDisconnect)
      } catch (e) {
        // Provider might have been destroyed, silently ignore
      }
    }
  }, [account])

  // Fetch native token price when chainId changes
  useEffect(() => {
    if (chainId) {
      // Clear previous native price to avoid showing stale prices from another network
      setEthPrice(null)
      fetchNativePrice(chainId)
      // Clear old token price and info when switching networks
      setTokenPrice(null)
      setTokenInfo(null)
    }
  }, [chainId])

  const fetchNativePrice = async (networkChainId) => {
    try {
      const config = NETWORK_CONFIG[Number(networkChainId)] || { coingeckoId: 'ethereum' }
      // Pass chainId as third arg so priceApi can try wrapped-native fallback when needed
      const price = await getNativePrice(config.coingeckoId, 'usd', networkChainId)
      setEthPrice(price)
    } catch (err) {
      console.error('Failed to fetch native token price:', err)
      // Ensure we don't keep a previous network's price when fetch fails
      // Fallback: for Polygon, try WMATIC token price via token price endpoint
      if (Number(networkChainId) === 137) {
        try {
          const WMATIC = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
          const tokenPrice = await getTokenPrice(WMATIC, 137)
          if (tokenPrice) {
            setEthPrice(tokenPrice)
            return
          }
        } catch (e) {
          console.warn('WMATIC fallback failed:', e)
        }
      }
      setEthPrice(null)
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

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount(null)
      setBalance(null)
    } else {
      setAccount(accounts[0])
      updateBalance(accounts[0])
    }
  }

  const checkConnection = async () => {
    try {
      await initWalletConnect()
      const wcProvider = getProvider()
      if (wcProvider) {
        const accounts = await wcProvider.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          setAccount(accounts[0])
          await updateBalance(accounts[0])
          await updateNetwork()
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const updateBalance = async (address) => {
    const wcProvider = getProvider()
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
    try {
      setLoading(true)
      const wcProvider = await connectWallet()
      const accounts = await wcProvider.request({ method: 'eth_requestAccounts' })
      setAccount(accounts[0])
      await updateBalance(accounts[0])
      await updateNetwork()
      setError(null)
    } catch (err) {
      if (err.message !== 'Connection timeout') {
        setError(parseError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnectWallet = async () => {
    try {
      // First disconnect the wallet from walletConnect
      await disconnectWallet()
    } catch (err) {
      console.error('Error disconnecting wallet:', err)
    } finally {
      // Always clear all state, regardless of disconnect success
      // This ensures the UI shows login screen even if disconnect partially fails
      clearAllState()
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

   return (
     <div className="app">


      {/* Header */}
      <header className="header">
        <div className="logo">
          <img src="/logo.png" alt="MultiSend" className="logo-img" />
          <span>MultiSend</span>
        </div>
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
        </div>
      </header>

      <main className="main">
        {!account ? (
          <div className="connect-section">
            <div className="connect-card">
              <div className="connect-icon">
                <img src="/logo.png" alt="MultiSend" className="connect-logo-img" />
              </div>
              <h1>Send to Multiple Wallets</h1>
              <p>Distribute ETH or ERC20 tokens to hundreds of addresses in a single transaction</p>
               <button className="btn-connect" onClick={handleConnectWallet} disabled={loading}>
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
              <div className="features">
                <div className="feature">
                  <div className="feature-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span>Gas Efficient</span>
                </div>
                <div className="feature">
                  <div className="feature-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="12" cy="16" r="1" fill="currentColor"/>
                    </svg>
                  </div>
                  <span>Non-Custodial</span>
                </div>
                <div className="feature">
                  <div className="feature-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M8 8.5C8 7.67 8.67 7 9.5 7H12v4H9.5C8.67 11 8 10.33 8 9.5v-1z" fill="currentColor" opacity="0.3"/>
                      <path d="M12 11h2.5c.83 0 1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5H12v-4z" fill="currentColor" opacity="0.3"/>
                    </svg>
                  </div>
                  <span>USD Pricing</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="dashboard">
            {/* Page Header - at top */}
            <div className="page-header">
              <h1 className="page-title">
                {activeTab === 'native' ? `Send ${nativeSymbol}` : 'Send Token'}
              </h1>
              <p className="page-description">
                Distribute {activeTab === 'native' ? nativeSymbol : 'ERC20 tokens'} to multiple addresses in a single transaction
              </p>
            </div>

            {/* Unsupported Network Warning */}
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

            <div className="dashboard-layout">
              {/* Sidebar */}
              <aside className="sidebar">
                {/* Wallet Card */}
                <div className="sidebar-card">
                  <div className="sidebar-section-title">Wallet</div>
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
                </div>

                {/* Navigation Card */}
                <div className="sidebar-card">
                  <div className="sidebar-section-title">Send Type</div>
                  <div className="sidebar-nav">
                    <button
                      className={`sidebar-nav-item ${activeTab === 'native' ? 'active' : ''}`}
                      onClick={() => { setActiveTab('native'); setError(null); setSuccess(null); }}
                    >
                      <span className="sidebar-nav-icon">{NetworkLogos[networkConfig.logo]}</span>
                      <span>Send {nativeSymbol}</span>
                    </button>
                    <button
                      className={`sidebar-nav-item ${activeTab === 'erc20' ? 'active' : ''}`}
                      onClick={() => { setActiveTab('erc20'); setError(null); setSuccess(null); }}
                    >
                      <span className="sidebar-nav-icon erc20">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 6v12M6 12h12"/>
                        </svg>
                      </span>
                      <span>Send Token</span>
                    </button>
                  </div>
                </div>

                {/* Stats Card */}
                <div className="sidebar-card">
                  <div className="sidebar-section-title">Transaction Preview</div>
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
                  </div>
                </div>
              </aside>

              {/* Main Content */}
              <div className="main-content">
                {/* Main Card */}
              <div className="send-card">
                {/* Token Address for ERC20 */}
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

                {/* Send Mode Toggle */}
                <div className="mode-section">
                  <label>Distribution Mode</label>
                  <div className="mode-toggle">
                    <button
                      className={`mode-option ${sendMode === 'same' ? 'active' : ''}`}
                      onClick={() => setSendMode('same')}
                    >
                      <span className="mode-icon">═</span>
                      <span>Same Amount</span>
                      <small>Send equal amounts to all</small>
                    </button>
                    <button
                      className={`mode-option ${sendMode === 'custom' ? 'active' : ''}`}
                      onClick={() => setSendMode('custom')}
                    >
                      <span className="mode-icon">≠</span>
                      <span>Custom Amounts</span>
                      <small>Different amount per address</small>
                    </button>
                  </div>
                </div>

                {/* Amount Input (for Same Amount mode) */}
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

                {/* Recipients Input */}
                <div className="recipients-section">
                  <div className="recipients-header">
                    <label>
                      {sendMode === 'same' ? 'Recipient Addresses' : 'Recipients & Amounts'}
                    </label>
                    <button className="btn-clear" onClick={clearAll}>Clear All</button>
                  </div>

                  <textarea
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder={sendMode === 'same'
                      ? "Paste addresses (one per line)\n0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91\n0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
                      : "Address, Amount (one per line)\n0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91, 0.1\n0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B, 0.25"
                    }
                    className="input-recipients"
                  />

                  {/* Quick Add */}
                  <div className="quick-add">
                    <input
                      type="text"
                      value={quickAddAddress}
                      onChange={(e) => setQuickAddAddress(e.target.value)}
                      placeholder="Quick add address"
                      className="input-quick"
                    />
                    {sendMode === 'custom' && (
                      <input
                        type="number"
                        value={quickAddAmount}
                        onChange={(e) => setQuickAddAmount(e.target.value)}
                        placeholder="Amount"
                        className="input-quick-amount"
                        step="any"
                      />
                    )}
                    <button className="btn-add" onClick={addQuickRecipient}>+ Add</button>
                  </div>

                  {/* Parse Warnings */}
                  {(parseWarnings.invalid > 0 || parseWarnings.duplicates > 0) && (
                    <div className="parse-warnings">
                      {parseWarnings.invalid > 0 && (
                        <span className="warning-item warning-invalid">
                          {parseWarnings.invalid} invalid {parseWarnings.invalid === 1 ? 'entry' : 'entries'} ignored
                        </span>
                      )}
                      {parseWarnings.duplicates > 0 && (
                        <span className="warning-item warning-duplicate">
                          {parseWarnings.duplicates} duplicate {parseWarnings.duplicates === 1 ? 'address' : 'addresses'} removed
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Alerts */}
                {error && (
                  <div className="alert alert-error">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="alert alert-success">
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

                {/* Action Buttons */}
                {activeTab === 'native' ? (
                  <button
                    className="btn-send"
                    onClick={confirmSendNative}
                    disabled={loading || recipientCount === 0 || totalAmount === 0 || isUnsupportedNetwork}
                  >
                    {loading ? (
                      <span className="btn-loading">
                        <span className="spinner"></span>
                        Processing...
                      </span>
                    ) : isUnsupportedNetwork ? (
                      'Switch to Supported Network'
                    ) : recipientCount === 0 ? (
                      'Add Recipients'
                    ) : totalAmount === 0 ? (
                      'Enter Amount'
                    ) : (
                      `Send ${totalAmount.toFixed(4)} ${nativeSymbol} to ${recipientCount} ${recipientCount === 1 ? 'address' : 'addresses'}`
                    )}
                  </button>
                ) : (
                  <>
                    {needsApproval && tokenInfo && !isUnsupportedNetwork && (
                      <button
                        className="btn-approve"
                        onClick={approveToken}
                        disabled={approving}
                      >
                        {approving ? 'Approving...' : `Approve ${tokenInfo.symbol}`}
                      </button>
                    )}
                    <button
                      className="btn-send"
                      onClick={confirmSendERC20}
                      disabled={loading || recipientCount === 0 || !tokenInfo || needsApproval || totalAmount === 0 || isUnsupportedNetwork}
                    >
                      {loading ? (
                        <span className="btn-loading">
                          <span className="spinner"></span>
                          Processing...
                        </span>
                      ) : isUnsupportedNetwork ? (
                        'Switch to Supported Network'
                      ) : !tokenInfo ? (
                        'Enter Token Address'
                      ) : recipientCount === 0 ? (
                        'Add Recipients'
                      ) : needsApproval ? (
                        'Approve Token First'
                      ) : totalAmount === 0 ? (
                        'Enter Amount'
                      ) : (
                        `Send ${totalAmount.toFixed(4)} ${tokenInfo.symbol} to ${recipientCount} ${recipientCount === 1 ? 'address' : 'addresses'}`
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* Contract Info */}
              <div className="contract-info">
                {contractAddress ? (
                  <a href={`${explorerUrl}/address/${contractAddress}`} target="_blank" rel="noopener noreferrer">
                    Contract: {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}
                  </a>
                ) : (
                  <span>Contract not deployed on {network}</span>
                )}
                {ethPrice && <span>{nativeSymbol}: ${ethPrice.toLocaleString()}</span>}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmation && pendingTx && (
          <div className="confirmation-overlay" onClick={() => setShowConfirmation(false)}>
            <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
              <div className="confirmation-header">
                <h3>Confirm Transaction</h3>
                <button className="confirmation-close" onClick={() => setShowConfirmation(false)}>×</button>
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
                >
                  Confirm & Send
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        Made by <a href="https://x.com/zx_joy_" target="_blank" rel="noopener noreferrer">@zx_joy_</a>
      </footer>
    </div>
  )
}

export default App
