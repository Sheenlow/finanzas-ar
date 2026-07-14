'use client'

import { useState } from 'react'
import type { Database } from '@/types/database.types'

type HouseholdSettlement = Database['public']['Tables']['household_settlements']['Row']

export function useSettlements(_householdId: string | null, initialSettlements: HouseholdSettlement[] = []) {
  const [settlements] = useState(initialSettlements)

  return { settlements }
}
