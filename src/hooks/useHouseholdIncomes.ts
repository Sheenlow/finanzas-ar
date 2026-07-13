'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface HouseholdIncome {
  id: string
  user_id: string
  monthly_income_ars: number
  updated_at: string
}

export function useHouseholdIncomes(householdId: string | null) {
  const [incomes, setIncomes] = useState<HouseholdIncome[]>([])
  const supabase = createClient()

  const loadIncomes = useCallback(async () => {
    if (!householdId) return
    const { data } = await supabase
      .from('household_incomes')
      .select('*')
      .eq('household_id', householdId)
    setIncomes(data || [])
  }, [supabase, householdId])

  useEffect(() => {
    if (householdId) loadIncomes()
  }, [householdId, loadIncomes])

  const updateIncome = useCallback(async (monthly_income_ars: number) => {
    if (!householdId) return
    const res = await fetch('/api/households/incomes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ household_id: householdId, monthly_income_ars }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error)
    }
    await loadIncomes()
  }, [householdId, loadIncomes])

  const incomeMap = useMemo(() => new Map(incomes.map(i => [i.user_id, i.monthly_income_ars])), [incomes])
  const totalIncome = useMemo(() => Array.from(incomeMap.values()).reduce((sum, v) => sum + v, 0), [incomeMap])

  return { incomes, loadIncomes, updateIncome, incomeMap, totalIncome }
}
