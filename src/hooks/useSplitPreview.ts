'use client'

import { useState, useEffect } from 'react'

interface SplitPreviewItem {
  user_id: string
  name: string
  percentage: number
  amount: number
}

export function useSplitPreview(
  amount: string,
  members: any[],
  incomes: any[],
  userId: string,
  isHousehold: boolean
) {
  const [splitPreview, setSplitPreview] = useState<SplitPreviewItem[]>([])

  useEffect(() => {
    if (isHousehold && members.length > 0 && amount) {
      const totalAmount = parseFloat(amount) || 0
      const incomeMap = new Map(incomes.map((i: any) => [i.user_id, i.monthly_income_ars]))
      const memberList = members.filter((m: any) => m.user_id !== userId)
      const totalIncome = Array.from(incomeMap.values()).reduce((sum: number, v: number) => sum + v, 0)

      const preview: SplitPreviewItem[] = memberList.map((m: any) => {
        const income = incomeMap.get(m.user_id) || 0
        const name = m.profiles?.full_name || (m.user_id === userId ? 'Vos' : 'Miembro')
        const percentage = totalIncome > 0 ? (income / totalIncome) * 100 : (m.split_percentage || 0)
        return {
          user_id: m.user_id,
          name,
          percentage: Math.round(percentage * 100) / 100,
          amount: Math.round((totalAmount * percentage / 100) * 100) / 100
        }
      }).filter(p => p.percentage > 0)

      setSplitPreview(preview)
    } else {
      setSplitPreview([])
    }
  }, [isHousehold, amount, members, incomes, userId])

  return { splitPreview }
}
