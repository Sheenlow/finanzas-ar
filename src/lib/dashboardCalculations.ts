import { getEffectiveMonth } from '@/lib/utils'

interface CryptoPrices {
  btc: number
  eth: number
}

export function calculateBalances(
  accounts: { currency: string; balance: number }[],
  cryptoPrices: CryptoPrices
): { totalArs: number; totalUsd: number } {
  let totalArs = 0
  let totalUsd = 0

  accounts.forEach(acc => {
    if (acc.currency === 'USD' || acc.currency === 'USDT' || acc.currency === 'USDC') {
      totalUsd += acc.balance
    } else if (acc.currency === 'BTC') {
      totalUsd += acc.balance * cryptoPrices.btc
    } else if (acc.currency === 'ETH') {
      totalUsd += acc.balance * cryptoPrices.eth
    } else if (acc.currency === 'ARS') {
      totalArs += acc.balance
    }
  })

  return { totalArs, totalUsd }
}

export function calculateTrends(
  transactions: any[],
  hhShare: number
): { month: string; ingresos: number; gastos: number }[] {
  const now = new Date()
  const trendMap = new Map<string, { ingresos: number; gastos: number }>()

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    trendMap.set(key, { ingresos: 0, gastos: 0 })
  }

  transactions.forEach((t: any) => {
    const key = getEffectiveMonth(t)
    const entry = trendMap.get(key)
    if (entry) {
      if (t.type === 'income') {
        entry.ingresos += t.amount
      } else if (t.type === 'expense' || t.type === 'subscription' || t.type === 'service') {
        entry.gastos += t.household_id ? t.amount * hhShare : t.amount
      }
    }
  })

  return Array.from(trendMap.entries()).map(([month, values]) => ({
    month,
    ...values,
  }))
}

export function calculateHouseholdSplit(
  membership: { split_percentage: number },
  incomes: { user_id: string; monthly_income_ars: number }[],
  userId: string
): number {
  let splitPercentage = membership.split_percentage

  if (incomes && incomes.length > 0) {
    const incomeMap = new Map(incomes.map((i) => [i.user_id, i.monthly_income_ars]))
    const totalIncome = Array.from(incomeMap.values()).reduce((sum, v) => sum + v, 0)
    if (totalIncome > 0) {
      const myIncome = incomeMap.get(userId) || 0
      const autoPct = (myIncome / totalIncome) * 100
      if (autoPct > 0) {
        splitPercentage = Math.round(autoPct * 100) / 100
      }
    }
  }

  return splitPercentage
}

export function getGreetingName(profile: { full_name: string | null } | null, user: any): string {
  return profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || ''
}
