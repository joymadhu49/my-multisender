import { useState, useCallback, useMemo } from 'react';
import { VALIDATION } from '../config';
import { ethers } from 'ethers';

export const useFormState = () => {
  const [sendMode, setSendMode] = useState('same');
  const [recipients, setRecipients] = useState('');
  const [sameAmount, setSameAmount] = useState('');
  const [useUsd, setUseUsd] = useState(false);
  const [tokenAddress, setTokenAddress] = useState('');
  const [quickAddAddress, setQuickAddAddress] = useState('');
  const [quickAddAmount, setQuickAddAmount] = useState('');

  // Parse addresses with validation
  const parseAddresses = useCallback((text, trackWarnings = false) => {
    if (!text.trim()) return { addresses: [], warnings: { invalid: 0, duplicates: 0 } };
    
    const lines = text.trim().split('\n').filter(line => line.trim());
    const addresses = [];
    const seen = new Set();
    let invalidCount = 0;
    let duplicateCount = 0;

    for (const line of lines) {
      const address = VALIDATION.sanitizeInput(line.split(/[,\s\t]+/)[0]);
      if (address) {
        if (ethers.isAddress(address)) {
          const normalized = address.toLowerCase();
          if (seen.has(normalized)) {
            duplicateCount++;
          } else {
            seen.add(normalized);
            addresses.push(address);
          }
        } else {
          invalidCount++;
        }
      }
    }

    return {
      addresses,
      warnings: trackWarnings ? { invalid: invalidCount, duplicates: duplicateCount } : null
    };
  }, []);

  // Parse recipients with amounts
  const parseRecipientsWithAmounts = useCallback((text, trackWarnings = false) => {
    if (!text.trim()) {
      return { 
        recipients: [], 
        amounts: [], 
        warnings: { invalid: 0, duplicates: 0 } 
      };
    }

    const lines = text.trim().split('\n').filter(line => line.trim());
    const recipients = [];
    const amounts = [];
    const seen = new Set();
    let invalidCount = 0;
    let duplicateCount = 0;

    for (const line of lines) {
      const parts = line.split(/[,\s\t]+/).map(p => VALIDATION.sanitizeInput(p)).filter(p => p);
      if (parts.length >= 2) {
        if (ethers.isAddress(parts[0])) {
          const amount = parseFloat(parts[1].replace('$', ''));
          if (VALIDATION.isValidAmount(amount)) {
            const normalized = parts[0].toLowerCase();
            if (seen.has(normalized)) {
              duplicateCount++;
            } else {
              seen.add(normalized);
              recipients.push(parts[0]);
              amounts.push(parts[1].replace('$', ''));
            }
          } else {
            invalidCount++;
          }
        } else {
          invalidCount++;
        }
      } else if (parts.length === 1 && parts[0]) {
        invalidCount++;
      }
    }

    return {
      recipients,
      amounts,
      warnings: trackWarnings ? { invalid: invalidCount, duplicates: duplicateCount } : null
    };
  }, []);

  // Get recipients and amounts based on mode
  const getRecipientsAndAmounts = useCallback((ethPrice = null, tokenPrice = null) => {
    if (sendMode === 'same') {
      const { addresses } = parseAddresses(recipients);
      let amount = parseFloat(sameAmount) || 0;

      // Convert USD to crypto if needed
      if (useUsd && amount > 0) {
        const price = tokenAddress ? tokenPrice : ethPrice;
        if (price) {
          amount = amount / price;
        }
      }

      return {
        recipients: addresses,
        amounts: addresses.map(() => amount.toString())
      };
    } else {
      const parsed = parseRecipientsWithAmounts(recipients);
      
      if (useUsd) {
        const price = tokenAddress ? tokenPrice : ethPrice;
        if (price) {
          parsed.amounts = parsed.amounts.map(a => (parseFloat(a) / price).toString());
        }
      }

      return parsed;
    }
  }, [sendMode, recipients, sameAmount, useUsd, tokenAddress, parseAddresses, parseRecipientsWithAmounts]);

  // Add quick recipient
  const addQuickRecipient = useCallback(() => {
    if (!quickAddAddress || !ethers.isAddress(quickAddAddress)) return false;

    let newLine = quickAddAddress;
    if (sendMode === 'custom' && quickAddAmount) {
      newLine += `, ${quickAddAmount}`;
    }

    setRecipients(prev => prev ? `${prev}\n${newLine}` : newLine);
    setQuickAddAddress('');
    setQuickAddAmount('');
    return true;
  }, [quickAddAddress, quickAddAmount, sendMode]);

  // Clear all form data
  const clearAll = useCallback(() => {
    setRecipients('');
    setSameAmount('');
    setQuickAddAddress('');
    setQuickAddAmount('');
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    const { recipients: addrs, amounts } = getRecipientsAndAmounts();
    const totalAmount = amounts.reduce((sum, a) => sum + (parseFloat(a) || 0), 0);
    return {
      recipientCount: addrs.length,
      totalAmount
    };
  }, [getRecipientsAndAmounts]);

  // Parse warnings
  const parseWarnings = useMemo(() => {
    if (sendMode === 'same') {
      return parseAddresses(recipients, true).warnings;
    } else {
      return parseRecipientsWithAmounts(recipients, true).warnings;
    }
  }, [recipients, sendMode, parseAddresses, parseRecipientsWithAmounts]);

  return {
    // State
    sendMode,
    recipients,
    sameAmount,
    useUsd,
    tokenAddress,
    quickAddAddress,
    quickAddAmount,
    
    // Setters
    setSendMode,
    setRecipients,
    setSameAmount,
    setUseUsd,
    setTokenAddress,
    setQuickAddAddress,
    setQuickAddAmount,
    
    // Actions
    getRecipientsAndAmounts,
    addQuickRecipient,
    clearAll,
    
    // Computed
    totals,
    parseWarnings
  };
};