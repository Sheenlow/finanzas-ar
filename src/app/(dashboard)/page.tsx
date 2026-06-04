import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { accountsService } from '@/services/accountsService';
import { transactionsService } from '@/services/transactionsService';
import { reportService } from '@/services/reportService';
import { savingsGoalsService } from '@/services/savingsGoalsService';
import { exchangeRateService } from '@/services/exchangeRateService';
import { cryptoPriceService } from '@/services/cryptoPriceService';
import { safeRedirect } from '@/lib/redirect';
import { AnimatedCard } from '@/components/AnimatedCard';
import { MonthSelector } from '@/components/MonthSelector';
import { FixedExpensesReport } from '@/components/dashboard/FixedExpensesReport';
import { MonthlyFixedExpensesReport } from '@/components/dashboard/MonthlyFixedExpensesReport';
import { MonthlyTransactions } from '@/components/dashboard/MonthlyTransactions';
import { ConsolidatedBalance } from '@/components/dashboard/ConsolidatedBalance';
import { DashboardGoals } from '@/components/dashboard/DashboardGoals';
import { DashboardHouseholdSummary } from '@/components/dashboard/DashboardHouseholdSummary';
import { TrendsChart } from '@/components/dashboard/TrendsChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { DashboardLayout } from '@/components/DashboardLayout';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return safeRedirect('/login');
  }

  const params = await searchParams;
  const selectedMonth = params.month || new Date().toISOString().slice(0, 7);

  const { data: profile } = (await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()) as { data: { full_name: string | null } | null };

  const greetingName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';

  const accounts = await accountsService.getAll(supabase, user.id);
  const transactions = await transactionsService.getAll(supabase, user.id);
  const goals = await savingsGoalsService.getAll(supabase, user.id);
  let householdGoals: any[] = [];

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, color')
    .order('name');
  const categoryMap = new Map((categories || []).map((c: any) => [c.id, c]));

  const exchangeRate = await exchangeRateService.getRate();
  const cryptoPrices = await cryptoPriceService.getPrices();
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
  let botLink: { telegram_user_id: number } | null = null

  // Force-create bot_config with a fresh token using admin client (bypasses RLS)
  const newToken = crypto.randomUUID()
  const { data: existing } = await adminClient
    .from('bot_config')
    .select('link_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.link_token) {
    botConfig = { link_token: existing.link_token }
  } else {
    const { error: upsertErr } = await adminClient
      .from('bot_config')
      .upsert({ user_id: user.id, link_token: newToken }, { onConflict: 'user_id' })
    if (upsertErr) console.error('bot_config upsert error:', upsertErr)
    else botConfig = { link_token: newToken }
  }

  const { data: link } = await supabase
    .from('bot_users')
    .select('telegram_user_id')
    .eq('supabase_user_id', user.id)
    .maybeSingle()
  botLink = link

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = now.toISOString().slice(0, 10);

  const filteredTransactions = transactions.filter((t: any) => {
    const isCurrentMonth = t.transaction_date.startsWith(selectedMonth);
    const isChild = t.parent_transaction_id && t.id !== t.parent_transaction_id;
    const isNotFuture = selectedMonth !== currentMonthKey || t.transaction_date.slice(0, 10) <= todayStr;
    return isCurrentMonth && !isChild && isNotFuture;
  });

  let householdMembers: any[] = [];
  let householdTransactions: any[] = [];
  let mySplitPercentage = 0;

  const { data: membership } = (await supabase
    .from('household_members')
    .select('*, households(id, name)')
    .eq('user_id', user.id)
    .maybeSingle()) as { data: { split_percentage: number; household_id: string; households: { id: string; name: string } | null } | null };

  if (membership) {
    mySplitPercentage = membership.split_percentage;

    const { data: incomes } = await supabase
      .from('household_incomes')
      .select('*')
      .eq('household_id', membership.household_id);

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

    const { data: members } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', membership.household_id);
    householdMembers = members || [];

    const hhTransactions = await transactionsService.getHouseholdTransactions(supabase, membership.household_id);
    householdTransactions = hhTransactions.filter((t: any) => {
      const isCurrentMonth = t.transaction_date.startsWith(selectedMonth);
      return isCurrentMonth;
    });
    householdGoals = await savingsGoalsService.getForHousehold(supabase, membership.household_id);
  }

  const hhShare = mySplitPercentage / 100;

  const trendMap = new Map<string, { ingresos: number; gastos: number }>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    trendMap.set(key, { ingresos: 0, gastos: 0 })
  }
  transactions.forEach((t: any) => {
    const key = t.transaction_date.slice(0, 7)
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

  const expenseByCategory = new Map<string, number>()
  filteredTransactions.forEach((t: any) => {
    if (t.type === 'expense' && t.category_id && categoryMap.has(t.category_id)) {
      const current = expenseByCategory.get(t.category_id) || 0
      expenseByCategory.set(t.category_id, current + (t.household_id ? t.amount * hhShare : t.amount))
    }
  })
  const totalExpenses = Array.from(expenseByCategory.values()).reduce((s, v) => s + v, 0)
  const pieData = Array.from(expenseByCategory.entries())
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <DashboardLayout>
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground text-sm mt-1">Bienvenido{greetingName ? ` ${greetingName.split(' ')[0]}` : ''} de nuevo a tu gestión financiera.</p>
            </div>
            <MonthSelector />
        </header>

        {botLink ? (
          <section className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-sm font-semibold text-foreground">Bot de Telegram vinculado</p>
                <p className="text-xs text-muted-foreground mt-0.5">Telegram ID: {botLink.telegram_user_id}</p>
              </div>
            </div>
          </section>
        ) : botConfig?.link_token ? (
          <section className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Vinculá tu bot de Telegram</p>
                <p className="text-xs text-muted-foreground mt-0.5">Enviá este código al bot para vincular tu cuenta</p>
                <code className="mt-1.5 inline-block text-xs bg-background border border-border rounded-lg px-3 py-1.5 font-mono select-all">{botConfig.link_token}</code>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">/vincular {botConfig.link_token.toString().slice(0, 8)}...</span>
            </div>
          </section>
        ) : null}

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
                  delay={index * 0.1}
                />
              ))}
            </div>
        </section>

        <MonthlyTransactions transactions={filteredTransactions} categories={categories || []} />

        <CategoryPieChart data={pieData} />

        {householdTransactions.length > 0 && (
          <DashboardHouseholdSummary
            transactions={householdTransactions}
            members={householdMembers}
            mySplitPercentage={mySplitPercentage}
            userId={user.id}
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
    </div>
  );
}
