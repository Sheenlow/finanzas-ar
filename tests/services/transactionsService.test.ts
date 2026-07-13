import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transactionsService, resolveBillingMonth } from '@/services/transactionsService'
import { accountsService } from '@/services/accountsService'

vi.mock('@/services/accountsService')

function mockBuilder(data: any, error: any = null) {
  const b: any = { data, error }
  const chainMethods = ['select', 'eq', 'order', 'insert', 'update', 'delete', 'single', 'maybeSingle', 'gte', 'lt', 'is', 'in', 'limit']
  chainMethods.forEach((m) => {
    b[m] = vi.fn(() => b)
  })
  return b
}

function mockSupabase(responses: Record<string, any>) {
  return {
    from: vi.fn((table: string) => {
      const entry = responses[table]
      if (entry) return mockBuilder(entry.data, entry.error)
      return mockBuilder(null)
    }),
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(accountsService.update).mockResolvedValue({})
  vi.mocked(accountsService.getCreditCard).mockResolvedValue(null)
  vi.mocked(accountsService.findClosestBillingCycle).mockResolvedValue(null)
})

describe('transactionsService', () => {
  describe('getAll', () => {
    it('retorna transacciones ordenadas por transaction_date desc', async () => {
      const txns = [
        { id: 'tx2', user_id: 'u1', transaction_date: '2026-07-10', amount: 2000 },
        { id: 'tx1', user_id: 'u1', transaction_date: '2026-07-05', amount: 1000 },
      ]
      const supabase = mockSupabase({
        transactions: { data: txns, error: null },
      })

      const result = await transactionsService.getAll(supabase, 'u1')
      expect(result).toEqual(txns)
      expect(supabase.from).toHaveBeenCalledWith('transactions')
    })

    it('respeta custom sortField', async () => {
      const txns = [
        { id: 'tx2', user_id: 'u1', transaction_date: '2026-07-10', amount: 2000 },
        { id: 'tx1', user_id: 'u1', transaction_date: '2026-07-05', amount: 1000 },
      ]
      const supabase = mockSupabase({
        transactions: { data: txns, error: null },
      })

      await transactionsService.getAll(supabase, 'u1', 'amount')
      expect(supabase.from).toHaveBeenCalledWith('transactions')
    })
  })

  describe('create', () => {
    it('inserta y actualiza balance de cuenta', async () => {
      const insertedTx = {
        id: 'new-tx',
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 5000,
        currency: 'ARS',
        type: 'expense',
        description: 'Compra',
        transaction_date: '2026-07-10',
        payment_method: 'cash',
        billing_month: null,
      }
      const supabase = mockSupabase({
        transactions: { data: insertedTx, error: null },
        accounts: { data: { balance: 10000 }, error: null },
      })

      const result = await transactionsService.create(supabase, {
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 5000,
        currency: 'ARS',
        type: 'expense',
        description: 'Compra',
        transaction_date: '2026-07-10',
        payment_method: 'cash',
      } as any)

      expect(result.id).toBe('new-tx')
      expect(accountsService.update).toHaveBeenCalledWith(supabase, 'acc-1', { balance: 5000 })
    })

    it('con income suma al balance', async () => {
      const insertedTx = {
        id: 'new-tx',
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 8000,
        currency: 'ARS',
        type: 'income',
        transaction_date: '2026-07-10',
        payment_method: 'transfer',
        billing_month: null,
      }
      const supabase = mockSupabase({
        transactions: { data: insertedTx, error: null },
        accounts: { data: { balance: 5000 }, error: null },
      })

      await transactionsService.create(supabase, {
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 8000,
        currency: 'ARS',
        type: 'income',
        transaction_date: '2026-07-10',
        payment_method: 'transfer',
      } as any)

      expect(accountsService.update).toHaveBeenCalledWith(supabase, 'acc-1', { balance: 13000 })
    })

    it('con expense resta del balance', async () => {
      const insertedTx = {
        id: 'new-tx',
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 3000,
        currency: 'ARS',
        type: 'expense',
        transaction_date: '2026-07-10',
        payment_method: 'cash',
        billing_month: null,
      }
      const supabase = mockSupabase({
        transactions: { data: insertedTx, error: null },
        accounts: { data: { balance: 10000 }, error: null },
      })

      await transactionsService.create(supabase, {
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 3000,
        currency: 'ARS',
        type: 'expense',
        transaction_date: '2026-07-10',
        payment_method: 'cash',
      } as any)

      expect(accountsService.update).toHaveBeenCalledWith(supabase, 'acc-1', { balance: 7000 })
    })
  })

  describe('createInstallments', () => {
    it('genera N hijos con parent_transaction_id', async () => {
      const parentTx = {
        id: 'parent-id',
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 1000,
        currency: 'ARS',
        type: 'expense',
        transaction_date: '2026-07-10T00:00:00.000Z',
        payment_method: 'cash',
        is_installment: true,
        installments_total: 3,
        installment_number: 1,
        parent_transaction_id: null,
        billing_month: null,
      }
      const childTx = {
        id: 'child-2',
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 1000,
        currency: 'ARS',
        type: 'expense',
        transaction_date: '2026-08-10T00:00:00.000Z',
        payment_method: 'cash',
        is_installment: true,
        installments_total: 3,
        installment_number: 2,
        parent_transaction_id: 'parent-id',
        billing_month: null,
      }

      let insertCount = 0
      const supabase: any = {
        from: vi.fn((table: string) => {
          if (table === 'transactions') {
            insertCount++
            if (insertCount === 1) return mockBuilder(parentTx)
            return mockBuilder([childTx])
          }
          if (table === 'accounts') return mockBuilder({ balance: 10000 })
          return mockBuilder(null)
        }),
      }

      const result = await transactionsService.createInstallments(supabase, {
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 3000,
        currency: 'ARS',
        type: 'expense',
        transaction_date: '2026-07-10',
        payment_method: 'cash',
      } as any, 3)

      expect(result).toHaveLength(2)
      expect(result[0].installment_number).toBe(1)
      expect(result[1].parent_transaction_id).toBe('parent-id')
    })

    it('actualiza balance solo primera cuota', async () => {
      const parentTx = {
        id: 'parent-id',
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 1000,
        currency: 'ARS',
        type: 'expense',
        transaction_date: '2026-07-10T00:00:00.000Z',
        payment_method: 'cash',
        is_installment: true,
        installments_total: 3,
        installment_number: 1,
        parent_transaction_id: null,
        billing_month: null,
      }

      let insertCount = 0
      const supabase: any = {
        from: vi.fn((table: string) => {
          if (table === 'transactions') {
            insertCount++
            if (insertCount === 1) return mockBuilder(parentTx)
            return mockBuilder([])
          }
          if (table === 'accounts') return mockBuilder({ balance: 15000 })
          return mockBuilder(null)
        }),
      }

      await transactionsService.createInstallments(supabase, {
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 3000,
        currency: 'ARS',
        type: 'expense',
        transaction_date: '2026-07-10',
        payment_method: 'cash',
      } as any, 3)

      expect(accountsService.update).toHaveBeenCalledWith(supabase, 'acc-1', { balance: 14000 })
    })
  })

  describe('delete', () => {
    it('elimina y revierte balance (expense)', async () => {
      const supabase = mockSupabase({
        transactions: { data: { account_id: 'acc-1', amount: 4000, type: 'expense', is_installment: false, installment_number: null }, error: null },
        accounts: { data: { balance: 6000 }, error: null },
      })

      await transactionsService.delete(supabase, 'tx-1')

      expect(accountsService.update).toHaveBeenCalledWith(supabase, 'acc-1', { balance: 10000 })
    })

    it('elimina y revierte balance (income)', async () => {
      const supabase = mockSupabase({
        transactions: { data: { account_id: 'acc-1', amount: 5000, type: 'income', is_installment: false, installment_number: null }, error: null },
        accounts: { data: { balance: 15000 }, error: null },
      })

      await transactionsService.delete(supabase, 'tx-1')

      expect(accountsService.update).toHaveBeenCalledWith(supabase, 'acc-1', { balance: 10000 })
    })
  })

  describe('getHouseholdTransactions', () => {
    it('filtra por household_id', async () => {
      const txns = [
        { id: 'tx1', household_id: 'h1', amount: 3000, transaction_date: '2026-07-10' },
      ]
      const supabase = mockSupabase({
        transactions: { data: txns, error: null },
      })

      const result = await transactionsService.getHouseholdTransactions(supabase, 'h1')
      expect(result).toEqual(txns)
      expect(supabase.from).toHaveBeenCalledWith('transactions')
    })
  })

  describe('update', () => {
    it('modifica campos', async () => {
      const updatedTx = {
        id: 'tx-1',
        user_id: 'u1',
        account_id: 'acc-1',
        amount: 5000,
        currency: 'ARS',
        type: 'expense',
        description: 'Nueva descripcion',
        transaction_date: '2026-07-10',
        payment_method: 'cash',
      }
      const supabase = mockSupabase({
        transactions: { data: updatedTx, error: null },
      })

      const result = await transactionsService.update(supabase, 'tx-1', {
        description: 'Nueva descripcion',
      })

      expect(result.description).toBe('Nueva descripcion')
      expect(supabase.from).toHaveBeenCalledWith('transactions')
    })
  })

  describe('resolveBillingMonth', () => {
    it('retorna null si no es card', async () => {
      const supabase = {} as any
      const result = await resolveBillingMonth(supabase, 'cash', 'acc-1', '2026-07-10')
      expect(result).toBeNull()
    })
  })
})
