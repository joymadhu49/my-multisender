// CoinGecko API for price data
const COINGECKO_API = 'https://api.coingecko.com/api/v3'

// Cache prices for 60 seconds to avoid rate limiting
const priceCache = new Map()
const CACHE_DURATION = 60000

export async function getNativePrice(coingeckoId = 'ethereum', currency = 'usd') {
  const cacheKey = `${coingeckoId}-${currency}`
  const cached = priceCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price
  }

  try {
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${coingeckoId}&vs_currencies=${currency}`
    )
    const data = await response.json()
    const price = data[coingeckoId]?.[currency]

    if (!price) {
      throw new Error(`Price not found for ${coingeckoId}`)
    }

    priceCache.set(cacheKey, { price, timestamp: Date.now() })
    return price
  } catch (error) {
    console.error(`Failed to fetch ${coingeckoId} price:`, error)
    throw new Error(`Failed to fetch ${coingeckoId} price from CoinGecko`)
  }
}

// Backward compatibility alias
export async function getEthPrice(currency = 'usd') {
  return getNativePrice('ethereum', currency)
}

// Map chain IDs to CoinGecko platform IDs
const COINGECKO_PLATFORMS = {
  1: 'ethereum',           // Ethereum
  56: 'binance-smart-chain', // BNB Chain
  137: 'polygon',          // Polygon
  42161: 'arbitrum-one',   // Arbitrum
  10: 'optimistic-ethereum', // Optimism
  8453: 'base',            // Base
  204: 'opbnb',            // opBNB
  4663: 'robinhood',      // Robinhood Chain
  11155111: 'ethereum',    // Sepolia (uses Ethereum platform)
  // Solana mainnet — keyed by the AppKit chain id string (see src/solana.js)
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'solana',
}

export async function getTokenPrice(contractAddress, chainId = 1, currency = 'usd') {
  const cacheKey = `${contractAddress}-${chainId}-${currency}`
  const cached = priceCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price
  }

  try {
    // Get the platform ID for this chain
    const platform = COINGECKO_PLATFORMS[chainId] || 'ethereum'
    
    const response = await fetch(
      `${COINGECKO_API}/simple/token_price/${platform}?contract_addresses=${contractAddress}&vs_currencies=${currency}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    // EVM addresses come back lowercased; Solana mints are case-sensitive
    const price = (data[contractAddress] ?? data[contractAddress.toLowerCase()])?.[currency]

    if (!price || price === 0) {
      console.warn(`Price not found for token ${contractAddress} on ${platform}`)
      return null
    }

    priceCache.set(cacheKey, { price, timestamp: Date.now() })
    return price
  } catch (error) {
    console.error(`Failed to fetch token price for ${contractAddress}:`, error)
    return null
  }
}

export function usdToEth(usdAmount, ethPrice) {
  if (!ethPrice || ethPrice <= 0) return 0
  return usdAmount / ethPrice
}

export function ethToUsd(ethAmount, ethPrice) {
  if (!ethPrice) return 0
  return ethAmount * ethPrice
}

export function usdToToken(usdAmount, tokenPrice) {
  if (!tokenPrice || tokenPrice <= 0) return 0
  return usdAmount / tokenPrice
}

export function tokenToUsd(tokenAmount, tokenPrice) {
  if (!tokenPrice) return 0
  return tokenAmount * tokenPrice
}
