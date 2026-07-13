import { describe, it, expect } from 'vitest'
import {
  getTransactionMeta,
  calculateClosingDate,
  getBillingMonth,
  getBillingMonthFromRules,
  getBillingMonthFromCycle,
  getEffectiveMonth,
  isCurrentBillingMonth,
  escapeHtml,
} from '@/lib/utils'

describe('utils', () => {
  describe('getTransactionMeta', () => {
    it('retorna label de cuota', () => {
      expect(getTransactionMeta('expense', true)).toEqual({ label: 'Cuota', color: 'orange' })
    })

    it('retorna label de suscripción', () => {
      expect(getTransactionMeta('subscription', false)).toEqual({ label: 'Suscripción', color: 'rose' })
    })

    it('retorna label de servicio', () => {
      expect(getTransactionMeta('service', false)).toEqual({ label: 'Servicio', color: 'blue' })
    })

    it('retorna pago único por defecto', () => {
      expect(getTransactionMeta('expense', false)).toEqual({ label: 'Pago único', color: 'gray' })
    })
  })

  describe('getBillingMonth', () => {
    it('retorna mes actual si día <= cierre', () => {
      const result = getBillingMonth('2026-07-10', 18)
      expect(result).toBe('2026-07')
    })

    it('retorna mes siguiente si día > cierre', () => {
      const result = getBillingMonth('2026-07-20', 18)
      expect(result).toBe('2026-08')
    })

    it('maneja cambio de año', () => {
      const result = getBillingMonth('2026-12-25', 18)
      expect(result).toBe('2027-01')
    })

    it('funciona con objeto Date', () => {
      const result = getBillingMonth(new Date('2026-07-05'), 18)
      expect(result).toBe('2026-07')
    })

    it('despues del dia de cierre pasa al mes siguiente', () => {
      const result = getBillingMonth('2026-07-25', 10)
      expect(result).toBe('2026-08')
    })

    it('year rollover diciembre a enero con closingDay 15', () => {
      const result = getBillingMonth('2026-12-20', 15)
      expect(result).toBe('2027-01')
    })
  })

  describe('getBillingMonthFromRules', () => {
    it('usa regla fija correctamente', () => {
      const result = getBillingMonthFromRules('2026-07-05', 'fixed', 18)
      expect(result).toBe('2026-07')
    })

    it('usa regla last_thursday', () => {
      const result = getBillingMonthFromRules('2026-07-05', 'last_thursday', 18)
      expect(typeof result).toBe('string')
      expect(result).toMatch(/^\d{4}-\d{2}$/)
    })

    it('fixed rule con dia despues del cierre', () => {
      const result = getBillingMonthFromRules('2026-07-20', 'fixed', 15)
      expect(result).toBe('2026-08')
    })

    it('last_thursday rule en mes donde el jueves esta al final', () => {
      const result = getBillingMonthFromRules('2026-07-25', 'last_thursday', 18)
      expect(result).toMatch(/^\d{4}-\d{2}$/)
    })
  })

  describe('getBillingMonthFromCycle', () => {
    it('retorna mes del cierre si fecha <= cierre', () => {
      const result = getBillingMonthFromCycle('2026-07-10', '2026-07-18')
      expect(result).toBe('2026-07')
    })

    it('retorna mes siguiente si fecha > cierre', () => {
      const result = getBillingMonthFromCycle('2026-07-20', '2026-07-18')
      expect(result).toBe('2026-08')
    })
  })

  describe('getEffectiveMonth', () => {
    it('usa billing_month para tarjeta', () => {
      const result = getEffectiveMonth({
        payment_method: 'card',
        billing_month: '2026-08',
        transaction_date: '2026-07-15',
      })
      expect(result).toBe('2026-08')
    })

    it('usa transaction_date para efectivo', () => {
      const result = getEffectiveMonth({
        payment_method: 'cash',
        billing_month: null,
        transaction_date: '2026-07-15',
      })
      expect(result).toBe('2026-07')
    })

    it('tarjeta sin billing_month usa transaction_date', () => {
      const result = getEffectiveMonth({
        payment_method: 'card',
        billing_month: null,
        transaction_date: '2026-05-20',
      })
      expect(result).toBe('2026-05')
    })

    it('efectivo usa transaction_date aunque tenga billing_month', () => {
      const result = getEffectiveMonth({
        payment_method: 'cash',
        billing_month: '2026-08',
        transaction_date: '2026-06-10',
      })
      expect(result).toBe('2026-06')
    })
  })

  describe('isCurrentBillingMonth', () => {
    it('retorna true si el mes efectivo coincide', () => {
      const result = isCurrentBillingMonth({
        payment_method: 'card',
        billing_month: '2026-07',
        transaction_date: '2026-07-15',
      }, '2026-07')
      expect(result).toBe(true)
    })

    it('retorna false si el mes no coincide', () => {
      const result = isCurrentBillingMonth({
        payment_method: 'card',
        billing_month: '2026-08',
        transaction_date: '2026-07-15',
      }, '2026-07')
      expect(result).toBe(false)
    })

    it('mismo mes con efectivo', () => {
      const result = isCurrentBillingMonth({
        payment_method: 'cash',
        transaction_date: '2026-09-10',
      }, '2026-09')
      expect(result).toBe(true)
    })

    it('mes diferente con efectivo', () => {
      const result = isCurrentBillingMonth({
        payment_method: 'cash',
        transaction_date: '2026-10-10',
      }, '2026-09')
      expect(result).toBe(false)
    })
  })

  describe('calculateClosingDate', () => {
    it('retorna un jueves', () => {
      const result = calculateClosingDate(2026, 6)
      expect(result.getDay()).toBe(4)
    })

    it('retorna fecha en el mes correcto', () => {
      const result = calculateClosingDate(2026, 6)
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBeGreaterThanOrEqual(6)
    })

    it('para un mes donde el ultimo jueves cae cerca del final', () => {
      const result = calculateClosingDate(2026, 6)
      expect(result.getDay()).toBe(4)
      expect(result.getMonth()).toBe(6)
    })

    it('edge case febrero (no bisiesto)', () => {
      const result = calculateClosingDate(2027, 1)
      expect(result.getDay()).toBe(4)
      expect(result.getMonth()).toBe(1)
      expect(result.getFullYear()).toBe(2027)
    })

    it('ultimo jueves siempre es dia 4 (Thursday)', () => {
      for (let m = 0; m < 12; m++) {
        const result = calculateClosingDate(2026, m)
        expect(result.getDay()).toBe(4)
      }
    })
  })

  describe('escapeHtml', () => {
    it('escapa <, >, &, ", y comilla simple', () => {
      const input = '<script>alert("XSS & \'attack\'")</script>'
      const result = escapeHtml(input)
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
      expect(result).not.toContain('"')
      expect(result).not.toContain("'")
      expect(result).toContain('&lt;')
      expect(result).toContain('&gt;')
      expect(result).toContain('&quot;')
      expect(result).toContain('&#039;')
      expect(result).toContain('&amp;')
    })

    it('no modifica una cadena segura', () => {
      const input = 'Hello, World!'
      const result = escapeHtml(input)
      expect(result).toBe('Hello, World!')
    })
  })
})
