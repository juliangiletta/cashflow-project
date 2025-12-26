// src/lib/marketData.js
// FIXED v6 - Better portfolio calculation and fallbacks

// ============================================
// DÓLAR BLUE (Argentina)
// ============================================
export async function getDolarBlue() {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares/blue')
    const data = await response.json()
    return {
      compra: data.compra,
      venta: data.venta,
      promedio: (data.compra + data.venta) / 2
    }
  } catch (error) {
    console.error('Error fetching dolar blue:', error)
    return { compra: 1200, venta: 1250, promedio: 1225 }
  }
}

// ============================================
// CRYPTO (CoinGecko)
// ============================================
const CRYPTO_IDS = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'ADA': 'cardano',
  'XRP': 'ripple',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'LTC': 'litecoin',
  'MATIC': 'matic-network',
  'AVAX': 'avalanche-2',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'ATOM': 'cosmos',
  'SHIB': 'shiba-inu',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'APT': 'aptos',
  'NEAR': 'near',
  'FIL': 'filecoin',
  'AAVE': 'aave',
  'MKR': 'maker',
  'PEPE': 'pepe',
  'WIF': 'dogwifcoin',
  'BONK': 'bonk'
}

export async function getCryptoPrices(symbols) {
  try {
    const ids = symbols.map(s => CRYPTO_IDS[s.toUpperCase()]).filter(Boolean)
    if (!ids.length) return {}
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
    )
    const data = await response.json()
    
    const prices = {}
    for (const [symbol, id] of Object.entries(CRYPTO_IDS)) {
      if (data[id]) {
        prices[symbol] = {
          price: data[id].usd,
          change24h: data[id].usd_24h_change || 0,
          currency: 'USD',
          source: 'coingecko'
        }
      }
    }
    return prices
  } catch (error) {
    console.error('Error fetching crypto prices:', error)
    return {}
  }
}

// ============================================
// ACCIONES US - Múltiples fuentes con fallback
// ============================================

// Intento 1: Yahoo Finance con proxy
async function getYahooQuote(symbol) {
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`
    
    const response = await fetch(proxyUrl, { timeout: 5000 })
    if (!response.ok) return null
    
    const data = await response.json()
    if (!data.chart?.result?.[0]) return null
    
    const meta = data.chart.result[0].meta
    const currentPrice = meta.regularMarketPrice
    const previousClose = meta.previousClose || meta.chartPreviousClose
    
    if (!currentPrice || currentPrice === 0) return null
    
    const change24h = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0
    
    return {
      price: currentPrice,
      change24h,
      currency: 'USD',
      source: 'yahoo'
    }
  } catch (error) {
    console.warn(`Yahoo failed for ${symbol}:`, error.message)
    return null
  }
}

// Intento 2: Finnhub (API gratuita)
async function getFinnhubQuote(symbol) {
  try {
    // Finnhub free tier - no API key needed for basic quotes
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=demo`,
      { timeout: 5000 }
    )
    if (!response.ok) return null
    
    const data = await response.json()
    if (!data.c || data.c === 0) return null
    
    return {
      price: data.c, // current price
      change24h: data.dp || 0, // percent change
      currency: 'USD',
      source: 'finnhub'
    }
  } catch (error) {
    console.warn(`Finnhub failed for ${symbol}:`, error.message)
    return null
  }
}

// Obtener precio de acción US con fallbacks
async function getUSStockQuote(symbol) {
  // Intentar Yahoo primero
  let quote = await getYahooQuote(symbol)
  if (quote) {
    console.log(`✓ Got ${symbol} from Yahoo: $${quote.price}`)
    return quote
  }
  
  // Fallback a Finnhub
  quote = await getFinnhubQuote(symbol)
  if (quote) {
    console.log(`✓ Got ${symbol} from Finnhub: $${quote.price}`)
    return quote
  }
  
  console.warn(`✗ No price found for ${symbol}`)
  return null
}

export async function getUSStockPrices(symbols) {
  const prices = {}
  
  for (const symbol of symbols) {
    const quote = await getUSStockQuote(symbol)
    if (quote) {
      prices[symbol] = quote
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300))
  }
  
  return prices
}

