const DOLAR_API_URL = process.env.DOLAR_API_URL || 'https://dolarapi.com/v1/dolares/blue'

export const exchangeRateService = {
  async getRate() {
    try {
      const res = await fetch(DOLAR_API_URL, {
        next: { revalidate: 3600 } // Cache por 1 hora
      });
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      return data.venta || 1400;
    } catch (error) {
      console.error('Exchange rate API failed, using fallback 1400:', error);
      return 1400;
    }
  }
};
