// CoinGecko API for price data
const COINGECKO_API = 'https://api.coingecko.com/api/v3'

// Cache prices for 60 seconds to avoid rate limiting
const priceCache = new Map()
const CACHE_DURATION = 60000

export async function getNativePrice(coingeckoId = 'ethereum', currency = 'usd') {
  // New behavior: accept optional third parameter `chainId` by passing it through
  // Note: callers may pass a chainId as the 3rd arg; we support that below.
  const args = Array.from(arguments)
  const chainId = args.length >= 3 ? args[2] : null

  // Support fallback aliases for network ids (some coin ids change over time)
  const ALIASES = {
    'ethereum': ['ethereum'],
    'matic-network': ['matic-network', 'polygon-pos', 'polygon', 'matic-token', 'matic'],
    'polygon': ['polygon-pos', 'matic-network', 'polygon', 'matic-token', 'matic'],
    'binancecoin': ['binancecoin', 'binance-smart-chain'],
    'binance-smart-chain': ['binancecoin', 'binance-smart-chain']
  }

  const tryIds = ALIASES[coingeckoId] || [coingeckoId]

  // Look in cache first for any of the candidate ids
  for (const id of tryIds) {
    const cacheKey = `${id}-${currency}`
    const cached = priceCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.price
    }
  }

  // Try coin simple price for each alias
  for (const id of tryIds) {
    try {
      const resp = await fetch(`${COINGECKO_API}/simple/price?ids=${id}&vs_currencies=${currency}`)
      if (!resp.ok) continue
      const data = await resp.json()
      const price = data[id]?.[currency]
      if (price || price === 0) {
        priceCache.set(`${id}-${currency}`, { price, timestamp: Date.now() })
        return price
      }
    } catch (err) {
      console.warn(`CoinGecko lookup failed for ${id}:`, err)
      continue
    }
  }

  // If coin-based lookups fail, and we have a chainId, try wrapped native token price on that chain
  // This is often more reliable for chain-native USD pricing
  const WRAPPED_NATIVE = {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    56: '0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    137: '0x0d500B1d8E8eF31E21C99d1Db9a6444d3ADf1270', // WMATIC
    42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH Arbitrum
    10: '0x4200000000000000000000000000000000000006', // Optimism WETH (canonical)
    8453: null // Base fallback left null (CoinGecko should have 'base' coin id)
  }

  if (chainId && WRAPPED_NATIVE[Number(chainId)]) {
    try {
      const wrappedAddr = WRAPPED_NATIVE[Number(chainId)]
      const tokenPrice = await getTokenPrice(wrappedAddr, Number(chainId), currency)
      if (tokenPrice) {
        // Cache under the original coingeckoId for short time so subsequent reads use it
        priceCache.set(`${coingeckoId}-${currency}`, { price: tokenPrice, timestamp: Date.now() })
        return tokenPrice
      }
    } catch (err) {
      console.warn('Wrapped native token fallback failed:', err)
    }
  }

  // As a last resort try markets endpoint for first alias
  try {
    const primary = tryIds[0]
    const resp = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=${currency}&ids=${primary}`)
    if (resp.ok) {
      const arr = await resp.json()
      const price = arr?.[0]?.current_price
      if (price || price === 0) {
        priceCache.set(`${primary}-${currency}`, { price, timestamp: Date.now() })
        return price
      }
    }
  } catch (err) {
    console.warn('CoinGecko markets fallback failed:', err)
  }

  throw new Error(`Price not found for ${coingeckoId}`)
}

// Backward compatibility alias
export async function getEthPrice(currency = 'usd') {
  return getNativePrice('ethereum', currency)
}

// Map chain IDs to CoinGecko platform IDs
const COINGECKO_PLATFORMS = {
  1: 'ethereum',           // Ethereum
  56: 'binance-smart-chain', // BNB Chain
  137: 'polygon-pos',      // Polygon (CoinGecko platform id is 'polygon-pos')
  42161: 'arbitrum-one',   // Arbitrum
  10: 'optimistic-ethereum', // Optimism
  8453: 'base',            // Base
  11155111: 'ethereum',    // Sepolia (uses Ethereum platform)
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
    const price = data[contractAddress.toLowerCase()]?.[currency]

  if (!price || price === 0) {
      console.warn(`Price not found for token ${contractAddress} on ${platform}`)
      // Some tokens (like wrapped native tokens) may be indexed under different ids
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
