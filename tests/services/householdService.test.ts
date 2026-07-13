import { describe, it, expect, vi } from 'vitest'
import { householdService } from '@/services/householdService'

function mockQueryResponse(data: any = null, error: any = null) {
  return { data, error }
}

function mockSupabaseFrom(overrides: Record<string, any> = {}) {
  const from = vi.fn()
  from.mockImplementation((table: string) => {
    if (overrides[table]) return overrides[table]
    return { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
  })
  return { from }
}

describe('householdService', () => {
  describe('getByUserId', () => {
    it('retorna households del usuario', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockQueryResponse([
              { households: { id: 'h1', name: 'Casa', created_at: '', updated_at: '' } },
            ])),
          }),
        }),
      } as any

      const result = await householdService.getByUserId(supabase, 'user-1')

      expect(result).toEqual([{ id: 'h1', name: 'Casa', created_at: '', updated_at: '' }])
      expect(supabase.from).toHaveBeenCalledWith('household_members')
    })
  })

  describe('getMembers', () => {
    it('retorna miembros con perfiles', async () => {
      const members = [
        { id: 'm1', household_id: 'h1', user_id: 'u1', role: 'admin', split_percentage: 50, created_at: '', updated_at: '' },
      ]

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockQueryResponse(members)),
          }),
        }),
      } as any

      const result = await householdService.getMembers(supabase, 'h1')

      expect(result).toEqual(members)
      expect(supabase.from).toHaveBeenCalledWith('household_members')
    })
  })

  describe('create', () => {
    it('crea household y miembro admin', async () => {
      const supabase = {
        from: vi.fn()
          .mockReturnValueOnce({
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockQueryResponse({ id: 'h1', name: 'Mi Casa', created_at: '', updated_at: '' })),
              }),
            }),
          })
          .mockReturnValueOnce({
            insert: vi.fn().mockResolvedValue(mockQueryResponse(null, null)),
          }),
      } as any

      const result = await householdService.create(supabase, 'Mi Casa', 'user-1')

      expect(result).toEqual({ id: 'h1', name: 'Mi Casa', created_at: '', updated_at: '' })
      expect(supabase.from).toHaveBeenCalledWith('households')
      expect(supabase.from).toHaveBeenCalledWith('household_members')
    })
  })

  describe('updateSplit', () => {
    it('actualiza split_percentage', async () => {
      const updated = { id: 'm1', household_id: 'h1', user_id: 'u1', role: 'admin', split_percentage: 70, created_at: '', updated_at: '' }

      const supabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockQueryResponse(updated)),
              }),
            }),
          }),
        }),
      } as any

      const result = await householdService.updateSplit(supabase, 'm1', 70)

      expect(result).toEqual(updated)
      expect(supabase.from).toHaveBeenCalledWith('household_members')
    })
  })

  describe('getMyMembership', () => {
    it('retorna membresia del usuario', async () => {
      const membership = {
        id: 'm1',
        household_id: 'h1',
        user_id: 'u1',
        role: 'admin',
        split_percentage: 100,
        created_at: '',
        updated_at: '',
        households: { id: 'h1', name: 'Casa', created_at: '', updated_at: '' },
      }

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(mockQueryResponse(membership)),
            }),
          }),
        }),
      } as any

      const result = await householdService.getMyMembership(supabase, 'u1')

      expect(result).toEqual(membership)
      expect(supabase.from).toHaveBeenCalledWith('household_members')
    })
  })

  describe('removeMember', () => {
    it('elimina miembro', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockQueryResponse(null, null)),
          }),
        }),
      } as any

      await expect(householdService.removeMember(supabase, 'm1')).resolves.toBeUndefined()
      expect(supabase.from).toHaveBeenCalledWith('household_members')
    })
  })
})
