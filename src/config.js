// App Configuration
export const APP_CONFIG = {
  // Animation Settings
  MOUSE_TRAIL_COUNT: 8,
  MOUSE_TRAIL_TIMEOUT: 500,
  MAGNETIC_BUTTON_DISTANCE: 100,
  MAGNETIC_PULL_STRENGTH: 5,
  STAR_PARTICLE_COUNT: 15, // Reduced from 30 for performance
  
  // Cache Settings
  PRICE_CACHE_DURATION: 60000, // 60 seconds
  
  // Transaction Settings
  DEFAULT_GAS_BUFFER: 1.1, // 10% buffer for gas estimation
  MAX_RECIPIENTS: 500,
  
  // UI Settings
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 300,
  
  // Network Configurations
  NETWORK_CONFIG: {
    1: { 
      name: 'Ethereum', 
      symbol: 'ETH', 
      explorer: 'https://etherscan.io', 
      coingeckoId: 'ethereum', 
      logo: 'ethereum',
      rpcUrl: 'https://eth.llamarpc.com'
    },
    56: { 
      name: 'BNB Chain', 
      symbol: 'BNB', 
      explorer: 'https://bscscan.com', 
      coingeckoId: 'binancecoin', 
      logo: 'bnb',
      rpcUrl: 'https://bsc-dataseed.binance.org'
    },
    8453: { 
      name: 'Base', 
      symbol: 'ETH', 
      explorer: 'https://basescan.org', 
      coingeckoId: 'ethereum', 
      logo: 'base',
      rpcUrl: 'https://mainnet.base.org'
    },
    137: { 
      name: 'Polygon', 
      symbol: 'POL', 
      explorer: 'https://polygonscan.com', 
      coingeckoId: 'polygon-ecosystem-token', 
      logo: 'polygon',
      rpcUrl: 'https://polygon-rpc.com'
    },
    42161: { 
      name: 'Arbitrum', 
      symbol: 'ETH', 
      explorer: 'https://arbiscan.io', 
      coingeckoId: 'ethereum', 
      logo: 'arbitrum',
      rpcUrl: 'https://arb1.arbitrum.io/rpc'
    },
    10: { 
      name: 'Optimism', 
      symbol: 'ETH', 
      explorer: 'https://optimistic.etherscan.io', 
      coingeckoId: 'ethereum', 
      logo: 'optimism',
      rpcUrl: 'https://mainnet.optimism.io'
    },
    11155111: { 
      name: 'Sepolia', 
      symbol: 'ETH', 
      explorer: 'https://sepolia.etherscan.io', 
      coingeckoId: 'ethereum', 
      logo: 'sepolia',
      rpcUrl: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
    },
  }
};

// Theme Colors - Softer, easier on the eyes
export const THEME_CONFIG = {
  dark: {
    // Softer dark backgrounds (less deep purple)
    bgBase: '#0f1419',
    bgRaised: '#1a1f2e',
    bgSurface: '#242937',
    bgElevated: '#2f3544',
    
    // Text colors with better contrast
    textPrimary: '#ffffff',
    textSecondary: '#a8b2c7',
    textTertiary: '#6e7891',
    textMuted: '#4a5568',
    
    // Dark charcoal accent
    accent: '#1E293B',
    accentHover: '#334155',
    accentMuted: 'rgba(30, 41, 59, 0.12)',
    accentGlow: 'rgba(30, 41, 59, 0.25)',
    
    secondary: '#64748B',
    secondaryMuted: 'rgba(100, 116, 139, 0.1)',
  },
  light: {
    bgBase: '#fafbfc',
    bgRaised: '#ffffff',
    bgSurface: '#ffffff',
    bgElevated: '#f6f8fa',
    
    textPrimary: '#0d1117',
    textSecondary: '#57606a',
    textTertiary: '#6e7781',
    textMuted: '#8b949e',
    
    accent: '#1E293B',
    accentHover: '#334155',
    accentMuted: 'rgba(30, 41, 59, 0.08)',
    accentGlow: 'rgba(30, 41, 59, 0.15)',
    
    secondary: '#64748B',
    secondaryMuted: 'rgba(100, 116, 139, 0.08)',
  }
};

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

// Helper Functions
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};