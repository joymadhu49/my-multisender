import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ethers } from 'ethers'
import { MULTISENDER_ADDRESSES, SUPPORTED_CHAINS, getContractAddress, MULTISENDER_ABI, ERC20_ABI } from './contract'
import { APP_CONFIG } from './config'
import { NETWORKS, NETWORK_LOGOS, getNetwork } from './networks'
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

// True when the wallet reports the user dismissed/rejected the request
// (MetaMask 4001, ethers ACTION_REJECTED, WalletConnect message variants)
const isUserRejection = (err) => {
  const message = err?.message || ''
  return (
    err?.code === 4001 ||
    err?.code === 'ACTION_REJECTED' ||
    err?.info?.error?.code === 4001 ||
    /user rejected|user denied/i.test(message)
  )
}

// Compact human-readable amount (drops trailing zeros, max 6 decimals)
const formatAmount = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return String(Number(num.toFixed(6)))
}

// Compact price formatter for "@ $Z/ETH" style displays
const formatPrice = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return '0'
  return num >= 1 ? String(Number(num.toFixed(2))) : String(Number(num.toFixed(6)))
}

// Network-fee formatter: tiny L2 fees shouldn't collapse to "0"
const formatFee = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return '0'
  return num < 0.000001 ? '< 0.000001' : formatAmount(num)
}

// Single source of truth for the batch-send lifecycle. explorerBase is frozen
// into the status at send time so a later network switch can never rebuild the
// tx link against the wrong chain's explorer.
const IDLE_TX_STATUS = { stage: 'idle', hash: null, explorerBase: null, message: null }

// ERC-20 approval lifecycle (drives the ApprovalCard stage/txHash/explorerUrl props)
const IDLE_APPROVAL_STATUS = { stage: 'idle', hash: null, explorerBase: null }

// Parse addresses only (same-amount mode). Pure: returns per-line details so
// dropped rows can be surfaced instead of silently counted.
// details: [{ line, raw, reason }] with 1-based line numbers matching the textarea.
const parseAddressList = (text) => {
  const result = { addresses: [], details: [] }
  if (!text || !text.trim()) return result
  const seen = new Set()
  text.split('\n').forEach((rawLine, idx) => {
    const line = rawLine.trim()
    if (!line) return
    const address = line.split(/[,\s\t]+/)[0].trim()
    if (!address) return
    if (ethers.isAddress(address)) {
      const normalized = address.toLowerCase()
      if (seen.has(normalized)) {
        result.details.push({ line: idx + 1, raw: line, reason: 'duplicate' })
      } else {
        seen.add(normalized)
        result.addresses.push(address)
      }
    } else {
      result.details.push({ line: idx + 1, raw: line, reason: 'invalid-address' })
    }
  })
  return result
}

// Parse address + amount pairs (custom mode). Pure: first occurrence of a
// duplicate address wins; a duplicate carrying a DIFFERENT amount is flagged
// as 'duplicate-conflict' so the user can spot silently-dropped payouts.
const parseRecipientList = (text) => {
  const result = { recipients: [], amounts: [], details: [] }
  if (!text || !text.trim()) return result
  const seen = new Map() // normalized address -> first amount (number)
  text.split('\n').forEach((rawLine, idx) => {
    const line = rawLine.trim()
    if (!line) return
    const parts = line.split(/[,\s\t]+/).map(p => p.trim()).filter(p => p)
    if (parts.length === 0) return
    if (!ethers.isAddress(parts[0])) {
      result.details.push({ line: idx + 1, raw: line, reason: 'invalid-address' })
      return
    }
    if (parts.length === 1) {
      result.details.push({ line: idx + 1, raw: line, reason: 'missing-amount' })
      return
    }
    const amountStr = parts[1].replace('$', '')
    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount <= 0) {
      result.details.push({ line: idx + 1, raw: line, reason: 'invalid-amount' })
      return
    }
    const normalized = parts[0].toLowerCase()
    if (seen.has(normalized)) {
      const conflict = seen.get(normalized) !== amount
      result.details.push({ line: idx + 1, raw: line, reason: conflict ? 'duplicate-conflict' : 'duplicate' })
      return
    }
    seen.set(normalized, amount)
    result.recipients.push(parts[0])
    result.amounts.push(amountStr)
  })
  return result
}

// How many non-empty lines carry a second numeric column (used to detect a
// custom-format paste while in same-amount mode)
const countLinesWithAmounts = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const withAmounts = lines.filter(line => {
    const parts = line.split(/[,\s\t]+/).map(p => p.trim()).filter(Boolean)
    if (parts.length < 2) return false
    const amount = parseFloat(parts[1].replace('$', ''))
    return !isNaN(amount) && amount > 0
  }).length
  return { total: lines.length, withAmounts }
}

