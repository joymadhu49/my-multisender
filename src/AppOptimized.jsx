import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { ethers } from 'ethers';

// Hooks
import { useWallet } from './hooks/useWallet';
import { useMouseAnimation } from './hooks/useMouseAnimation';
import { useFormState } from './hooks/useFormState';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import AnimatedCursor from './components/AnimatedCursor';
import BackgroundEffects from './components/BackgroundEffects';
import Header from './components/Header';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard'));
const ConnectSection = lazy(() => import('./components/ConnectSection'));
const ConfirmationModal = lazy(() => import('./components/ConfirmationModal'));

// Services
import { getContractAddress, MULTISENDER_ABI, ERC20_ABI } from './contract';
import { getNativePrice, getTokenPrice } from './priceApi';
import { parseError } from './utils/errorParser';
import { APP_CONFIG, THEME_CONFIG } from './config';

function AppOptimized() {
  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [showNetworkSwitcher, setShowNetworkSwitcher] = useState(false);
  
  // Custom hooks
  const wallet = useWallet();
  const mouseAnimation = useMouseAnimation();
  const formState = useFormState();
  
  // Transaction state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingTx, setPendingTx] = useState(null);
  
  // Price data
  const [ethPrice, setEthPrice] = useState(null);
  const [tokenPrice, setTokenPrice] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('native');

  // Theme toggle
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  }, [theme]);

  // Apply theme to body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Apply theme colors
    const colors = THEME_CONFIG[theme];
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }, [theme]);

  // Fetch native token price
  useEffect(() => {
    if (wallet.chainId && wallet.networkConfig) {
      // pass chainId so priceApi can use wrapped-native fallback if needed
      getNativePrice(wallet.networkConfig.coingeckoId, 'usd', wallet.chainId)
        .then(setEthPrice)
        .catch(console.error);
    }
  }, [wallet.chainId, wallet.networkConfig]);

  // Load token info
  const loadTokenInfo = useCallback(async () => {
    if (!formState.tokenAddress || !ethers.isAddress(formState.tokenAddress) || !wallet.account) {
      setTokenInfo(null);
      setTokenPrice(null);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const token = new ethers.Contract(formState.tokenAddress, ERC20_ABI, provider);

      const [name, symbol, decimals, userBalance] = await Promise.all([
        token.name(),
        token.symbol(),
        token.decimals(),
        token.balanceOf(wallet.account)
      ]);

      setTokenInfo({
        name,
        symbol,
        decimals: Number(decimals),
        balance: ethers.formatUnits(userBalance, decimals)
      });

      const price = await getTokenPrice(formState.tokenAddress, wallet.chainId);
      setTokenPrice(price);
    } catch (err) {
      console.error('Failed to load token info:', err);
      setTokenInfo(null);
      setTokenPrice(null);
    }
  }, [formState.tokenAddress, wallet.account, wallet.chainId]);

  useEffect(() => {
    if (wallet.account && formState.tokenAddress) {
      loadTokenInfo();
    }
  }, [formState.tokenAddress, wallet.account, loadTokenInfo]);

  // Check allowance for ERC20
  const checkAllowance = useCallback(async () => {
    if (!formState.tokenAddress || !tokenInfo || !wallet.account) return;

    const contractAddress = getContractAddress(wallet.chainId);
    if (!contractAddress) return;

    const { amounts } = formState.getRecipientsAndAmounts(ethPrice, tokenPrice);
    if (amounts.length === 0) return;

    try {
      const total = amounts.reduce((sum, amt) => sum + parseFloat(amt), 0);
      const totalInUnits = ethers.parseUnits(total.toFixed(tokenInfo.decimals), tokenInfo.decimals);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const token = new ethers.Contract(formState.tokenAddress, ERC20_ABI, provider);
      const allowance = await token.allowance(wallet.account, contractAddress);

      setNeedsApproval(allowance < totalInUnits);
    } catch (err) {
      console.error('Failed to check allowance:', err);
    }
  }, [formState, tokenInfo, wallet.account, wallet.chainId, ethPrice, tokenPrice]);

  useEffect(() => {
    if (tokenInfo && formState.recipients) {
      checkAllowance();
    }
  }, [formState.recipients, formState.sameAmount, formState.sendMode, formState.useUsd, tokenInfo, checkAllowance]);

  // Send native tokens
  const sendNative = useCallback(async () => {
    try {
      setShowConfirmation(false);
      setLoading(true);
      setError(null);
      setSuccess(null);

      const { recipients: addrs, amounts } = formState.getRecipientsAndAmounts(ethPrice, tokenPrice);

      if (addrs.length === 0) {
        throw new Error('No valid recipients');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contractAddress = getContractAddress(wallet.chainId);
      if (!contractAddress) {
        throw new Error('Contract not deployed on this network');
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, MULTISENDER_ABI, signer);

      const amountsInWei = amounts.map(a => ethers.parseEther(parseFloat(a).toFixed(18)));
      const totalWei = amountsInWei.reduce((sum, amt) => sum + amt, 0n);

      const tx = await contract.sendNative(addrs, amountsInWei, { value: totalWei });
      setSuccess({ message: 'Transaction submitted...', hash: tx.hash });

      await tx.wait();
      setSuccess({ 
        message: 'Transaction confirmed!', 
        hash: tx.hash, 
        total: formState.totals.totalAmount, 
        symbol: wallet.networkConfig?.symbol || 'ETH',
        count: addrs.length 
      });
      
      await wallet.updateBalance(wallet.account);
      formState.clearAll();

    } catch (err) {
      console.error(err);
      setError(parseError(err));
    } finally {
      setLoading(false);
      setPendingTx(null);
    }
  }, [formState, ethPrice, tokenPrice, wallet]);

  // Send ERC20 tokens
  const sendERC20 = useCallback(async () => {
    try {
      setShowConfirmation(false);
      setLoading(true);
      setError(null);
      setSuccess(null);

      const { recipients: addrs, amounts } = formState.getRecipientsAndAmounts(ethPrice, tokenPrice);

      if (addrs.length === 0) {
        throw new Error('No valid recipients');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contractAddress = getContractAddress(wallet.chainId);
      if (!contractAddress) {
        throw new Error('Contract not deployed on this network');
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, MULTISENDER_ABI, signer);

      const amountsInUnits = amounts.map(a =>
        ethers.parseUnits(parseFloat(a).toFixed(tokenInfo.decimals), tokenInfo.decimals)
      );

      const tx = await contract.sendERC20(formState.tokenAddress, addrs, amountsInUnits);
      setSuccess({ message: 'Transaction submitted...', hash: tx.hash });

      await tx.wait();
      setSuccess({ 
        message: 'Transaction confirmed!', 
        hash: tx.hash, 
        total: formState.totals.totalAmount, 
        symbol: tokenInfo?.symbol,
        count: addrs.length 
      });
      
      await loadTokenInfo();
      formState.clearAll();

    } catch (err) {
      console.error(err);
      setError(parseError(err));
    } finally {
      setLoading(false);
      setPendingTx(null);
    }
  }, [formState, ethPrice, tokenPrice, tokenInfo, wallet, loadTokenInfo]);

  // Approve token
  const approveToken = useCallback(async () => {
    try {
      setApproving(true);
      setError(null);

      const contractAddress = getContractAddress(wallet.chainId);
      if (!contractAddress) {
        throw new Error('Contract not deployed on this network');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(formState.tokenAddress, ERC20_ABI, signer);

      const tx = await token.approve(contractAddress, ethers.MaxUint256);
      await tx.wait();

      setNeedsApproval(false);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setApproving(false);
    }
  }, [formState.tokenAddress, wallet.chainId]);

  // Prepare confirmation
  const confirmSend = useCallback((type) => {
    const { recipients: addrs, amounts } = formState.getRecipientsAndAmounts(ethPrice, tokenPrice);
    if (addrs.length === 0) {
      setError('No valid recipients');
      return;
    }
    
    const total = amounts.reduce((sum, a) => sum + (parseFloat(a) || 0), 0);
    const symbol = type === 'native' ? 
      (wallet.networkConfig?.symbol || 'ETH') : 
      (tokenInfo?.symbol || 'tokens');
    const price = type === 'native' ? ethPrice : tokenPrice;
    
    setPendingTx({
      type,
      recipients: addrs,
      amounts,
      total,
      symbol,
      usdTotal: price ? total * price : null
    });
    setShowConfirmation(true);
  }, [formState, ethPrice, tokenPrice, tokenInfo, wallet.networkConfig]);

  return (
    <ErrorBoundary>
      <div className="app">
        {/* Animated Cursor */}
        <AnimatedCursor 
          mousePosition={mouseAnimation.mousePosition}
          trails={mouseAnimation.trails}
        />
        
        {/* Background Effects */}
        <BackgroundEffects mousePosition={mouseAnimation.mousePosition} />
        
        {/* Header */}
        <Header
          account={wallet.account}
          network={wallet.network}
          theme={theme}
          toggleTheme={toggleTheme}
          networkConfig={wallet.networkConfig}
          showNetworkSwitcher={showNetworkSwitcher}
          setShowNetworkSwitcher={setShowNetworkSwitcher}
          switchNetwork={wallet.switchNetwork}
          chainId={wallet.chainId}
        />
        
        {/* Main Content */}
        <main className="main">
          <Suspense fallback={<div className="loading">Loading...</div>}>
            {!wallet.account ? (
              <ConnectSection
                connectWallet={wallet.connectWallet}
                loading={wallet.loading}
              />
            ) : (
              <Dashboard
                wallet={wallet}
                formState={formState}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                tokenInfo={tokenInfo}
                needsApproval={needsApproval}
                approving={approving}
                loading={loading}
                error={error}
                success={success}
                ethPrice={ethPrice}
                tokenPrice={tokenPrice}
                confirmSend={confirmSend}
                approveToken={approveToken}
              />
            )}
          </Suspense>
          
          {/* Confirmation Modal */}
          {showConfirmation && pendingTx && (
            <Suspense fallback={null}>
              <ConfirmationModal
                pendingTx={pendingTx}
                onConfirm={pendingTx.type === 'native' ? sendNative : sendERC20}
                onCancel={() => setShowConfirmation(false)}
              />
            </Suspense>
          )}
        </main>
        
        {/* Footer */}
        <footer className="footer">
          Made by <a href="https://x.com/zx_joy_" target="_blank" rel="noopener noreferrer">@zx_joy_</a>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default AppOptimized;
