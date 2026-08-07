import { describe, it, expect, vi } from 'vitest'
import { householdSplitService } from '@/services/householdSplitService'

function chainableMock(response: any = { data: null, error: null }) {
  const resolve = () => Promise.resolve(response)
  const chain: Record<string, any> = {
    then: (onFulfilled: any, onRejected: any) => resolve().then(onFulfilled, onRejected),
    catch: (onRejected: any) => resolve().catch(onRejected),
  }
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'upsert']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain.single = vi.fn().mockResolvedValue(response)
  chain.maybeSingle = vi.fn().mockResolvedValue(response)
  return chain
}

function mockSupabase(tableChains: Record<string, ReturnType<typeof chainableMock>> = {}) {
  return {
    from: vi.fn((table: string) => {
      return tableChains[table] || chainableMock()
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}

describe('householdSplitService', () => {
  describe('calculateAutoSplit', () => {
    it('debe distribuir proporcionalmente según ingresos', async () => {
      const members = [
        { user_id: 'user-a', split_percentage: 50 },
        { user_id: 'user-b', split_percentage: 50 },
      ]
      const incomeMap = new Map([
        ['user-a', 700000],
        ['user-b', 300000],
      ])

      const result = await householdSplitService.calculateAutoSplit(
        'household-1',
        members,
        incomeMap
      )

      expect(result.get('user-a')).toBe(70)
      expect(result.get('user-b')).toBe(30)
    })

    it('debe usar split manual cuando no hay ingresos', async () => {
      const members = [
        { user_id: 'user-a', split_percentage: 60 },
        { user_id: 'user-b', split_percentage: 40 },
      ]
      const incomeMap = new Map<string, number>()

      const result = await householdSplitService.calculateAutoSplit(
        'household-1',
        members,
        incomeMap
      )

      expect(result.get('user-a')).toBe(60)
      expect(result.get('user-b')).toBe(40)
    })

    it('debe manejar ingresos cero correctamente', async () => {
      const members = [
        { user_id: 'user-a', split_percentage: 50 },
        { user_id: 'user-b', split_percentage: 50 },
      ]
      const incomeMap = new Map([
        ['user-a', 100000],
        ['user-b', 0],
      ])

      const result = await householdSplitService.calculateAutoSplit(
        'household-1',
        members,
        incomeMap
      )

      expect(result.get('user-a')).toBe(100)
      expect(result.get('user-b')).toBe(0)
    })

    it('debe usar split manual cuando todos los ingresos son 0', async () => {
      const members = [
        { user_id: 'user-a', split_percentage: 33.33 },
        { user_id: 'user-b', split_percentage: 33.33 },
        { user_id: 'user-c', split_percentage: 33.34 },
      ]
      const incomeMap = new Map([
        ['user-a', 0],
        ['user-b', 0],
        ['user-c', 0],
      ])

      const result = await householdSplitService.calculateAutoSplit(
        'household-1',
        members,
        incomeMap
      )

      expect(result.get('user-a')).toBe(33.33)
      expect(result.get('user-b')).toBe(33.33)
      expect(result.get('user-c')).toBe(33.34)
    })
  })

  describe('splitHouseholdExpense', () => {
    const members = [
      { user_id: 'user-a', split_percentage: 50 },
      { user_id: 'user-b', split_percentage: 30 },
      { user_id: 'user-c', split_percentage: 20 },
    ]
    const incomeMap = new Map([
      ['user-a', 500000],
      ['user-b', 300000],
      ['user-c', 200000],
    ])

    it('crea share records para cada miembro que no es pagador', async () => {
      const shareRecordsChain = chainableMock()
      const balancesChain = chainableMock()
      const supabase = mockSupabase({
        household_share_records: shareRecordsChain,
        household_balances: balancesChain,
      })

      await householdSplitService.splitHouseholdExpense(
        supabase as any,
        'tx-1',
        'household-1',
        'user-a',
        10000,
        'ARS',
        members,
        incomeMap
      )

      expect(shareRecordsChain.insert).toHaveBeenCalledTimes(1)
      const inserted = (shareRecordsChain.insert as any).mock.calls[0][0]
      expect(inserted).toHaveLength(2)
      const owedIds = inserted.map((r: any) => r.owed_user_id)
      expect(owedIds).toContain('user-b')
      expect(owedIds).toContain('user-c')
      expect(owedIds).not.toContain('user-a')
    })

    it('no crea share record para el pagador', async () => {
      const shareRecordsChain = chainableMock()
      const balancesChain = chainableMock()
      const supabase = mockSupabase({
        household_share_records: shareRecordsChain,
        household_balances: balancesChain,
      })

      await householdSplitService.splitHouseholdExpense(
        supabase as any,
        'tx-1',
        'household-1',
        'user-b',
        10000,
        'ARS',
        members,
        incomeMap
      )

      const inserted = (shareRecordsChain.insert as any).mock.calls[0][0]
      const owedIds = inserted.map((r: any) => r.owed_user_id)
      expect(owedIds).not.toContain('user-b')
    })

    it('redondea montos a 2 decimales', async () => {
      const shareRecordsChain = chainableMock()
      const balancesChain = chainableMock()
      const supabase = mockSupabase({
        household_share_records: shareRecordsChain,
        household_balances: balancesChain,
      })

      await householdSplitService.splitHouseholdExpense(
        supabase as any,
        'tx-1',
        'household-1',
        'user-a',
        33.33,
        'ARS',
        [
          { user_id: 'user-a', split_percentage: 33.33 },
          { user_id: 'user-b', split_percentage: 33.33 },
          { user_id: 'user-c', split_percentage: 33.34 },
        ],
        new Map([])
      )

      const inserted = (shareRecordsChain.insert as any).mock.calls[0][0]
      for (const record of inserted) {
        const decimalPart = record.share_amount.toString().split('.')[1]
        if (decimalPart) {
          expect(decimalPart.length).toBeLessThanOrEqual(2)
        }
      }
    })
  })

  describe('settle', () => {
    it('crea settlement record via RPC', async () => {
      const supabase = mockSupabase()

      await householdSplitService.settle(supabase as any, 'hh-1', 'user-a', 'user-b', 5000)

      expect(supabase.rpc).toHaveBeenCalledWith('atomic_settle', {
        p_household_id: 'hh-1',
        p_from: 'user-a',
        p_to: 'user-b',
        p_amount: 5000,
      })
    })

    it('propaga error de RPC', async () => {
      const supabase = mockSupabase()
      supabase.rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') })

      await expect(
        householdSplitService.settle(supabase as any, 'hh-1', 'user-a', 'user-b', 5000)
      ).rejects.toThrow('DB error')
    })

    it('no lanza error si RPC retorna ok', async () => {
      const supabase = mockSupabase()
      supabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })

      await expect(
        householdSplitService.settle(supabase as any, 'hh-1', 'user-a', 'user-b', 5000)
      ).resolves.toBeUndefined()
    })
  })

  describe('getBalances', () => {
    it('retorna deudas con nombres de perfil', async () => {
      const balances = [
        { id: '1', household_id: 'hh-1', from_user_id: 'user-a', to_user_id: 'user-b', open_amount: 5000 },
      ]
      const profiles = [
        { id: 'user-a', full_name: 'Alice' },
        { id: 'user-b', full_name: 'Bob' },
      ]
      const balancesChain = chainableMock({ data: balances, error: null })
      const profilesChain = chainableMock({ data: profiles, error: null })
      const supabase = mockSupabase({
        household_balances: balancesChain,
        profiles: profilesChain,
      })

      const result = await householdSplitService.getBalances(supabase as any, 'hh-1', 'user-a')

      expect(result.owes).not.toBeNull()
      expect(result.owes!.to_user_name).toBe('Bob')
      expect(result.pairs).toHaveLength(1)
      expect(result.pairs[0].from_user_name).toBe('Alice')
      expect(result.pairs[0].to_user_name).toBe('Bob')
    })
  })
})
