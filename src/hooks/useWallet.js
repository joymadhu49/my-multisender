import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { APP_CONFIG } from '../config';

export const useWallet = () => {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateBalance = useCallback(async (address) => {
    if (!window.ethereum || !address) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const bal = await provider.getBalance(address);
      setBalance(ethers.formatEther(bal));
    } catch (err) {
      console.error('Failed to update balance:', err);
    }
  }, []);

  const updateNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const net = await provider.getNetwork();
      setChainId(net.chainId);
      const config = APP_CONFIG.NETWORK_CONFIG[Number(net.chainId)];
      setNetwork(config?.name || `Chain ${net.chainId}`);
    } catch (err) {
      console.error('Failed to update network:', err);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask or another Web3 wallet');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
      await updateBalance(accounts[0]);
      await updateNetwork();
      return accounts[0];
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [updateBalance, updateNetwork]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setBalance(null);
    setChainId(null);
    setNetwork(null);
  }, []);

  const switchNetwork = useCallback(async (targetChainId) => {
    const chainHex = '0x' + targetChainId.toString(16);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainHex }],
      });
      return true;
    } catch (err) {
      if (err.code === 4902) {
        const config = APP_CONFIG.NETWORK_CONFIG[targetChainId];
        if (config) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: chainHex,
                chainName: config.name,
                rpcUrls: [config.rpcUrl],
                nativeCurrency: {
                  name: config.symbol,
                  symbol: config.symbol,
                  decimals: 18
                },
                blockExplorerUrls: [config.explorer]
              }],
            });
            return true;
          } catch (addErr) {
            setError('Failed to add network');
            return false;
          }
        }
      }
      setError('Failed to switch network');
      return false;
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            await updateBalance(accounts[0]);
            await updateNetwork();
          }
        } catch (err) {
          console.error('Auto-connect failed:', err);
        }
      }
    };
    
    checkConnection();
    
    // Set up event listeners
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accounts[0]);
          updateBalance(accounts[0]);
        }
      };
      
      const handleChainChanged = () => {
        window.location.reload();
      };
      
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [disconnectWallet, updateBalance, updateNetwork]);

  return {
    account,
    balance,
    chainId,
    network,
    loading,
    error,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    updateBalance,
    isConnected: !!account,
    networkConfig: APP_CONFIG.NETWORK_CONFIG[Number(chainId)] || null
  };
};