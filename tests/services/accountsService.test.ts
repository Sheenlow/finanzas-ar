import { describe, it, expect, vi } from 'vitest'
import { accountsService } from '@/services/accountsService'

function mockBuilder(result: { data: any; error: any }) {
  const b: any = { data: result.data, error: result.error }
  const methods = ['select', 'eq', 'order', 'insert', 'update', 'delete', 'single', 'maybeSingle', 'gte', 'lt', 'is', 'in', 'limit']
  methods.forEach((m) => {
    b[m] = vi.fn(() => b)
  })
  return b
}

function mockSupabase(tableResults: Record<string, { data: any; error: any }>) {
  return {
    from: vi.fn((table: string) => {
      return mockBuilder(tableResults[table] ?? { data: null, error: null })
    }),
  } as any
}

describe('accountsService', () => {
  describe('getAll', () => {
    it('retorna cuentas del usuario', async () => {
      const mockAccounts = [
        { id: 'a1', name: 'Efectivo', balance: 5000, user_id: 'u1' },
        { id: 'a2', name: 'Banco', balance: 10000, user_id: 'u1' },
      ]
      const supabase = mockSupabase({
        accounts: { data: mockAccounts, error: null },
      })

      const result = await accountsService.getAll(supabase, 'u1')
      expect(result).toEqual(mockAccounts)
      expect(supabase.from).toHaveBeenCalledWith('accounts')
    })
  })

  describe('create', () => {
    it('inserta cuenta con type bank', async () => {
      const newAccount = { id: 'a1', name: 'Banco Nación', type: 'bank', balance: 0, user_id: 'u1' }
      const supabase = mockSupabase({
        accounts: { data: newAccount, error: null },
      })

      const result = await accountsService.create(supabase, {
        user_id: 'u1',
        name: 'Banco Nación',
        type: 'bank',
        balance: 0,
      } as any)
      expect(result).toEqual(newAccount)
      expect(supabase.from).toHaveBeenCalledWith('accounts')
    })

    it('inserta cuenta crypto con currency BTC', async () => {
      const cryptoAccount = { id: 'c1', name: 'Binance', type: 'crypto', currency: 'BTC', balance: 0.5, user_id: 'u1' }
      const supabase = mockSupabase({
        accounts: { data: cryptoAccount, error: null },
      })

      const result = await accountsService.create(supabase, {
        user_id: 'u1',
        name: 'Binance',
        type: 'crypto',
        currency: 'BTC',
        balance: 0.5,
      } as any)
      expect(result.currency).toBe('BTC')
      expect(result.type).toBe('crypto')
    })

    it('inserta cuenta credit_card', async () => {
      const cardAccount = { id: 'cc1', name: 'Visa', type: 'credit_card', balance: 0, user_id: 'u1' }
      const supabase = mockSupabase({
        accounts: { data: cardAccount, error: null },
      })

      const result = await accountsService.create(supabase, {
        user_id: 'u1',
        name: 'Visa',
        type: 'credit_card',
        balance: 0,
      } as any)
      expect(result.type).toBe('credit_card')
    })
  })

  describe('update', () => {
    it('cambia nombre y balance', async () => {
      const updatedAccount = { id: 'a1', name: 'Nuevo Nombre', balance: 8000, user_id: 'u1' }
      let updateCalled = false
      const supabase = mockSupabase({
        accounts: { data: updatedAccount, error: null },
      })

      const result = await accountsService.update(supabase, 'a1', {
        name: 'Nuevo Nombre',
        balance: 8000,
      })
      expect(result.name).toBe('Nuevo Nombre')
      expect(result.balance).toBe(8000)
    })
  })

  describe('delete', () => {
    it('elimina cuenta', async () => {
      const supabase = mockSupabase({
        accounts: { data: null, error: null },
      })

      await expect(accountsService.delete(supabase, 'a1')).resolves.toBeUndefined()
    })
  })

  describe('getCreditCard', () => {
    it('retorna datos de tarjeta', async () => {
      const cardData = { id: 'cc1', account_id: 'a1', closing_rule: 'fixed', closing_day: 18 }
      const supabase = mockSupabase({
        credit_cards: { data: cardData, error: null },
      })

      const result = await accountsService.getCreditCard(supabase, 'a1')
      expect(result).toEqual(cardData)
      expect(supabase.from).toHaveBeenCalledWith('credit_cards')
    })
  })

  describe('findClosestBillingCycle', () => {
    it('retorna ciclo mas cercano', async () => {
      const cycle = { id: 'bc1', credit_card_id: 'cc1', close_date: '2026-07-18' }
      const supabase = mockSupabase({
        billing_cycles: { data: [cycle], error: null },
      })

      const result = await accountsService.findClosestBillingCycle(supabase, 'cc1', '2026-07-10T00:00:00Z')
      expect(result).toEqual(cycle)
      expect(supabase.from).toHaveBeenCalledWith('billing_cycles')
    })
  })
})
