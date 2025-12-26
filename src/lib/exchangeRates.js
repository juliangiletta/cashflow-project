// src/lib/exchangeRates.js
// APIs gratuitas para cotizaciones

// Cache para no hacer muchas requests
let ratesCache = {
  data: null,
  timestamp: 0
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

// Obtener precio del dólar blue en Argentina
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
    // Fallback value
    return { compra: 1200, venta: 1250, promedio: 1225 }
  }
}

// Obtener todos los tipos de dólar
export async function getAllDolarRates() {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares')
    const data = await response.json()
    return data.reduce((acc, d) => {
      acc[d.casa] = { compra: d.compra, venta: d.venta }
      return acc
    }, {})
  } catch (error) {
    console.error('Error fetching dolar rates:', error)
    return null
  }
}

// Obtener precios de criptomonedas en USD
export async function getCryptoPrices(symbols = ['bitcoin', 'ethereum', 'tether', 'usdc']) {
  try {
    const ids = symbols.join(',')
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    )
    const data = await response.json()
    
    // Mapear nombres comunes a símbolos
    const symbolMap = {
      'bitcoin': 'BTC',
      'ethereum': 'ETH',
      'tether': 'USDT',
      'usd-coin': 'USDC',
      'binancecoin': 'BNB',
      'solana': 'SOL',
      'cardano': 'ADA',
      'ripple': 'XRP',
      'dogecoin': 'DOGE',
      'polkadot': 'DOT',
      'litecoin': 'LTC'
    }
    
    const prices = {}
    for (const [id, values] of Object.entries(data)) {
      const symbol = symbolMap[id] || id.toUpperCase()
      prices[symbol] = values.usd
    }
    
    return prices
  } catch (error) {
    console.error('Error fetching crypto prices:', error)
    // Fallback values
    return {
      BTC: 100000,
      ETH: 3500,
      USDT: 1,
      USDC: 1
    }
  }
}

// Buscar precio de una crypto específica por símbolo
export async function getCryptoPriceBySymbol(symbol) {
  const symbolToId = {
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
    'APE': 'apecoin',
    'SHIB': 'shiba-inu'
  }
  
  const id = symbolToId[symbol.toUpperCase()]
  if (!id) return null
  
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
    )
    const data = await response.json()
    return data[id]?.usd || null
  } catch (error) {
    console.error('Error fetching crypto price:', error)
    return null
  }
}

// Obtener todas las cotizaciones necesarias (con cache)
export async function getAllRates() {
  const now = Date.now()
  
  // Usar cache si es válido
  if (ratesCache.data && (now - ratesCache.timestamp) < CACHE_DURATION) {
    return ratesCache.data
  }
  
  try {
    const [dolar, crypto] = await Promise.all([
      getDolarBlue(),
      getCryptoPrices(['bitcoin', 'ethereum', 'tether', 'usd-coin', 'solana', 'binancecoin'])
    ])
    
    const rates = {
      ARS_USD: dolar.promedio, // Cuántos pesos por 1 USD
      USD_ARS: 1 / dolar.promedio, // Cuántos USD por 1 peso
      crypto: crypto,
      timestamp: now
    }
    
    // Guardar en cache
    ratesCache = {
      data: rates,
      timestamp: now
    }
    
    return rates
  } catch (error) {
    console.error('Error fetching all rates:', error)
    // Retornar fallback
    return {
      ARS_USD: 1225,
      USD_ARS: 1 / 1225,
      crypto: { BTC: 100000, ETH: 3500, USDT: 1, USDC: 1 },
      timestamp: now
    }
  }
}

// Convertir monto a USD
export function convertToUSD(amount, currency, rates, cryptoSymbol = null) {
  if (!amount || !rates) return 0
  
  const numAmount = parseFloat(amount) || 0
  
  if (currency === 'USD') {
    return numAmount
  }
  
  if (currency === 'ARS') {
    return numAmount / rates.ARS_USD
  }
  
  // Si es crypto, usar el símbolo para obtener el precio
  if (cryptoSymbol && rates.crypto[cryptoSymbol]) {
    return numAmount * rates.crypto[cryptoSymbol]
  }
  
  return numAmount
}

// Calcular composición del portafolio
export function calculatePortfolioComposition(investments, rates) {
  if (!investments?.length || !rates) {
    return { byPlatform: [], byCurrency: [], total: 0 }
  }
  
  let totalUSD = 0
  const byPlatform = {}
  const byCurrency = { ARS: 0, USD: 0, CRYPTO: 0 }
  
  investments.forEach(inv => {
    let valueInUSD = 0
    
    if (inv.platform === 'cripto') {
      // Para crypto, multiplicar cantidad por precio actual
      const cryptoPrice = rates.crypto[inv.asset_symbol] || 0
      valueInUSD = (parseFloat(inv.quantity) || 0) * cryptoPrice
      byCurrency.CRYPTO += valueInUSD
    } else if (inv.currency === 'USD') {
      valueInUSD = parseFloat(inv.total_invested) || 0
      byCurrency.USD += valueInUSD
    } else {
      // ARS
      valueInUSD = (parseFloat(inv.total_invested) || 0) / rates.ARS_USD
      byCurrency.ARS += valueInUSD
    }
    
    totalUSD += valueInUSD
    
    // Agrupar por plataforma
    const platName = inv.platform === 'cripto' ? 'Crypto' : inv.platform === 'iol' ? 'IOL (ARG)' : 'USA'
    byPlatform[platName] = (byPlatform[platName] || 0) + valueInUSD
  })
  
  // Convertir a arrays con porcentajes
  const byPlatformArray = Object.entries(byPlatform).map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100,
    percentage: totalUSD > 0 ? Math.round((value / totalUSD) * 1000) / 10 : 0
  })).sort((a, b) => b.value - a.value)
  
  const byCurrencyArray = Object.entries(byCurrency)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({
      name: name === 'CRYPTO' ? '🪙 Crypto' : name === 'USD' ? '🇺🇸 USD' : '🇦🇷 ARS',
      value: Math.round(value * 100) / 100,
      percentage: totalUSD > 0 ? Math.round((value / totalUSD) * 1000) / 10 : 0
    })).sort((a, b) => b.value - a.value)
  
  return {
    byPlatform: byPlatformArray,
    byCurrency: byCurrencyArray,
    total: Math.round(totalUSD * 100) / 100
  }
}

// Calcular composición por activo individual
export function calculateAssetComposition(investments, rates) {
  if (!investments?.length || !rates) return []
  
  let totalUSD = 0
  const assets = []
  
  investments.forEach(inv => {
    let valueInUSD = 0
    
    if (inv.platform === 'cripto') {
      const cryptoPrice = rates.crypto[inv.asset_symbol] || 0
      valueInUSD = (parseFloat(inv.quantity) || 0) * cryptoPrice
    } else if (inv.currency === 'USD') {
      valueInUSD = parseFloat(inv.total_invested) || 0
    } else {
      valueInUSD = (parseFloat(inv.total_invested) || 0) / rates.ARS_USD
    }
    
    totalUSD += valueInUSD
    assets.push({
      symbol: inv.asset_symbol,
      platform: inv.platform,
      valueUSD: valueInUSD
    })
  })
  
  return assets.map(a => ({
    ...a,
    percentage: totalUSD > 0 ? Math.round((a.valueUSD / totalUSD) * 1000) / 10 : 0
  })).sort((a, b) => b.valueUSD - a.valueUSD)
}
