'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Database } from '@/types/database.types'
import { MonthlyTransactions } from '@/components/dashboard/MonthlyTransactions'
import { QuickTransactionInput } from '@/components/forms/QuickTransactionInput'
import { DashboardHouseholdSummary } from '@/components/dashboard/DashboardHouseholdSummary'
import { DashboardGoals } from '@/components/dashboard/DashboardGoals'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ConsolidatedBalance } from '@/components/dashboard/ConsolidatedBalance'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { useUser } from '@/components/UserProvider'
import { getEffectiveMonth } from '@/lib/utils'
import { DashboardHeader } from './DashboardHeader'
import { BotBanner } from './BotBanner'
import { DashboardAccountsGrid } from './DashboardAccountsGrid'
import { OfflineBanner } from '@/components/OfflineBanner'

const TrendsChart = dynamic(() => import('@/components/dashboard/TrendsChart').then(mod => mod.TrendsChart), {
  ssr: false, loading: () => <div className="h-64" />
})
const CategoryPieChart = dynamic(() => import('@/components/dashboard/CategoryPieChart').then(mod => mod.CategoryPieChart), {
  ssr: false, loading: () => <div className="h-64" />
})
const FixedExpensesReport = dynamic(() => import('@/components/dashboard/FixedExpensesReport').then(mod => mod.FixedExpensesReport), {
  ssr: false, loading: () => <div className="h-64" />
})
const MonthlyFixedExpensesReport = dynamic(() => import('@/components/dashboard/MonthlyFixedExpensesReport').then(mod => mod.MonthlyFixedExpensesReport), {
  ssr: false, loading: () => <div className="h-64" />
})

type AccountRow = Database['public']['Tables']['accounts']['Row']
type TransactionRow = Database['public']['Tables']['transactions']['Row']
type SavingsGoalRow = Database['public']['Tables']['savings_goals']['Row']
type HouseholdMemberRow = Database['public']['Tables']['household_members']['Row']

interface TrendItem {
  month: string
  ingresos: number
  gastos: number
}

interface Props {
  greetingName: string
  accounts: AccountRow[]
  transactions: TransactionRow[]
  goals: SavingsGoalRow[]
  categories: { id: string; name: string; color: string }[]
  exchangeRate: number
  cryptoPrices: { btc: number; eth: number }
  totalArs: number
  totalUsd: number
  reportData: { items: TransactionRow[]; monthlyData: { month: string; amount: number; count: number }[] }
  trendData: TrendItem[]
  botConfig: { link_token: string } | null
  botLink: { telegram_user_id: number } | null
  householdMembers: (HouseholdMemberRow & { profiles?: { full_name: string | null } })[]
  householdTransactions: TransactionRow[]
  sharedTransactionIds: string[]
  householdGoals: SavingsGoalRow[]
  mySplitPercentage: number
  userId: string
  initialMonth: string
}

export function DashboardClient({
  greetingName, accounts, transactions, goals, categories,
  exchangeRate, cryptoPrices, totalArs, totalUsd, reportData, trendData,
  botConfig, botLink, householdMembers, householdTransactions,
  sharedTransactionIds, householdGoals, mySplitPercentage, userId, initialMonth,
}: Props) {
  const router = useRouter()
  const { profile, loading: profileLoading, refresh: refreshUser } = useUser()
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)

  const handleCompleteOnboarding = useCallback(() => { window.location.href = '/' }, [])
  const handleRefresh = useCallback(() => { router.refresh() }, [router])
  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month)
    router.replace(`/?month=${month}`, { scroll: false })
  }, [router])
  const navigateToAccounts = useCallback(() => { router.push('/accounts') }, [router])
  const navigateToTransactions = useCallback(() => { router.push('/transactions') }, [router])

  const minMonth = useMemo(() => {
    if (transactions.length === 0) return undefined
    const dates = transactions.map((t) => t.transaction_date).filter(Boolean)
    if (dates.length === 0) return undefined
    return dates.sort()[0].slice(0, 7)
  }, [transactions])

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )

  const filteredTransactions = useMemo(() => {
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const todayStr = now.toISOString().slice(0, 10)
    return transactions.filter((t) => {
      const effectiveMonth = getEffectiveMonth(t)
      const isCurrentMonth = effectiveMonth === selectedMonth
      const isChild = t.parent_transaction_id && t.id !== t.parent_transaction_id
      const isNotFuture = selectedMonth !== currentMonthKey || t.transaction_date.slice(0, 10) <= todayStr
      return isCurrentMonth && !isChild && isNotFuture
    })
  }, [transactions, selectedMonth])

  const householdFiltered = useMemo(() => {
    return householdTransactions.filter((t) => {
      const effectiveMonth = getEffectiveMonth(t)
      return effectiveMonth === selectedMonth
    })
  }, [householdTransactions, selectedMonth])

  const hhShare = mySplitPercentage / 100

  const pieData = useMemo(() => {
    const expenseByCategory = new Map<string, number>()
    filteredTransactions.forEach((t) => {
      if (t.type === 'expense' && t.category_id && categoryMap.has(t.category_id)) {
        const current = expenseByCategory.get(t.category_id) || 0
        expenseByCategory.set(t.category_id, current + (t.household_id ? t.amount * hhShare : t.amount))
      }
    })
    const totalExpenses = Array.from(expenseByCategory.values()).reduce((s, v) => s + v, 0)
    return Array.from(expenseByCategory.entries())
      .map(([catId, value]) => {
        const cat = categoryMap.get(catId)
        return {
          name: cat?.name || 'Sin categoría',
          value,
          color: cat?.color || '#94a3b8',
          percentage: totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : '0',
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [filteredTransactions, categoryMap, hhShare])

  if (profileLoading || !profile) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!profile.onboarding_completed) {
    return (
      <DashboardLayout>
        <OnboardingWizard userId={userId} onComplete={handleCompleteOnboarding} />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <OfflineBanner />
      <DashboardHeader
        greetingName={greetingName}
        selectedMonth={selectedMonth}
        minMonth={minMonth}
        onMonthChange={handleMonthChange}
      />

      <QuickTransactionInput userId={userId} className="mb-6" />

      <BotBanner botConfig={botConfig} botLink={botLink} />

      <ConsolidatedBalance
        totalArs={totalArs} totalUsd={totalUsd} rate={exchangeRate}
        hasAccounts={accounts.length > 0} onCreateAccount={navigateToAccounts}
      />

      <section className="my-8">
        <DashboardAccountsGrid accounts={accounts} onCreateAccount={navigateToAccounts} />
      </section>

      <MonthlyTransactions transactions={filteredTransactions} categories={categories} onRegisterTransaction={navigateToTransactions} />

      <CategoryPieChart data={pieData} onRegisterTransaction={navigateToTransactions} />

      {householdFiltered.length > 0 && (
        <DashboardHouseholdSummary
          transactions={householdFiltered as any}
          members={householdMembers as any}
          mySplitPercentage={mySplitPercentage}
          userId={userId}
          sharedTransactionIds={sharedTransactionIds}
        />
      )}

      <DashboardGoals goals={goals} householdGoals={householdGoals} />

      <TrendsChart data={trendData} />

      <FixedExpensesReport data={reportData.items as any} monthlyData={reportData.monthlyData} />

      <MonthlyFixedExpensesReport
        transactions={transactions} selectedMonth={selectedMonth}
        exchangeRate={exchangeRate} cryptoPrices={cryptoPrices}
      />
    </DashboardLayout>
  )
}
