import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { accountsService } from '@/services/accountsService';
import { transactionsService } from '@/services/transactionsService';
import { reportService } from '@/services/reportService';
import { savingsGoalsService } from '@/services/savingsGoalsService';
import { exchangeRateService } from '@/services/exchangeRateService';
import { cryptoPriceService } from '@/services/cryptoPriceService';
import { redirect } from 'next/navigation';
import { getEffectiveMonth } from '@/lib/utils';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const params = await searchParams;
  const selectedMonth = params.month || new Date().toISOString().slice(0, 7);

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
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    accountsService.getAll(supabase, user.id),
    transactionsService.getAll(supabase, user.id),
    savingsGoalsService.getAll(supabase, user.id),
    supabase.from('categories').select('id, name, color').order('name'),
    exchangeRateService.getRate(),
    cryptoPriceService.getPrices(),
    supabase.from('household_members').select('*, households(id, name)').eq('user_id', user.id).maybeSingle(),
    supabase.from('bot_config').select('link_token').eq('user_id', user.id).maybeSingle(),
    supabase.from('bot_users').select('telegram_user_id').eq('supabase_user_id', user.id).maybeSingle(),
  ]);

  const profile = (profileResult as any)?.data as { full_name: string | null } | null;
  const categories: { id: string; name: string; color: string }[] = (categoriesResult as any)?.data || [];
  const membership = (membershipResult as any)?.data as { split_percentage: number; household_id: string; households: { id: string; name: string } | null } | null;

  const greetingName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
  const categoryMap = new Map<string, { id: string; name: string; color: string }>((categories || []).map((c) => [c.id, c]));

  let totalArs = 0;
  let totalUsd = 0;

  accounts.forEach(acc => {
    if (acc.currency === 'USD' || acc.currency === 'USDT' || acc.currency === 'USDC') {
      totalUsd += acc.balance;
    } else if (acc.currency === 'BTC') {
      totalUsd += acc.balance * cryptoPrices.btc;
    } else if (acc.currency === 'ETH') {
      totalUsd += acc.balance * cryptoPrices.eth;
    } else if (acc.currency === 'ARS') {
      totalArs += acc.balance;
    }
  });

  const reportData = reportService.getFixedExpenses(transactions);

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let botConfig: { link_token: string } | null = null
  const botConfigData = (botConfigExisting as any)?.data

  if (botConfigData?.link_token) {
    botConfig = botConfigData
  } else {
    const newToken = crypto.randomUUID()
    const { error: upsertErr } = await adminClient
      .from('bot_config')
      .upsert({ user_id: user.id, link_token: newToken }, { onConflict: 'user_id' })
    if (upsertErr) console.error('bot_config upsert error:', upsertErr)
    else botConfig = { link_token: newToken }
  }

  const botLink = (botLinkResult as any)?.data

  let householdMembers: any[] = [];
  let householdTransactions: any[] = [];
  let sharedTransactionIds: string[] = [];
  let householdGoals: any[] = [];
  let mySplitPercentage = 0;

  if (membership) {
    mySplitPercentage = membership.split_percentage;

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
    ]);

    if (incomes && incomes.length > 0) {
      const incomeMap = new Map(incomes.map((i: any) => [i.user_id, i.monthly_income_ars]));
      const totalIncome = Array.from(incomeMap.values()).reduce((sum: number, v: number) => sum + v, 0);
      if (totalIncome > 0) {
        const myIncome = incomeMap.get(user.id) || 0;
        const autoPct = (myIncome / totalIncome) * 100;
        if (autoPct > 0) {
          mySplitPercentage = Math.round(autoPct * 100) / 100;
        }
      }
    }

    householdMembers = members || [];
    householdTransactions = hhTransactions;
    sharedTransactionIds = Array.from(new Set((sharedRecs || []).map((r: any) => r.transaction_id)));
    householdGoals = hhGoals;
  }

  const now = new Date();

  const hhShare = mySplitPercentage / 100;

  const trendMap = new Map<string, { ingresos: number; gastos: number }>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    trendMap.set(key, { ingresos: 0, gastos: 0 })
  }
  transactions.forEach((t: any) => {
    const key = getEffectiveMonth(t);
    const entry = trendMap.get(key)
    if (entry) {
      if (t.type === 'income') {
        entry.ingresos += t.amount
      } else if (t.type === 'expense' || t.type === 'subscription' || t.type === 'service') {
        entry.gastos += t.household_id ? t.amount * hhShare : t.amount
      }
    }
  })
  const trendData = Array.from(trendMap.entries()).map(([month, values]) => ({
    month,
    ...values,
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <DashboardClient
        greetingName={greetingName}
        accounts={accounts}
        transactions={transactions}
        goals={goals}
        categories={categories}
        exchangeRate={exchangeRate}
        cryptoPrices={cryptoPrices}
        totalArs={totalArs}
        totalUsd={totalUsd}
        reportData={reportData}
        trendData={trendData}
        botConfig={botConfig}
        botLink={botLink}
        householdMembers={householdMembers}
        householdTransactions={householdTransactions}
        sharedTransactionIds={sharedTransactionIds}
        householdGoals={householdGoals}
        mySplitPercentage={mySplitPercentage}
        userId={user.id}
        initialMonth={selectedMonth}
      />
    </div>
  );
}
