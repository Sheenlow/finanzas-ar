'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Member {
  id: string
  household_id: string
  user_id: string
  role: 'admin' | 'member'
  split_percentage: number
  joined_at: string
  profiles?: { full_name?: string }
}

export function useHouseholdMembers(householdId: string | null, initialMembers: Member[], userId: string) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const supabase = createClient()

  const updateSplit = useCallback(async (memberId: string, splitPercentage: number) => {
    const { error } = await supabase
      .from('household_members')
      .update({ split_percentage: splitPercentage })
      .eq('id', memberId)
    if (error) throw error
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, split_percentage: splitPercentage } : m))
  }, [supabase])

  const removeMember = useCallback(async (memberId: string) => {
    const res = await fetch('/api/households/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }, [])

  const transferAdmin = useCallback(async (memberId: string): Promise<'member'> => {
    const res = await fetch('/api/households/transfer-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, role: 'admin' as const } :
      m.user_id === userId ? { ...m, role: 'member' as const } : m
    ))
    return 'member'
  }, [userId])

  const applyAutoSplit = useCallback(async (autoSplitMap: Map<string, number>) => {
    const updates = members.map(m => ({
      id: m.id,
      split_percentage: Math.round((autoSplitMap.get(m.user_id) ?? m.split_percentage) * 100) / 100,
    }))
    for (const update of updates) {
      await supabase
        .from('household_members')
        .update({ split_percentage: update.split_percentage })
        .eq('id', update.id)
    }
    setMembers(prev => prev.map(m => {
      const newSplit = updates.find(u => u.id === m.id)
      return newSplit ? { ...m, split_percentage: newSplit.split_percentage } : m
    }))
  }, [supabase, members])

  return { members, setMembers, updateSplit, removeMember, transferAdmin, applyAutoSplit }
}
