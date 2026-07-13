'use client'

import { useState } from 'react'

export function useSettlements(_householdId: string | null, initialSettlements: any[] = []) {
  const [settlements] = useState(initialSettlements)

  return { settlements }
}
