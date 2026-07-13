import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cryptoPriceService } from '@/services/cryptoPriceService'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('cryptoPriceService', () => {
  describe('getPrices', () => {
    it('devuelve {btc, eth} con valores > 0', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            bitcoin: { usd: 96000 },
            ethereum: { usd: 3800 },
          }),
      })

      const prices = await cryptoPriceService.getPrices()
      expect(prices.btc).toBe(96000)
      expect(prices.eth).toBe(3800)
      expect(prices.btc).toBeGreaterThan(0)
      expect(prices.eth).toBeGreaterThan(0)
    })

    it('fallback {btc: 87000, eth: 3400} en error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const prices = await cryptoPriceService.getPrices()
      expect(prices.btc).toBe(87000)
      expect(prices.eth).toBe(3400)
    })

    it('fallback si faltan btc o eth en respuesta', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ripple: { usd: 2 } }),
      })

      const prices = await cryptoPriceService.getPrices()
      expect(prices.btc).toBe(87000)
      expect(prices.eth).toBe(3400)
    })
  })
})