function App() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(null)
  const [network, setNetwork] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [activeTab, setActiveTab] = useState('native')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Tx lifecycle: idle → signing → pending → confirmed | failed (replaces the
  // old independent success/error strings that could show green + red at once)
  const [txStatus, setTxStatus] = useState(IDLE_TX_STATUS)
  // True while the wallet prompt is open (drives the confirm button spinner)
  const [submitting, setSubmitting] = useState(false)
  // After "Keep this list": relabel the send button as a deliberate re-send
  const [sendAgainHint, setSendAgainHint] = useState(false)
  const [showNetworkSwitcher, setShowNetworkSwitcher] = useState(false)
  const networkBtnRef = useRef(null)
  // Position for the portaled network dropdown on desktop (null on mobile → CSS bottom-sheet)
  const [netDropdownPos, setNetDropdownPos] = useState(null)
  // Network switcher a11y: panel ref + roving-tabindex index + was-open marker
  // so focus can be restored to the trigger when the panel closes
  const netDropdownRef = useRef(null)
  const [netFocusIndex, setNetFocusIndex] = useState(0)
  const netWasOpenRef = useRef(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  // Whether the visitor has entered the app (send console) without yet connecting a wallet.
  // Lets users explore and build a batch in a preview state; connecting is required only at send time.
  const [entered, setEntered] = useState(false)

  // FAQ toggle
  const [openFaq, setOpenFaq] = useState(null)

  // Header wallet pill popover (Copy address / View on explorer / Disconnect)
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const walletPillRef = useRef(null)
  const walletMenuRef = useRef(null)
  const copiedTimerRef = useRef(null)

  // Two-step Clear All: first activation arms "Confirm clear?" for ~3s
  const [confirmClear, setConfirmClear] = useState(false)
  const confirmClearTimerRef = useRef(null)

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
  // Token metadata lookup state (loading spinner + inline field error)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState(null)
  // Approval flow: exact-amount by default, unlimited only via explicit opt-in
  const [unlimitedApproval, setUnlimitedApproval] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState(IDLE_APPROVAL_STATUS)

  // Quick add
  const [quickAddAddress, setQuickAddAddress] = useState('')
  const [quickAddAmount, setQuickAddAmount] = useState('')

  // Confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingTx, setPendingTx] = useState(null)
  // Dialog focus management: panel ref + the element to restore focus to on close
  const confirmModalRef = useRef(null)
  const confirmReturnFocusRef = useRef(null)
  // Network fee estimate for the pending tx: null = estimating,
  // { error: true } = estimation failed, { native, usd } = ready
  const [gasEstimate, setGasEstimate] = useState(null)

  // Parse warnings (invalid addresses, duplicates)
  const [parseWarnings, setParseWarnings] = useState({ invalid: 0, duplicates: 0 })

  // "Your list includes amounts" suggestion banner dismissal (same-amount mode)
  const [modeHintDismissed, setModeHintDismissed] = useState(false)

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

  // Synchronous in-flight lock shared by send/approve: a double-click on the
  // autofocused confirm button must never queue a second wallet signature.
  // A ref (not state) so the check-and-set happens in the same tick.
  const txLockRef = useRef(false)
  // Timer that keeps the ApprovalCard mounted ~4s in its 'approved' state
  const approvedHoldRef = useRef(null)
  // Monotonic id so a stale token lookup can't overwrite a newer one
  const tokenLookupIdRef = useRef(0)

  // Network metadata + logos live in ./networks.js (single source of truth)
  // and are imported as NETWORKS / NETWORK_LOGOS / getNetwork.

  // Reset only wallet-derived state on disconnect. The drafted batch
  // (recipients, amounts, token address, mode, asset tab) deliberately
  // survives so disconnecting can never destroy a half-built list — the
  // explicit "Clear All" button remains the way to wipe the draft.
  const clearWalletState = () => {
    setAccount(null)
    setBalance(null)
    setNetwork(null)
    setChainId(null)
    setTokenInfo(null)
    setError(null)
    setTxStatus(IDLE_TX_STATUS)
    setSubmitting(false)
    setSendAgainHint(false)
    setGasEstimate(null)
    setTokenPrice(null)
    setEthPrice(null)
    setNeedsApproval(false)
    setApproving(false)
    setTokenLoading(false)
    setUnlimitedApproval(false)
    clearTimeout(approvedHoldRef.current)
    setApprovalStatus(IDLE_APPROVAL_STATUS)
    setShowNetworkSwitcher(false)
    setPendingTx(null)
    setShowConfirmation(false)
  }

  const getCurrentNetworkConfig = () => getNetwork(chainId)
  const getCurrentContractAddress = () => getContractAddress(chainId)
  const isNetworkSupported = () => chainId !== null && SUPPORTED_CHAINS.includes(Number(chainId))

  // Theme toggle function
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  // Open/close the network switcher. On desktop we anchor the portaled dropdown
  // to the button via its measured rect; on mobile we leave position to the CSS
  // bottom-sheet (netDropdownPos = null) so it sits flush at the viewport bottom.
  const toggleNetworkSwitcher = () => {
    if (showNetworkSwitcher) {
      setShowNetworkSwitcher(false)
      return
    }
    const isMobileSheet = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
    if (!isMobileSheet && networkBtnRef.current) {
      const rect = networkBtnRef.current.getBoundingClientRect()
      setNetDropdownPos({
        top: Math.round(rect.bottom + 8),
        right: Math.round(window.innerWidth - rect.right),
      })
    } else {
      setNetDropdownPos(null)
    }
    setShowNetworkSwitcher(true)
  }

  // Apply theme to body + keep the AppKit modal in sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { appkit?.setThemeMode?.(theme) } catch (e) { /* noop */ }
  }, [theme])

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
      const config = NETWORKS[id]
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
      // Clear the previous chain's prices before fetching so a stale quote is
      // never used for USD conversion on the new network
      setEthPrice(null)
      fetchNativePrice(chainId)
      // Clear old token price and info when switching networks
      setTokenPrice(null)
      setTokenInfo(null)
      // USD entries no longer mean the same thing on another chain
      setUseUsd(false)
      // Allowances are per-chain: drop the stale 'Approval Required' badge and
      // any in-flight approval card state until checkAllowance re-runs here
      setNeedsApproval(false)
      setUnlimitedApproval(false)
      clearTimeout(approvedHoldRef.current)
      setApprovalStatus(IDLE_APPROVAL_STATUS)
      // A pending/confirmed status from the previous chain no longer applies
      setTxStatus(IDLE_TX_STATUS)
    }
  }, [chainId])

  // Clear the approval-card hold timer if the app unmounts mid-countdown
  useEffect(() => () => clearTimeout(approvedHoldRef.current), [])

  // Preview-mode pricing: with no wallet connected there is no chainId, so
  // fetch the default network's (Ethereum) native price on mount to keep the
  // USD toggle usable while exploring. Cancelled as soon as a chain connects.
  useEffect(() => {
    if (chainId) return
    let cancelled = false
    getNativePrice(NETWORKS[1].coingeckoId)
      .then((price) => { if (!cancelled) setEthPrice(price) })
      .catch(() => { /* USD toggle simply stays disabled in preview */ })
    return () => { cancelled = true }
  }, [chainId])

  // Reset the USD toggle when the send mode or asset tab changes so a stale
  // USD figure is never silently reinterpreted as a token amount
  useEffect(() => {
    setUseUsd(false)
  }, [sendMode, activeTab])

  // Lock body scroll + close on Escape when modal open
  useEffect(() => {
    if (!showConfirmation && !showNetworkSwitcher) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        // Never dismiss the confirmation while a wallet signature is in flight
        if (showConfirmation && !submitting) setShowConfirmation(false)
        if (showNetworkSwitcher) setShowNetworkSwitcher(false)
      }
    }
    if (showConfirmation || showNetworkSwitcher) {
      document.body.style.overflow = 'hidden'
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [showConfirmation, showNetworkSwitcher, submitting])

  // Network switcher focus: on open, move focus to the currently-active
  // option (roving tabindex starts there); on close, restore the trigger.
  useEffect(() => {
    if (showNetworkSwitcher) {
      netWasOpenRef.current = true
      const ids = Object.keys(NETWORKS)
      const activeIdx = Math.max(0, ids.findIndex((id) => Number(id) === Number(chainId)))
      setNetFocusIndex(activeIdx)
      netDropdownRef.current?.querySelectorAll('.network-option')?.[activeIdx]?.focus()
    } else if (netWasOpenRef.current) {
      netWasOpenRef.current = false
      networkBtnRef.current?.focus()
    }
  }, [showNetworkSwitcher])

  // The portaled panel is positioned with frozen viewport coordinates, which
  // go stale across breakpoint/orientation changes — close it instead.
  useEffect(() => {
    if (!showNetworkSwitcher) return
    const close = () => setShowNetworkSwitcher(false)
    window.addEventListener('resize', close)
    window.addEventListener('orientationchange', close)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('orientationchange', close)
    }
  }, [showNetworkSwitcher])

  // Arrow-key navigation with roving tabindex + a simple focus trap
  // (Tab/Shift+Tab cycle within the panel) for the network listbox
  const handleNetworkListKeyDown = (e) => {
    const options = Array.from(netDropdownRef.current?.querySelectorAll('.network-option') || [])
    if (options.length === 0) return
    const current = options.indexOf(document.activeElement)
    let next = null
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      next = current < 0 ? 0 : (current + 1) % options.length
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      next = current < 0 ? options.length - 1 : (current - 1 + options.length) % options.length
    } else if (e.key === 'Home') {
      next = 0
    } else if (e.key === 'End') {
      next = options.length - 1
    }
    if (next === null) return
    e.preventDefault()
    setNetFocusIndex(next)
    options[next]?.focus()
  }

  // Confirmation dialog focus: initial focus lands on Cancel (never on the
  // irreversible confirm), and focus returns to the opener (the send button)
  // when the dialog closes.
  useEffect(() => {
    if (showConfirmation) {
      confirmReturnFocusRef.current = document.activeElement
      confirmModalRef.current?.querySelector('.btn-cancel')?.focus()
    } else if (confirmReturnFocusRef.current) {
      const el = confirmReturnFocusRef.current
      confirmReturnFocusRef.current = null
      if (el instanceof HTMLElement && document.contains(el)) el.focus()
    }
  }, [showConfirmation])

  // Tab/Shift+Tab focus trap for the confirmation dialog
  const handleConfirmModalKeyDown = (e) => {
    if (e.key !== 'Tab') return
    const modal = confirmModalRef.current
    if (!modal) return
    const focusables = Array.from(
      modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')
    )
    if (focusables.length === 0) {
      // All controls disabled while submitting — keep focus inside the dialog
      e.preventDefault()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (!modal.contains(document.activeElement)) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const fetchNativePrice = async (networkChainId) => {
    try {
      const config = getNetwork(networkChainId)
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
      const config = getNetwork(net.chainId)
      setNetwork(config.name || `Chain ${net.chainId}`)
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
    setWalletMenuOpen(false)
    try {
      await akDisconnect()
    } catch (err) {
      console.error('Error disconnecting wallet:', err)
    } finally {
      // Always clear wallet-derived state, regardless of disconnect success.
      // The drafted batch survives and the user stays in the send console in
      // preview mode — disconnecting must never throw away their work.
      clearWalletState()
      setEntered(true)
    }
  }

  // Close the wallet pill popover, optionally restoring focus to the pill
  const closeWalletMenu = (restoreFocus = true) => {
    setWalletMenuOpen(false)
    if (restoreFocus) walletPillRef.current?.focus()
  }

  const copyWalletAddress = async () => {
    if (!account) return
    try {
      await navigator.clipboard.writeText(account)
      setAddressCopied(true)
      clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setAddressCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  // Wallet menu: focus the first item on open; Escape closes (restoring focus
  // to the pill); clicking outside closes without stealing focus
  useEffect(() => {
    if (!walletMenuOpen) return
    walletMenuRef.current?.querySelector('button, a')?.focus()
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeWalletMenu(true)
      }
    }
    const handlePointer = (e) => {
      if (walletMenuRef.current?.contains(e.target) || walletPillRef.current?.contains(e.target)) return
      closeWalletMenu(false)
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handlePointer)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handlePointer)
    }
  }, [walletMenuOpen])

  // Clear the copied-confirmation and confirm-clear timers on unmount
  useEffect(() => () => {
    clearTimeout(copiedTimerRef.current)
    clearTimeout(confirmClearTimerRef.current)
  }, [])

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
          // chainParams come from the single source of truth in ./networks.js
          const params = NETWORKS[targetChainId]?.chainParams
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
          setError(isUserRejection(addErr) ? 'Network switch cancelled' : 'Failed to add network')
          console.error(addErr)
        }
      } else {
        // Calm copy for a dismissed wallet prompt; parseError for real failures
        // (never surface raw MetaMask/WalletConnect text verbatim)
        setError(isUserRejection(err) ? 'Network switch cancelled' : parseError(err))
        console.error(err)
      }
    }
  }

  // Parse the textarea once per change; mode decides the parser. Details carry
  // every skipped row ({ line, raw, reason }) for the per-line warning list.
  const parsedList = useMemo(() => {
    if (sendMode === 'same') {
      const { addresses, details } = parseAddressList(recipients)
      return { recipients: addresses, amounts: null, details }
    }
    return parseRecipientList(recipients)
  }, [recipients, sendMode])
  const parseDetails = parsedList.details

  const getRecipientsAndAmounts = () => {
    if (sendMode === 'same') {
      const addresses = parsedList.recipients
      let amount = parseFloat(sameAmount) || 0

      // Convert USD to crypto. If USD mode is on but the price is missing we
      // must NOT pass the raw USD figure through as a token amount — zero it
      // out so totals/sends can never use the wrong unit.
      if (useUsd) {
        const usdPrice = activeTab === 'native' ? ethPrice : tokenPrice
        amount = usdPrice ? amount / usdPrice : 0
      }

      return {
        recipients: addresses,
        amounts: addresses.map(() => amount.toString())
      }
    } else {
      const { recipients: addrs, amounts } = parsedList

      if (useUsd) {
        const usdPrice = activeTab === 'native' ? ethPrice : tokenPrice
        return {
          recipients: addrs,
          // Same unit-safety rule as above: no price → zeroed amounts
          amounts: usdPrice ? amounts.map(a => (parseFloat(a) / usdPrice).toString()) : amounts.map(() => '0')
        }
      }

      return { recipients: addrs, amounts }
    }
  }

  // Update parse warnings when the parsed list changes (counts derive from
  // the per-line details so both stay in sync)
  useEffect(() => {
    const duplicates = parseDetails.filter(d => d.reason === 'duplicate' || d.reason === 'duplicate-conflict').length
    setParseWarnings({
      invalid: parseDetails.length - duplicates,
      duplicates,
    })
  }, [parseDetails])

  // Reset the mode-hint dismissal when the list is cleared
  useEffect(() => {
    if (!recipients.trim()) setModeHintDismissed(false)
  }, [recipients])

  // Same-amount mode: when most pasted rows carry their own amount column the
  // per-row amounts are discarded — suggest switching to Custom amounts mode.
  const showModeHint = useMemo(() => {
    if (sendMode !== 'same' || !recipients.trim()) return false
    const { total, withAmounts } = countLinesWithAmounts(recipients)
    return total > 0 && withAmounts > total / 2
  }, [recipients, sendMode])

  // Rewrite the textarea keeping only the lines that parsed successfully
  const cleanRecipientList = () => {
    const badLines = new Set(parseDetails.map(d => d.line))
    const kept = recipients
      .split('\n')
      .filter((line, idx) => line.trim() && !badLines.has(idx + 1))
    setRecipients(kept.join('\n'))
  }

  const getTotalAmount = () => {
    const { amounts } = getRecipientsAndAmounts()
    return amounts.reduce((sum, a) => sum + parseFloat(a || 0), 0)
  }

  const getRecipientCount = () => parsedList.recipients.length

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
    setTxStatus(IDLE_TX_STATUS)
    setSendAgainHint(false)
  }

  // Two-step Clear All: the first activation arms a ~3s "Confirm clear?"
  // window; only a second activation actually wipes the pasted list.
  const handleClearAllClick = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      clearTimeout(confirmClearTimerRef.current)
      confirmClearTimerRef.current = setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    clearTimeout(confirmClearTimerRef.current)
    setConfirmClear(false)
    clearAll()
  }

  // The "Send again to N addresses" hint only holds while the kept list is
  // untouched — any edit to the batch turns it back into a normal send.
  useEffect(() => {
    setSendAgainHint(false)
  }, [recipients, sameAmount, sendMode, activeTab, tokenAddress, chainId])

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
    if (addrs.length > APP_CONFIG.MAX_RECIPIENTS) {
      setError(`Maximum ${APP_CONFIG.MAX_RECIPIENTS} recipients per batch — you have ${addrs.length}`)
      return
    }
    if (useUsd && !ethPrice) {
      setError('USD price unavailable — switch to token amounts')
      return
    }
    if (balanceCheck.insufficient) {
      setError(balanceCheck.warning)
      return
    }
    const total = amounts.reduce((sum, a) => sum + parseFloat(a || 0), 0)
    setPendingTx({
      type: 'native',
      recipients: addrs,
      amounts,
      total,
      symbol: nativeSymbol,
      usdTotal: ethPrice ? total * ethPrice : null,
      // Confirmation honesty: how many pasted rows were dropped by parsing
      skippedRows: parseDetails.length,
      totalRows: addrs.length + parseDetails.length,
      // Make the signed unit unambiguous when amounts were entered in USD
      usdMode: useUsd,
      priceUsed: ethPrice
    })
    setShowConfirmation(true)
  }

  const sendNative = async () => {
    // Synchronous double-submit guard: one wallet signature per click-through
    if (txLockRef.current) return
    txLockRef.current = true

    // Freeze the explorer base now — a later network switch must not rebuild
    // this tx's link against the new chain's explorer
    const explorerBase = getCurrentNetworkConfig().explorer

    try {
      setSubmitting(true)
      setLoading(true)
      setError(null)
      setTxStatus({ stage: 'signing', hash: null, explorerBase, message: null })

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
      const total = amounts.reduce((sum, a) => sum + parseFloat(a || 0), 0)

      const tx = await contract.sendNative(addrs, amountsInWei, { value: totalWei })
      // Wallet prompt resolved — the confirmation modal can close now
      setShowConfirmation(false)
      setSubmitting(false)
      setTxStatus({ stage: 'pending', hash: tx.hash, explorerBase, message: null })

      await tx.wait()
      setTxStatus({
        stage: 'confirmed',
        hash: tx.hash,
        explorerBase,
        message: null,
        total,
        symbol: nativeSymbol,
        count: addrs.length,
      })
      // Refresh failures must not flip a confirmed tx into a 'failed' status
      try { await updateBalance(account) } catch (e) { console.error('Balance refresh failed:', e) }

    } catch (err) {
      console.error(err)
      setShowConfirmation(false)
      setTxStatus({ stage: 'failed', hash: null, explorerBase, message: parseError(err) })
    } finally {
      setLoading(false)
      setSubmitting(false)
      setPendingTx(null)
      txLockRef.current = false
    }
  }

  const loadTokenInfo = async () => {
    // Monotonic id: a lookup that finishes after the address/chain changed
    // again must never overwrite the newer lookup's state
    const reqId = ++tokenLookupIdRef.current

    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      setTokenInfo(null)
      setTokenPrice(null)
      setTokenError(null)
      setTokenLoading(false)
      setNeedsApproval(false)
      return
    }

    setTokenLoading(true)
    setTokenError(null)

    // Connected: read through the wallet provider (includes the user's
    // balance). Preview mode: read-only lookup via the selected network's
    // public RPC so the demo works before a wallet is connected.
    const netConfig = NETWORKS[Number(chainId)] || NETWORKS[1]
    const wcProvider = getProvider()
    const hasWallet = Boolean(account && wcProvider)

    try {
      const provider = hasWallet
        ? new ethers.BrowserProvider(wcProvider)
        : new ethers.JsonRpcProvider(netConfig.rpcUrl)
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)

      const [name, symbol, decimals, userBalance] = await Promise.all([
        token.name(),
        token.symbol(),
        token.decimals(),
        hasWallet ? token.balanceOf(account) : Promise.resolve(null)
      ])

      if (reqId !== tokenLookupIdRef.current) return

      setTokenInfo({
        name,
        symbol,
        decimals: Number(decimals),
        // null balance = preview mode ("Connect to load your balance")
        balance: userBalance !== null ? ethers.formatUnits(userBalance, decimals) : null
      })

      // Fetch price - won't throw even if unavailable
      fetchTokenPrice(tokenAddress)
    } catch (err) {
      console.error('Failed to load token info:', err)
      if (reqId !== tokenLookupIdRef.current) return
      setTokenInfo(null)
      setTokenPrice(null)
      setNeedsApproval(false)
      setTokenError(`No ERC-20 token found at this address on ${netConfig.name} — check the address or switch networks`)
    } finally {
      if (reqId === tokenLookupIdRef.current) setTokenLoading(false)
    }
  }

  // chainId is a dependency so the token reloads after a network switch
  // instead of forcing the user to cut and re-paste the address
  useEffect(() => {
    if (!tokenAddress) {
      // Field cleared: drop stale metadata, errors, and approval state
      tokenLookupIdRef.current++
      setTokenInfo(null)
      setTokenPrice(null)
      setTokenError(null)
      setTokenLoading(false)
      setNeedsApproval(false)
      return
    }
    loadTokenInfo()
  }, [tokenAddress, account, chainId])

  // Exact allowance the batch needs: the sum of the per-recipient unit
  // amounts, mirroring sendERC20's math so an exact approval can't fall a
  // rounding-dust short of the transfer total.
  const getBatchTotalInUnits = () => {
    const { amounts } = getRecipientsAndAmounts()
    if (amounts.length === 0 || !tokenInfo) return 0n
    return amounts
      .map(a => ethers.parseUnits((parseFloat(a) || 0).toFixed(tokenInfo.decimals), tokenInfo.decimals))
      .reduce((sum, amt) => sum + amt, 0n)
  }

  const checkAllowance = async () => {
    if (!account || !tokenAddress || !tokenInfo) return

    const contractAddress = getCurrentContractAddress()
    if (!contractAddress) return

    const totalInUnits = getBatchTotalInUnits()
    if (totalInUnits === 0n) return

    try {
      const wcProvider = getProvider()
      if (!wcProvider) return
      const provider = new ethers.BrowserProvider(wcProvider)
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
      const allowance = await token.allowance(account, contractAddress)

      setNeedsApproval(allowance < totalInUnits)
    } catch (err) {
      console.error('Failed to check allowance:', err)
    }
  }

  // chainId/account included: allowances are per-chain and per-wallet, so a
  // network switch must re-check instead of trusting the previous answer
  useEffect(() => {
    if (account && tokenInfo && recipients) {
      checkAllowance()
    }
  }, [recipients, tokenInfo, sameAmount, sendMode, useUsd, chainId, account])

  const approveToken = async () => {
    // Same synchronous lock as the send paths: no double wallet prompts
    if (txLockRef.current) return
    txLockRef.current = true

    const explorerBase = getCurrentNetworkConfig().explorer

    try {
      setApproving(true)
      setError(null)

      const contractAddress = getCurrentContractAddress()
      if (!contractAddress) {
        throw new Error('Contract not deployed on this network')
      }

      // Default to an EXACT allowance covering the current batch total;
      // unlimited only when the user ticked the ApprovalCard checkbox.
      const totalInUnits = getBatchTotalInUnits()
      if (!unlimitedApproval && totalInUnits === 0n) {
        throw new Error('Add recipients and amounts before approving')
      }
      const approvalValue = unlimitedApproval ? ethers.MaxUint256 : totalInUnits

      const wcProvider = getProvider()
      const provider = new ethers.BrowserProvider(wcProvider)
      const signer = await provider.getSigner()
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer)

      setApprovalStatus({ stage: 'wallet', hash: null, explorerBase })
      const tx = await token.approve(contractAddress, approvalValue)
      setApprovalStatus({ stage: 'pending', hash: tx.hash, explorerBase })

      await tx.wait()
      setApprovalStatus({ stage: 'approved', hash: tx.hash, explorerBase })
      setNeedsApproval(false)

      // Keep the card visible in its confirmed state for ~4s before revealing
      // the send flow, so the approval never appears to vanish silently
      clearTimeout(approvedHoldRef.current)
      approvedHoldRef.current = setTimeout(() => {
        setApprovalStatus(IDLE_APPROVAL_STATUS)
      }, 4000)
    } catch (err) {
      setApprovalStatus(IDLE_APPROVAL_STATUS)
      setError(parseError(err))
    } finally {
      setApproving(false)
      txLockRef.current = false
    }
  }

  // Show confirmation before sending ERC20 token
  const confirmSendERC20 = () => {
    const { recipients: addrs, amounts } = getRecipientsAndAmounts()
    if (addrs.length === 0) {
      setError('No valid recipients')
      return
    }
    if (addrs.length > APP_CONFIG.MAX_RECIPIENTS) {
      setError(`Maximum ${APP_CONFIG.MAX_RECIPIENTS} recipients per batch — you have ${addrs.length}`)
      return
    }
    if (useUsd && !tokenPrice) {
      setError('USD price unavailable — switch to token amounts')
      return
    }
    if (balanceCheck.insufficient) {
      setError(balanceCheck.warning)
      return
    }
    const total = amounts.reduce((sum, a) => sum + parseFloat(a || 0), 0)
    setPendingTx({
      type: 'erc20',
      recipients: addrs,
      amounts,
      total,
      symbol: tokenInfo?.symbol || 'tokens',
      usdTotal: tokenPrice ? total * tokenPrice : null,
      // Confirmation honesty: how many pasted rows were dropped by parsing
      skippedRows: parseDetails.length,
      totalRows: addrs.length + parseDetails.length,
      // Make the signed unit unambiguous when amounts were entered in USD
      usdMode: useUsd,
      priceUsed: tokenPrice
    })
    setShowConfirmation(true)
  }

  const sendERC20 = async () => {
    // Synchronous double-submit guard: one wallet signature per click-through
    if (txLockRef.current) return
    txLockRef.current = true

    // Freeze the explorer base at send time (see sendNative)
    const explorerBase = getCurrentNetworkConfig().explorer

    try {
      setSubmitting(true)
      setLoading(true)
      setError(null)
      setTxStatus({ stage: 'signing', hash: null, explorerBase, message: null })

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
      const total = amounts.reduce((sum, a) => sum + parseFloat(a || 0), 0)

      const tx = await contract.sendERC20(tokenAddress, addrs, amountsInUnits)
      // Wallet prompt resolved — the confirmation modal can close now
      setShowConfirmation(false)
      setSubmitting(false)
      setTxStatus({ stage: 'pending', hash: tx.hash, explorerBase, message: null })

      await tx.wait()
      setTxStatus({
        stage: 'confirmed',
        hash: tx.hash,
        explorerBase,
        message: null,
        total,
        symbol: tokenInfo?.symbol || 'tokens',
        count: addrs.length,
      })
      // Refresh failures must not flip a confirmed tx into a 'failed' status
      try { await loadTokenInfo() } catch (e) { console.error('Token refresh failed:', e) }

    } catch (err) {
      console.error(err)
      setShowConfirmation(false)
      setTxStatus({ stage: 'failed', hash: null, explorerBase, message: parseError(err) })
    } finally {
      setLoading(false)
      setSubmitting(false)
      setPendingTx(null)
      txLockRef.current = false
    }
  }

  // Estimate the network fee for the pending batch when the confirmation
  // modal opens, so signers see a cost figure before the wallet prompt.
  useEffect(() => {
    if (!showConfirmation || !pendingTx || !account) {
      setGasEstimate(null)
      return
    }
    let cancelled = false
    const estimateFee = async () => {
      try {
        const wcProvider = getProvider()
        const contractAddr = getCurrentContractAddress()
        if (!wcProvider || !contractAddr) throw new Error('No provider')
        const provider = new ethers.BrowserProvider(wcProvider)
        const signer = await provider.getSigner()
        const contract = new ethers.Contract(contractAddr, MULTISENDER_ABI, signer)

        let gasUnits
        if (pendingTx.type === 'native') {
          const amountsInWei = pendingTx.amounts.map(a => ethers.parseEther(parseFloat(a).toFixed(18)))
          const totalWei = amountsInWei.reduce((sum, amt) => sum + amt, 0n)
          gasUnits = await contract.sendNative.estimateGas(pendingTx.recipients, amountsInWei, { value: totalWei })
        } else {
          const decimals = tokenInfo?.decimals ?? 18
          const amountsInUnits = pendingTx.amounts.map(a => ethers.parseUnits(parseFloat(a).toFixed(decimals), decimals))
          gasUnits = await contract.sendERC20.estimateGas(tokenAddress, pendingTx.recipients, amountsInUnits)
        }

        const feeData = await provider.getFeeData()
        const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice
        if (!gasPrice) throw new Error('No gas price available')
        const feeNative = parseFloat(ethers.formatEther(gasUnits * gasPrice))
        if (!cancelled) {
          setGasEstimate({ native: feeNative, usd: ethPrice ? feeNative * ethPrice : null })
        }
      } catch (err) {
        console.error('Gas estimation failed:', err)
        if (!cancelled) setGasEstimate({ error: true })
      }
    }
    setGasEstimate(null)
    estimateFee()
    return () => { cancelled = true }
  }, [showConfirmation, pendingTx])

  // Post-success choices (the result panel that replaces the send card)
  const startNewBatch = () => {
    setRecipients('')
    setSameAmount('')
    setQuickAddAddress('')
    setQuickAddAmount('')
    setTokenAddress('')
    setTokenPrice(null)
    setNeedsApproval(false)
    setUnlimitedApproval(false)
    clearTimeout(approvedHoldRef.current)
    setApprovalStatus(IDLE_APPROVAL_STATUS)
    setTxStatus(IDLE_TX_STATUS)
    setSendAgainHint(false)
    setError(null)
  }

  const keepListAfterSend = () => {
    setTxStatus(IDLE_TX_STATUS)
    setSendAgainHint(true)
  }

  const dismissApprovalCard = () => {
    clearTimeout(approvedHoldRef.current)
    setApprovalStatus(IDLE_APPROVAL_STATUS)
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

  // Live token-address field validation (as the user types) + lookup error
  const tokenAddressFormatInvalid = tokenAddress !== '' && !ethers.isAddress(tokenAddress)
  const tokenFieldError = tokenAddressFormatInvalid
    ? 'Invalid address format — expected 0x followed by 40 hex characters'
    : (!tokenLoading && tokenAddress && !tokenInfo && tokenError) ? tokenError : null

  // Human-readable exact allowance for the ApprovalCard ("120.5 USDC")
  const approvalAmountLabel = tokenInfo && totalAmount > 0
    ? `${formatAmount(totalAmount)} ${tokenInfo.symbol}`
    : undefined

  // USD mode with no live price: conversion is impossible, so block sending
  // instead of silently treating USD figures as token amounts
  const usdPriceMissing = useUsd && !price

  // Batch size guard (contract/UX limit from config)
  const maxRecipientsExceeded = recipientCount > APP_CONFIG.MAX_RECIPIENTS

  // Balance pre-check: compare the batch total against the wallet's balance
  // before the wallet ever sees the transaction.
  // - native: hard-block only when the total ALONE exceeds the balance — gas
  //   is additive, not proportional to the value sent, so a multiplicative
  //   buffer must never block. When the total fits but leaves little headroom
  //   (DEFAULT_GAS_BUFFER), surface a non-blocking warning and let the
  //   wallet's own gas estimation flag any true shortfall
  // - ERC-20: total vs token balance, plus a non-zero native balance for gas
  const balanceCheck = (() => {
    const none = { insufficient: false, warning: null, label: null }
    if (!account || recipientCount === 0 || totalAmount <= 0 || usdPriceMissing) return none
    const nativeBalanceNum = balance !== null ? parseFloat(balance) : null
    if (activeTab === 'native') {
      if (nativeBalanceNum === null) return none
      if (totalAmount > nativeBalanceNum) {
        return {
          insufficient: true,
          warning: `Total exceeds your balance (need ${formatAmount(totalAmount)} ${nativeSymbol} before gas, have ${formatAmount(nativeBalanceNum)} ${nativeSymbol})`,
          label: `Insufficient ${nativeSymbol} — need ${formatAmount(totalAmount)}, have ${formatAmount(nativeBalanceNum)}`,
        }
      }
      if (totalAmount * APP_CONFIG.DEFAULT_GAS_BUFFER > nativeBalanceNum) {
        return {
          insufficient: false,
          warning: `Total is close to your balance (${formatAmount(totalAmount)} of ${formatAmount(nativeBalanceNum)} ${nativeSymbol}) — make sure enough is left for gas`,
          label: null,
        }
      }
      return none
    }
    if (!tokenInfo) return none
    const tokenBalanceNum = parseFloat(tokenInfo.balance)
    if (totalAmount > tokenBalanceNum) {
      return {
        insufficient: true,
        warning: `Total exceeds your balance (need ${formatAmount(totalAmount)} ${tokenInfo.symbol}, have ${formatAmount(tokenBalanceNum)} ${tokenInfo.symbol})`,
        label: `Insufficient ${tokenInfo.symbol} — need ${formatAmount(totalAmount)}, have ${formatAmount(tokenBalanceNum)}`,
      }
    }
    if (nativeBalanceNum !== null && nativeBalanceNum <= 0) {
      return {
        insufficient: true,
        warning: `You have 0 ${nativeSymbol} — gas fees can't be paid for this transaction`,
        label: `No ${nativeSymbol} for gas`,
      }
    }
    return none
  })()
  // Honest, verifiable facts only — no invented usage numbers
  const heroStats = [
    { value: `${SUPPORTED_CHAINS.length}`, label: 'Networks supported' },
    { value: '0%', label: 'Platform fee' },
    { value: `Up to ${APP_CONFIG.MAX_RECIPIENTS}`, label: 'Recipients per batch' },
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
          <img src="/logo-header.png" alt="" className="logo-img" />
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
                  ref={networkBtnRef}
                  className="network-switcher-btn"
                  onClick={toggleNetworkSwitcher}
                  aria-haspopup="listbox"
                  aria-expanded={showNetworkSwitcher}
                  aria-label={`Network: ${network}. Click to switch.`}
                >
                  <span className="network-btn-logo">
                    {NETWORK_LOGOS[networkConfig.logo] || <span className="network-dot"></span>}
                  </span>
                  <span className="network-name">{network}</span>
                  <svg className={`network-chevron ${showNetworkSwitcher ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {showNetworkSwitcher && createPortal(
                  <>
                    <div className="network-switcher-backdrop" onClick={() => setShowNetworkSwitcher(false)}></div>
                    <div
                      ref={netDropdownRef}
                      className="network-switcher-dropdown"
                      style={netDropdownPos ? { top: `${netDropdownPos.top}px`, right: `${netDropdownPos.right}px` } : undefined}
                      role="listbox"
                      aria-label="Switch network"
                      onKeyDown={handleNetworkListKeyDown}
                    >
                      <div className="network-switcher-title">Switch Network</div>
                      {Object.entries(NETWORKS).map(([id, config], idx) => (
                        <button
                           key={id}
                           className={`network-option ${Number(chainId) === Number(id) ? 'active' : ''}`}
                           role="option"
                           aria-selected={Number(chainId) === Number(id)}
                           tabIndex={idx === netFocusIndex ? 0 : -1}
                           onClick={async () => {
                             await switchNetwork(Number(id))
                           }}
                         >
                          <span className="network-option-icon">
                            {NETWORK_LOGOS[config.logo]}
                          </span>
                          <span className="network-option-name">{config.name}</span>
                          {Number(chainId) === Number(id) && <span className="network-check">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body
                )}
              </div>
               <div className="wallet-menu-wrap">
                 <button
                   ref={walletPillRef}
                   className="wallet-pill"
                   onClick={() => setWalletMenuOpen((open) => !open)}
                   aria-haspopup="menu"
                   aria-expanded={walletMenuOpen}
                   aria-label={`Wallet menu for ${account.slice(0, 4)}…${account.slice(-2)}`}
                 >
                   <div className="wallet-status"></div>
                   <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                 </button>
                 {walletMenuOpen && (
                   <div className="wallet-menu" role="menu" aria-label="Wallet actions" ref={walletMenuRef}>
                     <button role="menuitem" className="wallet-menu-item" onClick={copyWalletAddress}>
                       {addressCopied ? (
                         <span className="wallet-menu-copied" role="status">Copied</span>
                       ) : (
                         'Copy address'
                       )}
                     </button>
                     <a
                       role="menuitem"
                       className="wallet-menu-item"
                       href={`${explorerUrl}/address/${account}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       onClick={() => closeWalletMenu(true)}
                     >
                       View on explorer ↗
                     </a>
                     <button role="menuitem" className="wallet-menu-item danger" onClick={handleDisconnectWallet}>
                       Disconnect
                     </button>
                   </div>
                 )}
               </div>
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
                      <div className="chain-item">{NETWORK_LOGOS.ethereum}<span>Ethereum</span></div>
                      <div className="chain-item">{NETWORK_LOGOS.base}<span>Base</span></div>
                      <div className="chain-item">{NETWORK_LOGOS.polygon}<span>Polygon</span></div>
                      <div className="chain-item">{NETWORK_LOGOS.arbitrum}<span>Arbitrum</span></div>
                      <div className="chain-item">{NETWORK_LOGOS.optimism}<span>Optimism</span></div>
                      <div className="chain-item">{NETWORK_LOGOS.bnb}<span>BNB</span></div>
                      <div className="chain-item">{NETWORK_LOGOS.sepolia}<span>Sepolia <span className="chain-tag-testnet">Testnet</span></span></div>
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

            <section className="contract-section modern-contract" id="contracts">
              <div className="contract-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Verified · Non-custodial</span>
              </div>
              <p className="contract-links-note">Inspect the deployed MultiSend contract on every supported network:</p>
              <div className="contract-links">
                {Object.entries(MULTISENDER_ADDRESSES).map(([id, addr]) => {
                  const cfg = NETWORKS[Number(id)]
                  if (!cfg) return null
                  return (
                    <a
                      key={id}
                      href={`${cfg.explorer}/address/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dashboard-chip link contract-chip"
                    >
                      {cfg.name} {addr.slice(0, 6)}...{addr.slice(-4)}
                    </a>
                  )
                })}
              </div>
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

            <footer className="footer-main">
              <div className="footer-top">
                <div className="footer-brand">
                  <div className="footer-brand-row">
                    <img src="/logo-header.png" alt="" className="footer-logo" />
                    <span className="footer-name">MultiSend</span>
                  </div>
                  <p className="footer-tagline">Batch native and ERC-20 transfers in one transaction.</p>
                </div>
                <div className="footer-contracts">
                  <span className="footer-label" id="footer-contracts-label">Verified contracts</span>
                  <div className="footer-chips" aria-labelledby="footer-contracts-label">
                    <a className="footer-chip" href="#contracts">All networks</a>
                    {Object.entries(MULTISENDER_ADDRESSES).map(([id, addr]) => {
                      const cfg = NETWORKS[Number(id)]
                      if (!cfg) return null
                      return (
                        <a
                          key={id}
                          className="footer-chip"
                          href={`${cfg.explorer}/address/${addr}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${cfg.name} contract on block explorer`}
                        >
                          {cfg.name}
                          {Number(id) === 11155111 && <span className="footer-chip-tag">testnet</span>}
                        </a>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="footer-bottom">
                <span className="footer-note">Non-custodial — every transaction is signed in your own wallet and funds move directly to recipients.</span>
                <span className="footer-meta">
                  © MultiSend
                  <span aria-hidden="true">·</span>
                  <a href="https://x.com/zx_joy_" target="_blank" rel="noopener noreferrer">@zx_joy_ on X</a>
                </span>
              </div>
            </footer>
          </div>
        ) : (
          <div className="dashboard">
            <div className="dashboard-hero">
              <div className="page-header">
                <span className="page-kicker">Distribution Console</span>
                <h1 className="page-title">
                  {activeTab === 'native' ? `Send ${nativeSymbol}` : (tokenInfo ? `Send ${tokenInfo.symbol}` : 'Send Token')}
                </h1>
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
                  {SUPPORTED_CHAINS.map((id) => (
                    <button key={id} onClick={() => switchNetwork(id)}>
                      {NETWORKS[id]?.name || `Chain ${id}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <SummaryBar
              recipientCount={recipientCount}
              totalAmount={totalAmount}
              usdValue={price ? totalAmount * price : undefined}
              symbol={symbol}
              isApprovalRequired={activeTab === 'erc20' && needsApproval}
              balanceWarning={balanceCheck.warning}
              className="dashboard-summary"
            />

            <div className="dashboard-layout dashboard-layout-modern">
              <div className="main-content">
                {txStatus.stage === 'confirmed' ? (
                  /* Post-success result panel: replaces the still-armed send
                     card so one more click-through can't re-send the batch */
                  <div className="send-card send-card-modern tx-result-panel" role="status" aria-live="polite">
                    <div className="tx-result-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    </div>
                    <h2 className="tx-result-title">Batch sent</h2>
                    <p className="tx-result-summary">
                      Sent <strong>{formatAmount(txStatus.total || 0)} {txStatus.symbol}</strong> to{' '}
                      <strong>{txStatus.count} {txStatus.count === 1 ? 'address' : 'addresses'}</strong> in one transaction.
                    </p>
                    {txStatus.hash && txStatus.explorerBase && (
                      <a
                        className="tx-result-link"
                        href={`${txStatus.explorerBase}/tx/${txStatus.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View transaction on explorer ↗
                      </a>
                    )}
                    <div className="tx-result-actions">
                      <button className="tx-result-btn primary" onClick={startNewBatch}>
                        Start new batch
                      </button>
                      <button className="tx-result-btn ghost" onClick={keepListAfterSend}>
                        Keep this list
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="send-card send-card-modern">
                  <div className="send-card-top">
                    <div>
                      <div className="section-label">Asset</div>
                      <div className="asset-switch" role="group" aria-label="Asset type">
                        <button
                          className={`asset-switch-btn ${activeTab === 'native' ? 'active' : ''}`}
                          aria-pressed={activeTab === 'native'}
                          onClick={() => { setActiveTab('native'); setError(null); setTxStatus(IDLE_TX_STATUS) }}
                        >
                          <span className="asset-switch-icon">{NETWORK_LOGOS[networkConfig.logo]}</span>
                          <span>Send {nativeSymbol}</span>
                        </button>
                        <button
                          className={`asset-switch-btn ${activeTab === 'erc20' ? 'active' : ''}`}
                          aria-pressed={activeTab === 'erc20'}
                          onClick={() => { setActiveTab('erc20'); setError(null); setTxStatus(IDLE_TX_STATUS) }}
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
                      <label htmlFor="token-address-input">Token Contract Address</label>
                      <div className={`token-input-wrap ${tokenLoading ? 'loading' : ''}`}>
                        <input
                          id="token-address-input"
                          type="text"
                          value={tokenAddress}
                          onChange={(e) => setTokenAddress(e.target.value.trim())}
                          placeholder="0x..."
                          className={`input-token ${tokenFieldError ? 'input-token-error' : ''}`}
                          aria-invalid={Boolean(tokenFieldError)}
                          aria-describedby={tokenFieldError ? 'token-address-error' : undefined}
                        />
                        {tokenLoading && <span className="token-input-spinner" aria-hidden="true"></span>}
                      </div>
                      {tokenLoading && (
                        <div className="token-loading-note" role="status">Looking up token…</div>
                      )}
                      {!tokenLoading && tokenFieldError && (
                        <div id="token-address-error" className="token-field-error" role="alert">
                          {tokenFieldError}
                        </div>
                      )}
                      {tokenInfo && !tokenLoading && (
                        <div className="token-badge">
                          <span className="token-name">{tokenInfo.name}</span>
                          <span className="token-symbol">{tokenInfo.symbol}</span>
                          {tokenInfo.balance !== null ? (
                            <span className="token-balance">{parseFloat(tokenInfo.balance).toFixed(2)} available</span>
                          ) : (
                            <span className="token-balance preview">Connect to load your balance</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <ModeSelector activeMode={sendMode} onChange={setSendMode} />

                  {sendMode === 'same' && (
                    <div className="amount-section">
                      <label htmlFor="same-amount-input">Amount per recipient</label>
                      <div className="amount-input-wrapper">
                        <input
                          id="same-amount-input"
                          type="number"
                          value={sameAmount}
                          onChange={(e) => setSameAmount(e.target.value)}
                          placeholder="0.00"
                          className="input-amount"
                          step="any"
                          aria-invalid={usdPriceMissing || undefined}
                          aria-describedby={[
                            useUsd && price && sameAmount ? 'same-amount-conversion' : null,
                            usdPriceMissing ? 'same-amount-usd-note' : null,
                          ].filter(Boolean).join(' ') || undefined}
                        />
                        <div className="amount-toggle" role="group" aria-label="Amount currency">
                          <button
                            className={!useUsd ? 'active' : ''}
                            aria-pressed={!useUsd}
                            onClick={() => setUseUsd(false)}
                          >
                            {symbol}
                          </button>
                          <button
                            className={useUsd ? 'active' : ''}
                            aria-pressed={useUsd}
                            onClick={() => setUseUsd(true)}
                            disabled={!price}
                          >
                            USD
                          </button>
                        </div>
                      </div>
                      {useUsd && price && sameAmount && (
                        <div id="same-amount-conversion" className="conversion-hint">
                          ≈ {(parseFloat(sameAmount) / price).toFixed(6)} {symbol} per recipient
                        </div>
                      )}
                      {usdPriceMissing && (
                        <div id="same-amount-usd-note" className="usd-price-note" role="status">
                          USD pricing is unavailable right now — switch back to {symbol} amounts to continue.
                        </div>
                      )}
                    </div>
                  )}

                  {sendMode === 'custom' && (
                    <div className="custom-usd-section">
                      <div className="custom-usd-row">
                        <span className="custom-usd-label">Amounts are in</span>
                        <div className="amount-toggle" role="group" aria-label="Amount currency">
                          <button
                            className={!useUsd ? 'active' : ''}
                            aria-pressed={!useUsd}
                            onClick={() => setUseUsd(false)}
                          >
                            {symbol}
                          </button>
                          <button
                            className={useUsd ? 'active' : ''}
                            aria-pressed={useUsd}
                            onClick={() => setUseUsd(true)}
                            disabled={!price}
                          >
                            USD
                          </button>
                        </div>
                        {useUsd && price && (
                          <span className="custom-usd-hint">converted @ ${formatPrice(price)}/{symbol} at send time</span>
                        )}
                      </div>
                      {usdPriceMissing && (
                        <div className="usd-price-note" role="status">
                          USD pricing is unavailable right now — switch back to {symbol} amounts to continue.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="recipients-section modern">
                    <div className="recipients-header modern">
                      <div>
                        <label>
                          {sendMode === 'same'
                            ? 'Recipient Addresses'
                            : useUsd ? 'Recipients & Amounts (USD)' : 'Recipients & Amounts'}
                        </label>
                        <p className="recipients-subtitle">
                          {sendMode === 'same'
                            ? 'Paste one address per line or build your list inline.'
                            : useUsd
                              ? 'Use address and amount pairs — amounts in USD, one recipient per line.'
                              : 'Use address and amount pairs, one recipient per line.'}
                        </p>
                      </div>
                      <button
                        className={`btn-clear ${confirmClear ? 'confirming' : ''}`}
                        onClick={handleClearAllClick}
                        aria-live="polite"
                      >
                        {confirmClear ? 'Confirm clear?' : 'Clear All'}
                      </button>
                    </div>

                    {showModeHint && !modeHintDismissed && (
                      <div className="mode-hint-banner" role="status">
                        <span className="mode-hint-text">Your list includes amounts — switch to Custom amounts mode?</span>
                        <div className="mode-hint-actions">
                          <button
                            type="button"
                            className="mode-hint-switch"
                            onClick={() => setSendMode('custom')}
                          >
                            Switch to Custom amounts
                          </button>
                          <button
                            type="button"
                            className="mode-hint-dismiss"
                            onClick={() => setModeHintDismissed(true)}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    <RecipientInput
                      value={recipients}
                      onChange={setRecipients}
                      sendMode={sendMode}
                      parseWarnings={parseWarnings}
                      parseDetails={parseDetails}
                      onCleanList={cleanRecipientList}
                      quickAddAddress={quickAddAddress}
                      onQuickAddAddressChange={setQuickAddAddress}
                      quickAddAmount={quickAddAmount}
                      onQuickAddAmountChange={setQuickAddAmount}
                      onQuickAdd={addQuickRecipient}
                      isQuickAddDisabled={isQuickAddDisabled}
                    />
                  </div>

                  {activeTab === 'erc20' && tokenInfo && !isUnsupportedNetwork && (needsApproval || approvalStatus.stage !== 'idle') && (
                    <ApprovalCard
                      tokenSymbol={tokenInfo.symbol}
                      isApproving={approving}
                      isApproved={approvalStatus.stage === 'approved'}
                      onApprove={approveToken}
                      onDismiss={dismissApprovalCard}
                      approvalAmount={approvalAmountLabel}
                      unlimited={unlimitedApproval}
                      onUnlimitedChange={setUnlimitedApproval}
                      txHash={approvalStatus.hash}
                      explorerUrl={approvalStatus.explorerBase}
                      stage={approvalStatus.stage}
                    />
                  )}

                  {maxRecipientsExceeded && (
                    <div className="alert alert-error" role="alert">
                      Maximum {APP_CONFIG.MAX_RECIPIENTS} recipients per batch — you have {recipientCount}. Split your list into smaller batches.
                    </div>
                  )}

                  {error && (
                    <div className="alert alert-error" role="alert" aria-live="assertive">
                      {error}
                    </div>
                  )}

                  {txStatus.stage === 'signing' && (
                    <div className="alert alert-info tx-signing-hint" role="status" aria-live="polite">
                      <span className="tx-inline-spinner" aria-hidden="true"></span>
                      <span>Confirm in your wallet…</span>
                    </div>
                  )}

                  {txStatus.stage === 'pending' && (
                    <div className="alert alert-info" role="status" aria-live="polite">
                      <div className="tx-pending-message">
                        <span className="tx-inline-spinner" aria-hidden="true"></span>
                        <span>Transaction submitted — waiting for network confirmation.</span>
                      </div>
                      {txStatus.hash && txStatus.explorerBase && (
                        <a href={`${txStatus.explorerBase}/tx/${txStatus.hash}`} target="_blank" rel="noopener noreferrer">
                          Pending — view on explorer
                        </a>
                      )}
                    </div>
                  )}

                  {txStatus.stage === 'failed' && txStatus.message && (
                    <div className="alert alert-error" role="alert" aria-live="assertive">
                      {txStatus.message}
                    </div>
                  )}

                  <button
                    className="btn-send"
                    onClick={!account ? handleConnectWallet : (activeTab === 'native' ? confirmSendNative : confirmSendERC20)}
                    disabled={account ? (loading || recipientCount === 0 || totalAmount === 0 || isUnsupportedNetwork || (activeTab === 'erc20' && (!tokenInfo || needsApproval)) || usdPriceMissing || maxRecipientsExceeded || balanceCheck.insufficient) : loading}
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
                      tokenLoading ? 'Loading token…' : tokenAddress ? 'Token not found' : 'Enter Token Address'
                    ) : activeTab === 'erc20' && needsApproval ? (
                      'Approve Token First'
                    ) : usdPriceMissing ? (
                      'USD price unavailable — switch to token amounts'
                    ) : recipientCount === 0 ? (
                      'Add Recipients'
                    ) : maxRecipientsExceeded ? (
                      `Too many recipients (${recipientCount}/${APP_CONFIG.MAX_RECIPIENTS})`
                    ) : totalAmount === 0 ? (
                      'Enter Amount'
                    ) : balanceCheck.insufficient ? (
                      balanceCheck.label
                    ) : sendAgainHint ? (
                      `Send again to ${recipientCount} ${recipientCount === 1 ? 'address' : 'addresses'}`
                    ) : (
                      `Send ${totalAmount.toFixed(4)} ${symbol} to ${recipientCount} ${recipientCount === 1 ? 'address' : 'addresses'}`
                    )}
                  </button>
                </div>
                )}
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
          <div className="confirmation-overlay" onClick={() => { if (!submitting) setShowConfirmation(false) }} role="presentation">
            <div
              ref={confirmModalRef}
              className="confirmation-modal"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleConfirmModalKeyDown}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-tx-title"
            >
              <div className="confirmation-header">
                <h3 id="confirm-tx-title">Confirm Transaction</h3>
                <button
                  className="confirmation-close"
                  onClick={() => setShowConfirmation(false)}
                  disabled={submitting}
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
                  {pendingTx.usdMode && pendingTx.priceUsed ? (
                    <div className="confirmation-row">
                      <span className="confirmation-label">Conversion</span>
                      <span className="confirmation-value">
                        ${pendingTx.usdTotal.toFixed(2)} → {pendingTx.total.toFixed(6)} {pendingTx.symbol} @ ${formatPrice(pendingTx.priceUsed)}/{pendingTx.symbol}
                      </span>
                    </div>
                  ) : pendingTx.usdTotal ? (
                    <div className="confirmation-row">
                      <span className="confirmation-label">USD Value</span>
                      <span className="confirmation-value">${pendingTx.usdTotal.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="confirmation-row">
                    <span className="confirmation-label">Network fee</span>
                    <span className="confirmation-value">
                      {gasEstimate === null ? (
                        <span className="gas-estimating">Estimating…</span>
                      ) : gasEstimate.error ? (
                        'Network fee unavailable'
                      ) : (
                        <>
                          ≈ {formatFee(gasEstimate.native)} {nativeSymbol}
                          {gasEstimate.usd !== null && (
                            <span className="gas-usd"> ({gasEstimate.usd < 0.01 ? '< $0.01' : `$${gasEstimate.usd.toFixed(2)}`})</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {pendingTx.skippedRows > 0 && (
                  <div className="confirmation-skipped" role="status">
                    Sending to {pendingTx.recipients.length} of {pendingTx.totalRows} pasted rows — {pendingTx.skippedRows} {pendingTx.skippedRows === 1 ? 'row was' : 'rows were'} skipped (invalid, duplicate, or missing an amount).
                  </div>
                )}

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
                <button className="btn-cancel" onClick={() => setShowConfirmation(false)} disabled={submitting}>
                  Cancel
                </button>
                <button
                  className="btn-confirm"
                  onClick={pendingTx.type === 'native' ? sendNative : sendERC20}
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting ? (
                    <span className="btn-loading">
                      <span className="spinner"></span>
                      Confirm in wallet…
                    </span>
                  ) : (
                    'Confirm & Send'
                  )}
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
