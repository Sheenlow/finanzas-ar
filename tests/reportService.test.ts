import { describe, it, expect } from 'vitest'
import { reportService } from '@/services/reportService'

function makeTx(overrides: Record<string, any> = {}) {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    destination_account_id: null,
    category_id: 'cat-1',
    amount: 5000,
    currency: 'ARS',
    type: 'expense',
    description: 'Netflix',
    transaction_date: '2026-07-01',
    exchange_rate: 1,
    created_at: '2026-07-01',
    payment_method: 'card',
    is_installment: false,
    installments_total: 1,
    installment_number: 1,
    parent_transaction_id: null,
    subscription_frequency: null,
    household_id: null,
    billing_month: '2026-07',
    ...overrides,
  }
}

describe('reportService', () => {
  describe('getFixedExpenses', () => {
    it('filtra suscripciones correctamente', () => {
      const tx = makeTx({ type: 'subscription', amount: 5000 })
      const result = reportService.getFixedExpenses([tx])

      expect(result.items).toHaveLength(1)
      expect(result.items[0].type).toBe('subscription')
    })

    it('filtra servicios correctamente', () => {
      const tx = makeTx({ type: 'service', amount: 3000 })
      const result = reportService.getFixedExpenses([tx])

      expect(result.items).toHaveLength(1)
    })

    it('filtra gastos en cuotas', () => {
      const tx = makeTx({ is_installment: true, installments_total: 6, amount: 2000 })
      const result = reportService.getFixedExpenses([tx])

      expect(result.items).toHaveLength(1)
    })

    it('excluye transacciones hijas', () => {
      const parent = makeTx({ id: 'parent', type: 'subscription' })
      const child = makeTx({ id: 'child', parent_transaction_id: 'parent', type: 'subscription' })
      const result = reportService.getFixedExpenses([parent, child])

      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('parent')
    })

    it('excluye gastos normales', () => {
      const tx = makeTx({ type: 'expense', is_installment: false })
      const result = reportService.getFixedExpenses([tx])

      expect(result.items).toHaveLength(0)
    })

    it('retorna monthlyData con 12 meses', () => {
      const tx = makeTx({ type: 'subscription', amount: 5000, subscription_frequency: 'monthly' })
      const result = reportService.getFixedExpenses([tx])

      expect(result.monthlyData).toHaveLength(12)
    })

    it('distribuye gastos mensuales desde el mes de la transacción', () => {
      const tx = makeTx({
        type: 'subscription',
        amount: 5000,
        subscription_frequency: 'monthly',
        transaction_date: '2026-07-15',
        payment_method: 'cash',
      })
      const result = reportService.getFixedExpenses([tx])

      const total = result.monthlyData.reduce((sum, m) => sum + m.amount, 0)
      expect(total).toBe(30000)
    })

    it('reparte gastos recurrentes proporcionalmente según frecuencia', () => {
      const tx = makeTx({
        type: 'subscription',
        amount: 3000,
        subscription_frequency: 'quarterly',
        transaction_date: '2026-01-01',
        payment_method: 'cash',
      })
      const result = reportService.getFixedExpenses([tx])

      const monthsWithAmount = result.monthlyData.filter(m => m.amount > 0)
      expect(monthsWithAmount.length).toBeGreaterThan(0)
    })

    it('agrupa transacciones cuyo categories.name es Servicios', () => {
      const tx = makeTx({
        type: 'expense',
        categories: { name: 'Servicios' },
      })
      const result = reportService.getFixedExpenses([tx])

      expect(result.items).toHaveLength(1)
    })

    it('excluye transacciones de tipo income', () => {
      const tx = makeTx({ type: 'income' })
      const result = reportService.getFixedExpenses([tx])

      expect(result.items).toHaveLength(0)
    })

    it('monthlyData contiene nombres de meses correctos', () => {
      const tx = makeTx({ type: 'subscription', amount: 1000, subscription_frequency: 'monthly' })
      const result = reportService.getFixedExpenses([tx])

      const expectedMonths = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      ]
      const monthNames = result.monthlyData.map(m => m.month)
      expect(monthNames).toEqual(expectedMonths)
    })
  })
})
