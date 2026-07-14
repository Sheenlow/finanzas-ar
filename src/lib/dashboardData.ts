import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { accountsService } from '@/services/accountsService'
import { transactionsService } from '@/services/transactionsService'
import { reportService } from '@/services/reportService'
import { savingsGoalsService } from '@/services/savingsGoalsService'
import { exchangeRateService } from '@/services/exchangeRateService'
import { cryptoPriceService } from '@/services/cryptoPriceService'
import { calculateHouseholdSplit } from './dashboardCalculations'
import type { Database } from '@/types/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TypedSupabaseClient } from '@/types/supabase'

type Account = Database['public']['Tables']['accounts']['Row']
type Transaction = Database['public']['Tables']['transactions']['Row']
type SavingsGoal = Database['public']['Tables']['savings_goals']['Row']
type HouseholdMember = Database['public']['Tables']['household_members']['Row']

export interface ReportItem {
  name: string
  value: number
  color: string
  percentage: string
}

export interface MonthlyData {
  month: string
  amount: number
  count: number
}

export interface DashboardData {
  profile: { full_name: string | null } | null
  accounts: Account[]
  transactions: Transaction[]
  goals: SavingsGoal[]
  categories: { id: string; name: string; color: string }[]
  exchangeRate: number
  cryptoPrices: { btc: number; eth: number }
  membership: { split_percentage: number; household_id: string; households: { id: string; name: string } | null } | null
  botConfig: { link_token: string } | null
  botLink: { telegram_user_id: number } | null
  reportData: { items: Transaction[]; monthlyData: { month: string; amount: number }[] }
}

export interface HouseholdDashboardData {
  members: (HouseholdMember & { profiles?: { full_name: string | null } })[]
  transactions: Transaction[]
  sharedTransactionIds: string[]
  goals: SavingsGoal[]
  mySplitPercentage: number
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const [
    profileResult,
    accounts,
    transactions,
    goals,
    categoriesResult,
    exchangeRate,
    cryptoPrices,
    membershipResult,
    botConfigExisting,
    botLinkResult,
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    accountsService.getAll(supabase, userId),
    transactionsService.getAll(supabase, userId),
    savingsGoalsService.getAll(supabase, userId),
    supabase.from('categories').select('id, name, color').order('name'),
    exchangeRateService.getRate(),
    cryptoPriceService.getPrices(),
    supabase.from('household_members').select('*, households(id, name)').eq('user_id', userId).maybeSingle(),
    supabase.from('bot_config').select('link_token').eq('user_id', userId).maybeSingle(),
    supabase.from('bot_users').select('telegram_user_id').eq('supabase_user_id', userId).maybeSingle(),
  ])

  const profile = (profileResult as any)?.data as { full_name: string | null } | null
  const categories = ((categoriesResult as any)?.data || []) as { id: string; name: string; color: string }[]
  const membership = (membershipResult as any)?.data as DashboardData['membership']

  const reportData = reportService.getFixedExpenses(transactions as any)

  let botConfig: { link_token: string } | null = null
  const botConfigData = (botConfigExisting as any)?.data

  if (botConfigData?.link_token) {
    botConfig = botConfigData
  } else {
    const newToken = crypto.randomUUID()
    const { error: upsertErr } = await adminClient
      .from('bot_config')
      .upsert({ user_id: userId, link_token: newToken }, { onConflict: 'user_id' })
    if (upsertErr) console.error('bot_config upsert error:', upsertErr)
    else botConfig = { link_token: newToken }
  }

  const botLink = (botLinkResult as any)?.data as { telegram_user_id: number } | null

  return {
    profile,
    accounts,
    transactions: transactions as any[],
    goals,
    categories,
    exchangeRate,
    cryptoPrices,
    membership,
    botConfig,
    botLink,
    reportData,
  }
}

export async function getHouseholdDashboardData(
  supabase: TypedSupabaseClient,
  adminClient: SupabaseClient,
  userId: string,
  membership: NonNullable<DashboardData['membership']>
): Promise<HouseholdDashboardData> {
  const [
    { data: incomes },
    { data: members },
    hhTransactions,
    { data: sharedRecs },
    hhGoals,
  ] = await Promise.all([
    supabase.from('household_incomes').select('*').eq('household_id', membership.household_id),
    supabase.from('household_members').select('*, profiles(full_name)').eq('household_id', membership.household_id),
    transactionsService.getHouseholdTransactions(supabase, membership.household_id),
    adminClient.from('household_share_records').select('transaction_id').eq('household_id', membership.household_id),
    savingsGoalsService.getForHousehold(supabase, membership.household_id),
  ])

  const mySplitPercentage = calculateHouseholdSplit(membership, (incomes as any[]) || [], userId)

  return {
    members: members || [],
    transactions: hhTransactions,
    sharedTransactionIds: Array.from(new Set((sharedRecs || []).map((r: any) => r.transaction_id))),
    goals: hhGoals,
    mySplitPercentage,
  }
}
