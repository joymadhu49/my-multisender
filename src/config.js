// App Configuration
//
// Network metadata lives in ./networks.js (single source of truth).
// This file holds only non-network app settings and a back-compat
// re-export of NETWORKS for callers that still read APP_CONFIG.NETWORK_CONFIG.

import { NETWORKS } from './networks'

export const APP_CONFIG = {
  // Cache Settings
  PRICE_CACHE_DURATION: 60000, // 60 seconds

  // Transaction Settings
  DEFAULT_GAS_BUFFER: 1.1, // 10% buffer for gas estimation
  MAX_RECIPIENTS: 500,

  // UI Settings
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 300,

  // Back-compat view of network metadata (read-only alias).
  // Prefer importing NETWORKS / getNetwork directly from ./networks.
  NETWORK_CONFIG: NETWORKS,
}

// Validation Rules
export const VALIDATION = {
  isValidAddress: (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },
  isValidAmount: (amount) => {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  },
  sanitizeInput: (input) => {
    return input.trim().replace(/[<>]/g, '');
  }
};
