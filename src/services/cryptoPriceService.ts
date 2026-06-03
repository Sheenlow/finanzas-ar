interface CryptoPrices {
  btc: number
  eth: number
}

export const cryptoPriceService = {
  async getPrices(): Promise<CryptoPrices> {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',
        { next: { revalidate: 3600 } }
      )
      if (!res.ok) throw new Error('CoinGecko API failed')
      const data = await res.json()
      return {
        btc: data.bitcoin?.usd || 87000,
        eth: data.ethereum?.usd || 3400,
      }
    } catch (error) {
      console.error('Crypto price API failed, using fallback values:', error)
      return { btc: 87000, eth: 3400 }
    }
  }
}
