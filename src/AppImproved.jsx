/**
 * AppImproved Component
 * Refactored MultiSender app with improved UI/UX following the skill profile
 * 
 * Key improvements:
 * - Clear information hierarchy with SummaryBar at top
 * - FormGroup wrapper for consistent section styling
 * - Prominent ApprovalCard for token approval
 * - ModeSelector with clear visual feedback
 * - RecipientInput with integrated quick-add and warnings
 * - Linear flow matching user mental model
 */

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { MULTISENDER_ADDRESSES, SUPPORTED_CHAINS, getContractAddress, MULTISENDER_ABI, ERC20_ABI } from './contract'
import { getNativePrice, getTokenPrice } from './priceApi'
import { initWalletConnect, connectWallet, disconnectWallet, getProvider } from './walletConnect'

// Import new components
import FormGroup from './components/FormGroup'
import SummaryBar from './components/SummaryBar'
import ApprovalCard from './components/ApprovalCard'
import ModeSelector from './components/ModeSelector'
import RecipientInput from './components/RecipientInput'

// Parse blockchain errors (from original App.jsx)
const parseError = (err) => {
  const message = err?.message || err?.reason || String(err)
  if (err?.code === 'ACTION_REJECTED' || message.includes('user rejected') || message.includes('User rejected') || err?.info?.error?.code === 4001) {
    return 'Transaction cancelled'
  }
  if (message.includes('insufficient funds') || message.includes('Insufficient funds')) {
    return 'Insufficient funds for gas fees'
  }
  if (message.includes('cannot estimate gas') || message.includes('gas required exceeds')) {
    return 'Transaction would fail - check your balance and inputs'
  }
  if (message.includes('allowance') || message.includes('ERC20: insufficient allowance')) {
    return 'Token approval required - please approve first'
  }
  if (message.includes('transfer amount exceeds balance')) {
    return 'Insufficient token balance'
  }
  if (message.includes('network') || message.includes('disconnected')) {
    return 'Network error - please check your connection'
  }
  if (message.includes('No recipients')) {
    return 'Please add at least one recipient'
  }
  if (message.includes('Length mismatch')) {
    return 'Recipients and amounts count mismatch'
  }
  if (message.includes('Incorrect ETH value')) {
    return 'ETH amount calculation error'
  }
  if (message.length > 100) {
    return 'Transaction failed - please try again'
  }
  return message
}

