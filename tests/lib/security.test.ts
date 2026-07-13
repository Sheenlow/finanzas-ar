import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getClientIp, requireOrigin } from '@/lib/security'

describe('security', () => {
  describe('getClientIp', () => {
    it('extrae de x-forwarded-for simple (una IP)', () => {
      const req = new Request('https://example.com/api', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
      expect(getClientIp(req)).toBe('192.168.1.1')
    })

    it('extrae primera IP de x-forwarded-for multiple', () => {
      const req = new Request('https://example.com/api', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
        },
      })
      expect(getClientIp(req)).toBe('192.168.1.1')
    })

    it('usa x-real-ip si no hay x-forwarded-for', () => {
      const req = new Request('https://example.com/api', {
        headers: { 'x-real-ip': '10.0.0.5' },
      })
      expect(getClientIp(req)).toBe('10.0.0.5')
    })

    it('retorna unknown sin headers', () => {
      const req = new Request('https://example.com/api')
      expect(getClientIp(req)).toBe('unknown')
    })
  })

  describe('requireOrigin', () => {
    const originalEnv = { ...process.env }

    beforeEach(() => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://miapp.com'
      process.env.NODE_ENV = 'production'
    })

    afterEach(() => {
      process.env = { ...originalEnv }
    })

    it('permite origin valido', () => {
      const req = new Request('https://miapp.com/api/dashboard', {
        headers: {
          origin: 'https://miapp.com',
          host: 'miapp.com',
        },
      })
      expect(requireOrigin(req)).toBe(true)
    })

    it('rechaza origin no valido', () => {
      const req = new Request('https://miapp.com/api/dashboard', {
        headers: {
          origin: 'https://evil.com',
          host: 'miapp.com',
        },
      })
      expect(requireOrigin(req)).toBe(false)
    })

    it('permite si NEXT_PUBLIC_SITE_URL no esta configurado', () => {
      delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_SITE_URL
      process.env.NODE_ENV = 'production'

      const req = new Request('https://miapp.com/api/dashboard', {
        headers: {
          origin: 'https://evil.com',
          host: 'miapp.com',
        },
      })
      expect(requireOrigin(req)).toBe(true)
    })
  })
})