// ============================================
// CEDEARs (Argentina) - Yahoo con .BA
// ============================================
export async function getCedearPrices(symbols) {
  const prices = {}
  
  for (const symbol of symbols) {
    try {
      const ticker = `${symbol}.BA`
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2d`
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`
      
      const response = await fetch(proxyUrl)
      if (!response.ok) continue
      
      const data = await response.json()
      if (!data.chart?.result?.[0]) continue
      
      const meta = data.chart.result[0].meta
      const currentPrice = meta.regularMarketPrice
      if (!currentPrice || currentPrice === 0) continue
      
      const previousClose = meta.previousClose || meta.chartPreviousClose
      const change24h = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0
      
      prices[symbol] = {
        price: currentPrice,
        change24h,
        currency: 'ARS',
        source: 'yahoo'
      }
      
      console.log(`✓ Got CEDEAR ${symbol}: $${currentPrice} ARS`)
    } catch (error) {
      console.warn(`Failed to get CEDEAR ${symbol}:`, error.message)
    }
    
    await new Promise(r => setTimeout(r, 300))
  }
  
  return prices
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================
export async function getAllMarketPrices(investments) {
  const cryptoSymbols = []
  const usStockSymbols = []
  const cedearSymbols = []
  
  investments.forEach(inv => {
    const symbol = inv.asset_symbol?.toUpperCase()
    if (!symbol) return
    
    if (inv.platform === 'cripto') {
      if (!cryptoSymbols.includes(symbol)) cryptoSymbols.push(symbol)
    } else if (inv.platform === 'usa') {
      if (!usStockSymbols.includes(symbol)) usStockSymbols.push(symbol)
    } else if (inv.platform === 'iol') {
      if (!cedearSymbols.includes(symbol)) cedearSymbols.push(symbol)
    }
  })
  
  console.log('Fetching prices for:', { cryptoSymbols, usStockSymbols, cedearSymbols })
  
  const [dolar, cryptoPrices, usStockPrices, cedearPrices] = await Promise.all([
    getDolarBlue(),
    cryptoSymbols.length > 0 ? getCryptoPrices(cryptoSymbols) : {},
    usStockSymbols.length > 0 ? getUSStockPrices(usStockSymbols) : {},
    cedearSymbols.length > 0 ? getCedearPrices(cedearSymbols) : {}
  ])
  
  // Combinar precios con prefijo de plataforma para evitar colisiones
  // Ej: AAPL en US y AAPL en IOL son diferentes
  const allPrices = {}
  
  // Crypto: key = "cripto:SYMBOL"
  Object.entries(cryptoPrices).forEach(([symbol, data]) => {
    allPrices[`cripto:${symbol}`] = data
  })
  
  // US Stocks: key = "usa:SYMBOL"
  Object.entries(usStockPrices).forEach(([symbol, data]) => {
    allPrices[`usa:${symbol}`] = data
  })
  
  // CEDEARs: key = "iol:SYMBOL"
  Object.entries(cedearPrices).forEach(([symbol, data]) => {
    allPrices[`iol:${symbol}`] = data
  })
  
  console.log('All prices fetched:', allPrices)
  console.log('Dolar blue:', dolar)
  
  return { prices: allPrices, dolarBlue: dolar, timestamp: Date.now() }
}

// ============================================
// CALCULAR PORTAFOLIO - FIXED
// ============================================
export function calculateFullPortfolio(investments, marketData) {
  if (!investments?.length) {
    return {
      positions: [],
      totalValueUSD: 0,
      totalCostUSD: 0,
      totalProfitUSD: 0,
      totalProfitPercent: 0,
      change24hUSD: 0,
      change24hPercent: 0,
      byPlatform: [],
      byCurrency: []
    }
  }
  
  const dolarBlue = marketData?.dolarBlue?.promedio || 1500
  const prices = marketData?.prices || {}
  
  const positions = []
  let totalValueUSD = 0
  let totalCostUSD = 0
  let totalChange24hUSD = 0
  
  const platformTotals = { 'Crypto': 0, 'CEDEARs': 0, 'US Stocks': 0 }
  
  investments.forEach(inv => {
    const symbol = inv.asset_symbol?.toUpperCase()
    // Usar key con plataforma para buscar el precio correcto
    const priceKey = `${inv.platform}:${symbol}`
    const priceData = prices[priceKey]
    
    const quantity = parseFloat(inv.quantity) || 0
    const avgPrice = parseFloat(inv.avg_price) || 0
    const totalInvested = parseFloat(inv.total_invested) || 0
    
    let currentPrice = 0
    let currentValueUSD = 0
    let costBasisUSD = 0
    let change24h = 0
    let hasMarketPrice = false
    
    if (priceData && priceData.price > 0) {
      // Tenemos precio de mercado
      hasMarketPrice = true
      currentPrice = priceData.price
      change24h = priceData.change24h || 0
      
      if (inv.platform === 'iol') {
        // CEDEAR: precio en ARS, convertir a USD
        const valueARS = quantity * currentPrice
        currentValueUSD = valueARS / dolarBlue
        costBasisUSD = totalInvested / dolarBlue
      } else {
        // Crypto y US: precio en USD
        currentValueUSD = quantity * currentPrice
        costBasisUSD = totalInvested
      }
    } else {
      // SIN precio de mercado: usar el costo como valor actual
      console.log(`No market price for ${priceKey}, using invested amount as value`)
      currentPrice = avgPrice
      
      if (inv.platform === 'iol' || inv.currency === 'ARS') {
        currentValueUSD = totalInvested / dolarBlue
        costBasisUSD = totalInvested / dolarBlue
      } else {
        // Para US stocks sin precio, usar el total invertido directamente
        currentValueUSD = totalInvested
        costBasisUSD = totalInvested
      }
    }
    
    const profitLossUSD = currentValueUSD - costBasisUSD
    const profitLossPercent = costBasisUSD > 0 ? (profitLossUSD / costBasisUSD) * 100 : 0
    const change24hValue = hasMarketPrice ? currentValueUSD * (change24h / 100) : 0
    
    positions.push({
      symbol,
      priceKey, // Agregar priceKey para referencia
      quantity,
      avgPrice,
      currentPrice,
      currentValueUSD,
      costBasisUSD,
      profitLossUSD,
      profitLossPercent,
      change24h,
      change24hValue,
      platform: inv.platform,
      hasMarketPrice
    })
    
    totalValueUSD += currentValueUSD
    totalCostUSD += costBasisUSD
    totalChange24hUSD += change24hValue
    
    // Por plataforma
    const platName = inv.platform === 'cripto' ? 'Crypto' : inv.platform === 'iol' ? 'CEDEARs' : 'US Stocks'
    platformTotals[platName] += currentValueUSD
  })
  
  const totalProfitUSD = totalValueUSD - totalCostUSD
  const totalProfitPercent = totalCostUSD > 0 ? (totalProfitUSD / totalCostUSD) * 100 : 0
  const change24hPercent = (totalValueUSD - totalChange24hUSD) > 0 
    ? (totalChange24hUSD / (totalValueUSD - totalChange24hUSD)) * 100 
    : 0
  
  // Convertir a arrays
  const byPlatform = Object.entries(platformTotals)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
      percentage: totalValueUSD > 0 ? Math.round((value / totalValueUSD) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.value - a.value)
  
  const byCurrency = byPlatform.map(p => ({
    name: p.name === 'Crypto' ? '🪙 Crypto' : p.name === 'CEDEARs' ? '🇦🇷 CEDEARs' : '🇺🇸 US Stocks',
    value: p.value,
    percentage: p.percentage
  }))
  
  console.log('Portfolio calculated:', { 
    totalValueUSD, 
    totalCostUSD, 
    totalProfitUSD,
    positions: positions.map(p => ({ symbol: p.symbol, priceKey: p.priceKey, value: p.currentValueUSD, hasPrice: p.hasMarketPrice }))
  })
  
  return {
    positions: positions.sort((a, b) => b.currentValueUSD - a.currentValueUSD),
    totalValueUSD: Math.round(totalValueUSD * 100) / 100,
    totalCostUSD: Math.round(totalCostUSD * 100) / 100,
    totalProfitUSD: Math.round(totalProfitUSD * 100) / 100,
    totalProfitPercent: Math.round(totalProfitPercent * 100) / 100,
    change24hUSD: Math.round(totalChange24hUSD * 100) / 100,
    change24hPercent: Math.round(change24hPercent * 100) / 100,
    byPlatform,
    byCurrency,
    dolarBlue: marketData?.dolarBlue
  }
}