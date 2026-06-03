import { describe, it, expect } from 'vitest'
import { householdSplitService } from '@/services/householdSplitService'

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
  })
})
