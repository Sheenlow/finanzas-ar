import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exchangeRateService } from '@/services/exchangeRateService'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('exchangeRateService', () => {
  describe('getRate', () => {
    it('devuelve tasa > 0 cuando dolarapi.com responde OK', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ venta: 1250, compra: 1240 }),
      })

      const rate = await exchangeRateService.getRate()
      expect(rate).toBe(1250)
      expect(rate).toBeGreaterThan(0)
    })

    it('fallback 1400 cuando fetch falla', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const rate = await exchangeRateService.getRate()
      expect(rate).toBe(1400)
    })

    it('fallback 1400 cuando data.venta es undefined', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ compra: 1240 }),
      })

      const rate = await exchangeRateService.getRate()
      expect(rate).toBe(1400)
    })

    it('fallback 1400 cuando respuesta no es ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })

      const rate = await exchangeRateService.getRate()
      expect(rate).toBe(1400)
    })
  })
})
