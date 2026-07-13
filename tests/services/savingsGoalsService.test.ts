import { describe, it, expect, vi } from 'vitest'
import { savingsGoalsService } from '@/services/savingsGoalsService'

function mockBuilder(result: { data: any; error: any }) {
  const b: any = { data: result.data, error: result.error }
  const methods = ['select', 'eq', 'order', 'insert', 'update', 'delete', 'single', 'is']
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

describe('savingsGoalsService', () => {
  describe('getAll', () => {
    it('retorna metas personales (household_id IS NULL)', async () => {
      const goals = [
        { id: 'g1', name: 'Vacaciones', target_amount: 500000, current_amount: 200000, user_id: 'u1', household_id: null },
      ]
      const supabase = mockSupabase({
        savings_goals: { data: goals, error: null },
      })

      const result = await savingsGoalsService.getAll(supabase, 'u1')
      expect(result).toEqual(goals)
      expect(supabase.from).toHaveBeenCalledWith('savings_goals')
    })
  })

  describe('getForHousehold', () => {
    it('retorna metas del hogar', async () => {
      const goals = [
        { id: 'g2', name: 'Fondo Hogar', target_amount: 1000000, current_amount: 300000, user_id: 'u1', household_id: 'h1' },
      ]
      const supabase = mockSupabase({
        savings_goals: { data: goals, error: null },
      })

      const result = await savingsGoalsService.getForHousehold(supabase, 'h1')
      expect(result).toEqual(goals)
      expect(supabase.from).toHaveBeenCalledWith('savings_goals')
    })
  })

  describe('create', () => {
    it('inserta nueva meta', async () => {
      const newGoal = { id: 'g3', name: 'Auto', target_amount: 2000000, current_amount: 0, user_id: 'u1', household_id: null }
      const supabase = mockSupabase({
        savings_goals: { data: newGoal, error: null },
      })

      const result = await savingsGoalsService.create(supabase, {
        user_id: 'u1',
        name: 'Auto',
        target_amount: 2000000,
        current_amount: 0,
      } as any)
      expect(result).toEqual(newGoal)
      expect(supabase.from).toHaveBeenCalledWith('savings_goals')
    })
  })

  describe('getDeposits', () => {
    it('retorna depositos ordenados', async () => {
      const deposits = [
        { id: 'd1', goal_id: 'g1', amount: 50000, created_at: '2026-07-01', user_id: 'u1' },
        { id: 'd2', goal_id: 'g1', amount: 30000, created_at: '2026-06-15', user_id: 'u1' },
      ]
      const supabase = mockSupabase({
        goal_deposits: { data: deposits, error: null },
      })

      const result = await savingsGoalsService.getDeposits(supabase, 'g1')
      expect(result).toEqual(deposits)
      expect(supabase.from).toHaveBeenCalledWith('goal_deposits')
    })
  })

  describe('delete', () => {
    it('elimina meta', async () => {
      const supabase = mockSupabase({
        savings_goals: { data: null, error: null },
      })

      await expect(savingsGoalsService.delete(supabase, 'g1')).resolves.toBeUndefined()
    })
  })
})
