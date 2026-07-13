import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getDashboardData, getHouseholdDashboardData } from '@/lib/dashboardData'
import { calculateBalances, calculateTrends, calculateHouseholdSplit, getGreetingName } from '@/lib/dashboardCalculations'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const params = await searchParams
  const selectedMonth = params.month || new Date().toISOString().slice(0, 7)

  const data = await getDashboardData(user.id)
  const categoryMap = new Map((data.categories || []).map((c) => [c.id, c]))
  const balances = calculateBalances(data.accounts, data.cryptoPrices)

  let householdData = null
  if (data.membership) {
    const adminClient = createAdminClient()
    householdData = await getHouseholdDashboardData(supabase, adminClient, user.id, data.membership)
  }

  const hhShare = householdData ? householdData.mySplitPercentage / 100 : 0
  const trendData = calculateTrends(data.transactions, hhShare)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <DashboardClient
        greetingName={getGreetingName(data.profile, user)}
        accounts={data.accounts}
        transactions={data.transactions}
        goals={data.goals}
        categories={data.categories}
        exchangeRate={data.exchangeRate}
        cryptoPrices={data.cryptoPrices}
        totalArs={balances.totalArs}
        totalUsd={balances.totalUsd}
        reportData={data.reportData}
        trendData={trendData}
        botConfig={data.botConfig}
        botLink={data.botLink}
        householdMembers={householdData?.members || []}
        householdTransactions={householdData?.transactions || []}
        sharedTransactionIds={householdData?.sharedTransactionIds || []}
        householdGoals={householdData?.goals || []}
        mySplitPercentage={householdData?.mySplitPercentage || 0}
        userId={user.id}
        initialMonth={selectedMonth}
      />
    </div>
  )
}
