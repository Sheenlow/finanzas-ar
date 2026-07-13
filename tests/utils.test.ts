import { describe, it, expect } from 'vitest'
import {
  getTransactionMeta,
  calculateClosingDate,
  getBillingMonth,
  getBillingMonthFromRules,
  getEffectiveMonth,
  isCurrentBillingMonth,
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
  })
})
