'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { AnimatedCard } from '@/components/AnimatedCard'
import { MonthlyTransactions } from '@/components/dashboard/MonthlyTransactions'
import { DashboardHouseholdSummary } from '@/components/dashboard/DashboardHouseholdSummary'
import { DashboardGoals } from '@/components/dashboard/DashboardGoals'
import { DashboardLayout } from '@/components/DashboardLayout'
import { MonthSelector } from '@/components/MonthSelector'
import { ConsolidatedBalance } from '@/components/dashboard/ConsolidatedBalance'
import { getEffectiveMonth } from '@/lib/utils'

const TrendsChart = dynamic(() => import('@/components/dashboard/TrendsChart').then(mod => mod.TrendsChart), {
  ssr: false,
  loading: () => <div className="h-64" />
})
const CategoryPieChart = dynamic(() => import('@/components/dashboard/CategoryPieChart').then(mod => mod.CategoryPieChart), {
  ssr: false,
  loading: () => <div className="h-64" />
})
const FixedExpensesReport = dynamic(() => import('@/components/dashboard/FixedExpensesReport').then(mod => mod.FixedExpensesReport), {
  ssr: false,
  loading: () => <div className="h-64" />
})
const MonthlyFixedExpensesReport = dynamic(() => import('@/components/dashboard/MonthlyFixedExpensesReport').then(mod => mod.MonthlyFixedExpensesReport), {
  ssr: false,
  loading: () => <div className="h-64" />
})

interface Props {
  greetingName: string
  accounts: any[]
  transactions: any[]
  goals: any[]
  categories: any[]
  exchangeRate: number
  cryptoPrices: { btc: number; eth: number }
  totalArs: number
  totalUsd: number
  reportData: { items: any[]; monthlyData: any[] }
  trendData: any[]
  botConfig: { link_token: string } | null
  botLink: { telegram_user_id: number } | null
  householdMembers: any[]
  householdTransactions: any[]
  sharedTransactionIds: string[]
  householdGoals: any[]
  mySplitPercentage: number
  userId: string
  initialMonth: string
}

export function DashboardClient({
  greetingName,
  accounts,
  transactions,
  goals,
  categories,
  exchangeRate,
  cryptoPrices,
  totalArs,
  totalUsd,
  reportData,
  trendData,
  botConfig,
  botLink,
  householdMembers,
  householdTransactions,
  sharedTransactionIds,
  householdGoals,
  mySplitPercentage,
  userId,
  initialMonth,
}: Props) {
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)

  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month)
    router.replace(`/?month=${month}`, { scroll: false })
  }, [router])

  const categoryMap = useMemo(
    () => new Map(categories.map((c: any) => [c.id, c])),
    [categories]
  )

  const filteredTransactions = useMemo(() => {
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const todayStr = now.toISOString().slice(0, 10)

    return transactions.filter((t: any) => {
      const effectiveMonth = getEffectiveMonth(t)
      const isCurrentMonth = effectiveMonth === selectedMonth
      const isChild = t.parent_transaction_id && t.id !== t.parent_transaction_id
      const isNotFuture = selectedMonth !== currentMonthKey || t.transaction_date.slice(0, 10) <= todayStr
      return isCurrentMonth && !isChild && isNotFuture
    })
  }, [transactions, selectedMonth])

  const householdFiltered = useMemo(() => {
    return householdTransactions.filter((t: any) => {
      const effectiveMonth = getEffectiveMonth(t)
      return effectiveMonth === selectedMonth
    })
  }, [householdTransactions, selectedMonth])

  const hhShare = mySplitPercentage / 100

  const pieData = useMemo(() => {
    const expenseByCategory = new Map<string, number>()
    filteredTransactions.forEach((t: any) => {
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

  return (
    <DashboardLayout>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Bienvenido{greetingName ? ` ${greetingName.split(' ')[0]}` : ''} de nuevo a tu gestión financiera.</p>
        </div>
        <MonthSelector value={selectedMonth} onChange={handleMonthChange} />
      </header>

      {botLink ? (
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Bot de Telegram vinculado</p>
              <p className="text-xs text-muted-foreground mt-0.5">Telegram ID: {botLink.telegram_user_id}</p>
              <a href="https://t.me/FinanzasArBot" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1 inline-block">
                @FinanzasArBot · t.me/FinanzasArBot
              </a>
            </div>
          </div>
        </motion.section>
      ) : botConfig?.link_token ? (
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-card border border-border border-l-4 border-l-indigo-500 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Vinculá tu bot de Telegram</p>
              <p className="text-xs text-muted-foreground mt-0.5">Enviá este código al bot para vincular tu cuenta</p>
              <code className="mt-1.5 inline-block text-xs bg-background border border-border rounded-lg px-3 py-1.5 font-mono select-all">{botConfig.link_token}</code>
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">/vincular {botConfig.link_token.toString().slice(0, 8)}...</span>
              </div>
              <a href="https://t.me/FinanzasArBot" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1 inline-block">
                @FinanzasArBot · t.me/FinanzasArBot
              </a>
            </div>
          </div>
        </motion.section>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-card border border-border border-l-4 border-l-amber-500 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Bot de Telegram</p>
              <p className="text-xs text-muted-foreground mt-0.5">Usá el comando /config para empezar.</p>
              <a href="https://t.me/FinanzasArBot" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1 inline-block">
                @FinanzasArBot · t.me/FinanzasArBot
              </a>
            </div>
          </div>
        </motion.section>
      )}

      <ConsolidatedBalance totalArs={totalArs} totalUsd={totalUsd} rate={exchangeRate} />

      <section className="my-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account, index) => (
            <AnimatedCard
              key={account.id}
              title={account.name}
              amount={account.balance}
              currency={account.currency as "ARS" | "USD"}
              type={account.type as "bank" | "cash" | "crypto"}
              delay={index * 0.05}
            />
          ))}
        </div>
      </section>

      <MonthlyTransactions transactions={filteredTransactions} categories={categories} />

      <CategoryPieChart data={pieData} />

      {householdFiltered.length > 0 && (
        <DashboardHouseholdSummary
          transactions={householdFiltered}
          members={householdMembers}
          mySplitPercentage={mySplitPercentage}
          userId={userId}
          sharedTransactionIds={sharedTransactionIds}
        />
      )}

      <DashboardGoals goals={goals} householdGoals={householdGoals} />

      <TrendsChart data={trendData} />

      <FixedExpensesReport data={reportData.items} monthlyData={reportData.monthlyData} />

      <MonthlyFixedExpensesReport
        transactions={transactions}
        selectedMonth={selectedMonth}
        exchangeRate={exchangeRate}
        cryptoPrices={cryptoPrices}
      />
    </DashboardLayout>
  )
}