function AppImproved() {
  // Connection state
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(null)
  const [network, setNetwork] = useState(null)
  const [chainId, setChainId] = useState(null)

  // UI state
  const [activeTab, setActiveTab] = useState('native')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showNetworkSwitcher, setShowNetworkSwitcher] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  // Price data
  const [ethPrice, setEthPrice] = useState(null)
  const [tokenPrice, setTokenPrice] = useState(null)

  // Form state - Send mode
  const [sendMode, setSendMode] = useState('same')

  // Form state - Recipients & Amounts
  const [recipients, setRecipients] = useState('')
  const [sameAmount, setSameAmount] = useState('')
  const [useUsd, setUseUsd] = useState(false)

  // Form state - ERC20
  const [tokenAddress, setTokenAddress] = useState('')
  const [tokenInfo, setTokenInfo] = useState(null)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [approving, setApproving] = useState(false)

  // Form state - Quick add
  const [quickAddAddress, setQuickAddAddress] = useState('')
  const [quickAddAmount, setQuickAddAmount] = useState('')

  // Form state - Confirmation & Warnings
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingTx, setPendingTx] = useState(null)
  const [parseWarnings, setParseWarnings] = useState({ invalid: 0, duplicates: 0 })

  // Network logos (all supported networks)
  const NetworkLogos = {
    ethereum: <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path d="M16.498 4v8.87l7.497 3.35L16.498 4z" fill="#fff" fillOpacity=".6"/><path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/><path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#fff" fillOpacity=".6"/><path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#fff"/><path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#fff" fillOpacity=".2"/><path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#fff" fillOpacity=".6"/></svg>,
    bnb: <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#F3BA2F"/><path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003 2.263-2.257zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002L16 13.706l-2.173 2.173-.02.02-.122.122.115.115L16 18.294l2.293-2.293.002-.002-.003-.001z" fill="#fff"/></svg>,
    polygon: <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#8247E5"/><path d="M21.092 12.693c-.369-.215-.848-.215-1.254 0l-2.879 1.654-1.955 1.078-2.879 1.653c-.369.216-.848.216-1.254 0l-2.288-1.294c-.369-.215-.627-.61-.627-1.042V12.19c0-.431.221-.826.627-1.042l2.25-1.258c.37-.216.85-.216 1.256 0l2.25 1.258c.37.216.628.611.628 1.042v1.654l1.955-1.115v-1.653a1.16 1.16 0 00-.627-1.042l-4.17-2.372c-.369-.216-.848-.216-1.254 0l-4.244 2.372A1.16 1.16 0 006 11.076v4.78c0 .432.221.827.627 1.043l4.244 2.372c.369.215.849.215 1.254 0l2.879-1.618 1.955-1.114 2.879-1.617c.369-.216.848-.216 1.254 0l2.251 1.258c.37.215.627.61.627 1.042v2.552c0 .431-.22.826-.627 1.042l-2.25 1.294c-.37.216-.85.216-1.255 0l-2.251-1.258c-.37-.216-.628-.611-.628-1.042v-1.654l-1.955 1.115v1.653c0 .431.221.827.627 1.042l4.244 2.372c.369.216.848.216 1.254 0l4.244-2.372c.369-.215.627-.61.627-1.042v-4.78a1.16 1.16 0 00-.627-1.042l-4.28-2.409z" fill="#fff"/></svg>,
    arbitrum: <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#213147"/><path d="M16.62 21.54l1.14 3.13.93-.34-1.4-3.86-.67 1.07zm4.86-7.31l-3.41 5.44 1.27 3.49 4.54-7.24-2.4-1.69zm-7.57 5.57l-.85 1.35 1.4 3.87.93-.34-1.48-4.88zm1.76-2.82l2.26-3.6-1.28-3.52-3.93 6.27 2.95.85zm6.27-4.51l-2.59 4.13 2.19.63 2.48-3.96-2.08-.8zM16 6l-6.46 10.31 2.27.65L16 10.15l4.19 6.81 2.27-.65L16 6z" fill="#fff"/><path d="M16 6l-6.46 10.31 2.27.65L16 10.15l4.19 6.81 2.27-.65L16 6z" fill="#9DCCED"/><path d="M9.54 16.31L7 21.37l2.08.8 2.59-4.14-2.13-1.72z" fill="#fff"/><path d="M11.67 17.16l-2.59 4.14.93.34 1.4-3.86-.85-1.35.11.73z" fill="#9DCCED"/></svg>,
    optimism: <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#FF0420"/><circle cx="12" cy="16" r="4" fill="#fff"/><circle cx="12" cy="16" r="2" fill="#FF0420"/><path d="M18 12h2.5c1.93 0 3.5 1.57 3.5 3.5v0c0 1.93-1.57 3.5-3.5 3.5H18v-7z" fill="#fff"/></svg>,
    base: <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#0052FF"/><path d="M15.998 26c5.523 0 10-4.477 10-10s-4.477-10-10-10c-5.28 0-9.608 4.099-9.969 9.286h13.192v1.428H6.029C6.39 21.901 10.718 26 15.998 26z" fill="#fff"/></svg>,
    sepolia: <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path d="M16.498 4v8.87l7.497 3.35L16.498 4z" fill="#fff" fillOpacity=".6"/><path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/><path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#fff" fillOpacity=".6"/><path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#fff"/><path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#fff" fillOpacity=".2"/><path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#fff" fillOpacity=".6"/></svg>,
  }

  const NETWORK_CONFIG = {
    1: { name: 'Ethereum', symbol: 'ETH', explorer: 'https://etherscan.io', coingeckoId: 'ethereum', logo: 'ethereum' },
    56: { name: 'BNB Chain', symbol: 'BNB', explorer: 'https://bscscan.com', coingeckoId: 'binancecoin', logo: 'bnb' },
    8453: { name: 'Base', symbol: 'ETH', explorer: 'https://basescan.org', coingeckoId: 'ethereum', logo: 'base' },
    137: { name: 'Polygon', symbol: 'MATIC', explorer: 'https://polygonscan.com', coingeckoId: 'matic-network', logo: 'polygon' },
    42161: { name: 'Arbitrum', symbol: 'ETH', explorer: 'https://arbiscan.io', coingeckoId: 'ethereum', logo: 'arbitrum' },
    10: { name: 'Optimism', symbol: 'ETH', explorer: 'https://optimistic.etherscan.io', coingeckoId: 'ethereum', logo: 'optimism' },
    11155111: { name: 'Sepolia', symbol: 'ETH', explorer: 'https://sepolia.etherscan.io', coingeckoId: 'ethereum', logo: 'sepolia' },
  }

  const getCurrentNetworkConfig = () => NETWORK_CONFIG[Number(chainId)] || { name: 'Unknown', symbol: 'ETH', explorer: 'https://etherscan.io', coingeckoId: 'ethereum' }
  const getCurrentContractAddress = () => getContractAddress(chainId)
  const isNetworkSupported = () => chainId !== null && SUPPORTED_CHAINS.includes(Number(chainId))

  // ==================== THEME & CONNECTION ====================

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    checkConnection()
    const wcProvider = getProvider()
    if (wcProvider) {
      wcProvider.on('accountsChanged', handleAccountsChanged)
      wcProvider.on('chainChanged', async () => {
        await updateNetwork()
        if (account) await updateBalance(account)
      })
      wcProvider.on('disconnect', () => {
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
      })
    }
    return () => {
      if (wcProvider) {
        wcProvider.removeEventListener('accountsChanged', handleAccountsChanged)
        wcProvider.removeEventListener('chainChanged', updateNetwork)
        wcProvider.removeEventListener('disconnect', handleDisconnectWallet)
      }
    }
  }, [account])

  // Fetch price when network changes
  useEffect(() => {
    if (chainId) {
      fetchNativePrice(chainId)
      setTokenPrice(null)
      setTokenInfo(null)
    }
  }, [chainId])

  // ==================== PARSING & VALIDATION ====================

  const parseAddresses = (text, trackWarnings = false) => {
    if (!text.trim()) {
      if (trackWarnings) setParseWarnings({ invalid: 0, duplicates: 0 })
      return []
    }
    const lines = text.trim().split('\n').filter(line => line.trim())
    const addresses = []
    const seen = new Set()
    let invalidCount = 0, duplicateCount = 0

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

    if (trackWarnings) setParseWarnings({ invalid: invalidCount, duplicates: duplicateCount })
    return addresses
  }

  const parseRecipientsWithAmounts = (text, trackWarnings = false) => {
    if (!text.trim()) {
      if (trackWarnings) setParseWarnings({ invalid: 0, duplicates: 0 })
      return { recipients: [], amounts: [] }
    }
    const lines = text.trim().split('\n').filter(line => line.trim())
    const recipients = [], amounts = []
    const seen = new Set()
    let invalidCount = 0, duplicateCount = 0

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
            invalidCount++
          }
        } else {
          invalidCount++
        }
      } else if (parts.length === 1 && parts[0]) {
        invalidCount++
      }
    }

    if (trackWarnings) setParseWarnings({ invalid: invalidCount, duplicates: duplicateCount })
    return { recipients, amounts }
  }

  const getRecipientsAndAmounts = () => {
    if (sendMode === 'same') {
      const addresses = parseAddresses(recipients, false)
      let amount = parseFloat(sameAmount) || 0

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

  useEffect(() => {
    if (sendMode === 'same') {
      parseAddresses(recipients, true)
    } else {
      parseRecipientsWithAmounts(recipients, true)
    }
  }, [recipients, sendMode])

  // ==================== NETWORK & WALLET ====================

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
      if (!wcProvider) return
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
      await disconnectWallet()
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
    } catch (err) {
      console.error('Error disconnecting wallet:', err)
    }
  }

  // ==================== PRICE & TOKEN ====================

  const fetchNativePrice = async (networkChainId) => {
    try {
      const config = NETWORK_CONFIG[Number(networkChainId)] || { coingeckoId: 'ethereum' }
      const price = await getNativePrice(config.coingeckoId, 'usd', networkChainId)
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

  // ==================== TRANSACTIONS ====================

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
      symbol: networkConfig.symbol,
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
      setSuccess({ message: 'Transaction confirmed!', hash: tx.hash, total: totalAmount, symbol: networkConfig.symbol, count: addrs.length })
      await updateBalance(account)

    } catch (err) {
      console.error(err)
      setError(parseError(err))
    } finally {
      setLoading(false)
      setPendingTx(null)
    }
  }

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

  // ==================== COMPUTED VALUES ====================

  const networkConfig = getCurrentNetworkConfig()
  const contractAddress = getCurrentContractAddress()
  const isUnsupportedNetwork = chainId !== null && !isNetworkSupported()
  const recipientCount = sendMode === 'same' ? parseAddresses(recipients).length : parseRecipientsWithAmounts(recipients).recipients.length
  const totalAmount = getRecipientsAndAmounts().amounts.reduce((sum, a) => sum + parseFloat(a || 0), 0)
  const symbol = activeTab === 'native' ? networkConfig.symbol : (tokenInfo?.symbol || 'tokens')
  const price = activeTab === 'native' ? ethPrice : tokenPrice

  // ==================== RENDER ====================

  if (!account) {
    return (
      <div className="app">
        <header className="header">
          <div className="logo">
            <img src="/logo.png" alt="MultiSend" className="logo-img" />
            <span>MultiSend</span>
          </div>
          <div className="header-right">
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <main className="main">
          <div className="connect-section">
            <div className="connect-card">
              <h1>Send to Multiple Wallets</h1>
              <p>Distribute ETH or ERC20 tokens to hundreds of addresses in a single transaction</p>
              <button className="btn-connect" onClick={handleConnectWallet} disabled={loading}>
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <img src="/logo.png" alt="MultiSend" className="logo-img" />
          <span>MultiSend</span>
        </div>
        <div className="header-right">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {account && (
            <button className="wallet-pill" onClick={handleDisconnectWallet}>
              {account.slice(0, 6)}...{account.slice(-4)}
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <div className="dashboard">
          {/* Page Header */}
          <div className="page-header">
            <h1>
              {activeTab === 'native' ? `Send ${networkConfig.symbol}` : 'Send Token'}
            </h1>
            <p>Distribute {activeTab === 'native' ? networkConfig.symbol : 'ERC20 tokens'} to multiple addresses in a single transaction</p>
          </div>

          {/* Summary Bar - Sticky at top */}
          {account && (
            <SummaryBar
              recipientCount={recipientCount}
              totalAmount={totalAmount}
              usdValue={price ? totalAmount * price : undefined}
              symbol={symbol}
              isApprovalRequired={activeTab === 'erc20' && needsApproval}
            />
          )}

          <div className="form-container">
            {/* Token Selection (ERC20 mode) */}
            {activeTab === 'erc20' && (
              <FormGroup
                label="Token Contract Address"
                help="Enter the ERC20 token address"
              >
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder="0x..."
                  className="input-text"
                />
                {tokenInfo && (
                  <div className="token-info">
                    <span>{tokenInfo.name}</span>
                    <span className="token-balance">{parseFloat(tokenInfo.balance).toFixed(2)} {tokenInfo.symbol} available</span>
                  </div>
                )}
              </FormGroup>
            )}

            {/* Mode Selector */}
            <ModeSelector
              activeMode={sendMode}
              onChange={setSendMode}
            />

            {/* Amount Input (Same Mode Only) */}
            {sendMode === 'same' && (
              <FormGroup
                label="Amount Per Recipient"
                help={useUsd ? `${symbol} equivalent shown below` : 'Enter amount in ' + symbol}
              >
                <div className="amount-input-row">
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
              </FormGroup>
            )}

            {/* Recipients Input */}
            <FormGroup
              label={sendMode === 'same' ? 'Recipient Addresses' : 'Recipients & Amounts'}
              help={sendMode === 'same' ? 'One address per line' : 'Format: Address, Amount'}
            >
              <RecipientInput
                value={recipients}
                onChange={setRecipients}
                sendMode={sendMode}
                parseWarnings={parseWarnings}
                quickAddAddress={quickAddAddress}
                onQuickAddAddressChange={setQuickAddAddress}
                quickAddAmount={quickAddAmount}
                onQuickAddAmountChange={setQuickAddAmount}
                onQuickAdd={() => {
                  if (!quickAddAddress || !ethers.isAddress(quickAddAddress)) return
                  let newLine = quickAddAddress
                  if (sendMode === 'custom' && quickAddAmount) {
                    newLine += `, ${quickAddAmount}`
                  }
                  setRecipients(prev => prev ? `${prev}\n${newLine}` : newLine)
                  setQuickAddAddress('')
                  setQuickAddAmount('')
                }}
                isQuickAddDisabled={!quickAddAddress || !ethers.isAddress(quickAddAddress)}
              />
            </FormGroup>

            {/* Approval Card (ERC20 mode with approval needed) */}
            {activeTab === 'erc20' && needsApproval && tokenInfo && (
              <ApprovalCard
                tokenSymbol={tokenInfo.symbol}
                isApproving={approving}
                isApproved={false}
                onApprove={approveToken}
              />
            )}

            {/* Error Alert */}
            {error && (
              <div className="alert alert-error">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Success Alert */}
            {success && (
              <div className="alert alert-success">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                <div>
                  <span>
                    {success.total && success.count
                      ? `Sent ${success.total.toFixed(4)} ${success.symbol} to ${success.count} addresses`
                      : success.message}
                  </span>
                  {success.hash && (
                    <a href={`${networkConfig.explorer}/tx/${success.hash}`} target="_blank" rel="noopener noreferrer">
                      View on Explorer →
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Send Button */}
            <button
              className="btn-send"
              onClick={activeTab === 'native' ? confirmSendNative : confirmSendERC20}
              disabled={loading || recipientCount === 0 || (activeTab === 'erc20' && !tokenInfo) || needsApproval || totalAmount === 0 || isUnsupportedNetwork}
            >
              {loading ? 'Processing...' : `Send ${totalAmount.toFixed(4)} ${symbol} to ${recipientCount} addresses`}
            </button>
          </div>
        </div>
      </main>

      <style>{`
        .app {
          min-height: 100vh;
          background: var(--bg-base);
          color: var(--text-primary);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-5) var(--space-6);
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-raised);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          font-size: 1.5rem;
          font-weight: 700;
        }

        .logo-img {
          width: 32px;
          height: 32px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .theme-toggle {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .theme-toggle:hover {
          transform: scale(1.1);
        }

        .wallet-pill {
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-full);
          background: var(--accent-muted);
          border: 1px solid var(--accent);
          color: var(--text-primary);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 600;
          transition: all 0.2s;
        }

        .wallet-pill:hover {
          background: var(--accent);
          color: white;
        }

        .main {
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-8) var(--space-6);
        }

        .dashboard {
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
        }

        .page-header {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }

        .page-header h1 {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .page-header p {
          font-size: 1rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .form-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          max-width: 600px;
        }

        .input-text,
        .input-amount {
          width: 100%;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .input-text:focus,
        .input-amount:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 12px rgba(124, 58, 237, 0.2);
        }

        .amount-input-row {
          display: flex;
          gap: var(--space-2);
          align-items: center;
        }

        .amount-toggle {
          display: flex;
          background: var(--bg-elevated);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          padding: 2px;
        }

        .amount-toggle button {
          flex: 1;
          padding: var(--space-2) var(--space-3);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: calc(var(--radius-md) - 2px);
        }

        .amount-toggle button.active {
          background: var(--accent);
          color: white;
        }

        .conversion-hint {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          padding-top: var(--space-2);
        }

        .token-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-3) var(--space-4);
          background: var(--accent-muted);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
        }

        .token-balance {
          color: var(--text-tertiary);
        }

        .alert {
          display: flex;
          gap: var(--space-3);
          padding: var(--space-4);
          border-radius: var(--radius-md);
          border-left: 4px solid;
          animation: slideIn 0.2s ease-out;
        }

        .alert-error {
          background: var(--error-muted);
          border-left-color: var(--error);
          color: var(--error);
        }

        .alert-success {
          background: var(--success-muted);
          border-left-color: var(--success);
          color: var(--success);
          flex-direction: column;
          gap: var(--space-2);
        }

        .alert svg {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .alert-success a {
          color: var(--success);
          text-decoration: underline;
          font-size: 0.875rem;
        }

        .btn-send {
          padding: var(--space-4) var(--space-6);
          border-radius: var(--radius-md);
          background: var(--gradient-accent);
          color: white;
          border: none;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: var(--space-4);
        }

        .btn-send:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(124, 58, 237, 0.3);
        }

        .btn-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-connect {
          padding: var(--space-4) var(--space-6);
          border-radius: var(--radius-md);
          background: var(--gradient-accent);
          color: white;
          border: none;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .connect-section {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 500px;
        }

        .connect-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          text-align: center;
          max-width: 400px;
        }

        .connect-card h1 {
          font-size: 2rem;
          margin: 0;
        }

        .connect-card p {
          color: var(--text-secondary);
          margin: 0;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .main {
            padding: var(--space-4);
          }

          .page-header h1 {
            font-size: 1.5rem;
          }

          .form-container {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default AppImproved;
