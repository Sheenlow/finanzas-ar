export const exchangeRateService = {
  async getRate() {
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/blue', {
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
