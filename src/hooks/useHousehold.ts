'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type HouseholdMember = Database['public']['Tables']['household_members']['Row']
type HouseholdIncome = Database['public']['Tables']['household_incomes']['Row']

interface UseHouseholdReturn {
  householdId: string | null
  myRole: string | null
  mySplitPercentage: number
  members: (HouseholdMember & { profiles: { full_name: string | null } | null })[]
  incomes: HouseholdIncome[]
  loading: boolean
  refresh: () => void
}

export function useHousehold(userId: string): UseHouseholdReturn {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [mySplitPercentage, setMySplitPercentage] = useState(0)
  const [members, setMembers] = useState<UseHouseholdReturn['members']>([])
  const [incomes, setIncomes] = useState<HouseholdIncome[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: membership } = await supabase
        .from('household_members')
        .select('*, households(id, name)')
        .eq('user_id', userId)
        .maybeSingle()

      if (membership) {
        setHouseholdId(membership.household_id)
        setMyRole(membership.role)
        setMySplitPercentage(membership.split_percentage)

        const [{ data: m }, { data: i }, { data: p }] = await Promise.all([
          supabase
            .from('household_members')
            .select('*')
            .eq('household_id', membership.household_id),
          supabase
            .from('household_incomes')
            .select('*')
            .eq('household_id', membership.household_id),
          supabase
            .from('profiles')
            .select('id, full_name')
        ])

        const profileLookup = new Map((p || []).map((prof) => [prof.id, prof]))
        const merged = (m || []).map((member) => ({
          ...member,
          profiles: profileLookup.has(member.user_id)
            ? { full_name: (profileLookup.get(member.user_id) as { full_name?: string | null } | undefined)?.full_name ?? null }
            : null,
        }))

        setMembers(merged)
        setIncomes(i || [])
      } else {
        setHouseholdId(null)
        setMyRole(null)
        setMySplitPercentage(0)
        setMembers([])
        setIncomes([])
      }
    } catch (error) {
      console.error('Error loading household:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, userId])

  useEffect(() => {
    load()
  }, [load])

  return { householdId, myRole, mySplitPercentage, members, incomes, loading, refresh: load }
}
