import { describe, it, expect } from 'vitest'
import {
  normalizeAmount,
  detectPaymentMethod,
  isCardPayment,
  extractKeywords,
  formatAmount,
} from '@/services/bot/parser'

describe('bot parser', () => {
  describe('normalizeAmount', () => {
    it('convierte formato argentino a número', () => {
      expect(normalizeAmount('1.234,56')).toBe(1234.56)
    })

    it('convierte formato simple', () => {
      expect(normalizeAmount('8000')).toBe(8000)
    })

    it('maneja decimales con coma', () => {
      expect(normalizeAmount('99,99')).toBe(99.99)
    })

    it('maneja miles con punto y coma', () => {
      expect(normalizeAmount('10.000,50')).toBe(10000.50)
    })
  })

  describe('detectPaymentMethod', () => {
    it('detecta efectivo', () => {
      expect(detectPaymentMethod('supermercado 8000 efectivo')).toBe('cash')
    })

    it('detecta débito como card', () => {
      expect(detectPaymentMethod('netflix 1200 débito')).toBe('card')
    })

    it('detecta crédito como card', () => {
      expect(detectPaymentMethod('zapatillas 25000 crédito')).toBe('card')
    })

    it('detecta transferencia', () => {
      expect(detectPaymentMethod('alquiler 100000 transferencia')).toBe('transfer')
    })

    it('retorna null si no detecta', () => {
      expect(detectPaymentMethod('compra en el kiosco')).toBeNull()
    })
  })

  describe('isCardPayment', () => {
    it('detecta crédito', () => {
      expect(isCardPayment('pagué con crédito')).toBe(true)
    })

    it('detecta tarjeta', () => {
      expect(isCardPayment('con tarjeta')).toBe(true)
    })

    it('no detecta efectivo', () => {
      expect(isCardPayment('pagué en efectivo')).toBe(false)
    })
  })

  describe('extractKeywords', () => {
    it('extrae palabras clave normalizadas', () => {
      const keywords = extractKeywords('Supermercado DIA 8000 efectivo')
      expect(keywords).toContain('supermercado')
      expect(keywords).toContain('efectivo')
    })

    it('filtra palabras cortas', () => {
      const keywords = extractKeywords('en el kiosco de la esquina')
      keywords.forEach(k => expect(k.length).toBeGreaterThanOrEqual(3))
    })

    it('elimina acentos', () => {
      const keywords = extractKeywords('débito crédito')
      expect(keywords).toContain('debito')
      expect(keywords).toContain('credito')
    })

    it('retorna valores únicos', () => {
      const keywords = extractKeywords('comida comida super super')
      expect(keywords.filter(k => k === 'comida')).toHaveLength(1)
    })
  })

  describe('formatAmount', () => {
    it('formatea ARS', () => {
      const result = formatAmount(8000, 'ARS')
      expect(result).toContain('8.000')
    })

    it('formatea USD', () => {
      const result = formatAmount(12.5, 'USD')
      expect(result).toContain('12,50')
    })
  })
})
