import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { safeRedirect } from '@/lib/redirect';
import { HouseholdManager } from '@/components/household/HouseholdManager';
import { savingsGoalsService } from '@/services/savingsGoalsService';

export const dynamic = 'force-dynamic';

export default async function HogarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return safeRedirect('/login');
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: membership } = await adminClient
    .from('household_members')
    .select('*, households(*)')
    .eq('user_id', user.id)
    .maybeSingle();

  const household = membership?.households || null;
  const myRole = membership?.role || null;

  let members: any[] = [];
  let transactions: any[] = [];
  let settlements: any[] = [];
  let householdGoals: any[] = [];
  let sharedTransactionIds: string[] = [];
  let profileMap = new Map<string, any>();
  let monthlyReport: { name: string; value: number; color: string; percentage: string }[] = [];

  if (household) {
    const [{ data: m }, { data: t }, { data: s }, { data: p }, { data: allCategories }, { data: monthlyTx }] = await Promise.all([
      adminClient
        .from('household_members')
        .select('*')
        .eq('household_id', household.id)
        .order('role', { ascending: false }),
      adminClient
        .from('transactions')
        .select('*')
        .eq('household_id', household.id)
        .is('parent_transaction_id', null)
        .order('transaction_date', { ascending: false })
        .limit(20),
      adminClient
        .from('household_settlements')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false })
        .limit(10),
      adminClient
        .from('profiles')
        .select('id, full_name'),
      supabase
        .from('categories')
        .select('id, name, color')
        .order('name'),
      adminClient
        .from('transactions')
        .select('category_id, amount, type')
        .eq('household_id', household.id)
        .gte('transaction_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

    const profilesData = p || [];
    const localMap = new Map(profilesData.map((p: any) => [p.id, p]));
    profileMap = localMap;

    members = (m || []).map(member => ({
      ...member,
      profiles: localMap.has(member.user_id)
        ? { full_name: localMap.get(member.user_id).full_name }
        : null,
    }));
    transactions = t || [];
    settlements = s || [];

    const categoryMap = new Map((allCategories || []).map((c: any) => [c.id, c]));
    const expenseByCategory = new Map<string, number>();
    (monthlyTx || []).forEach((t: any) => {
      if (t.type !== 'expense') return;
      if (!t.category_id || !categoryMap.has(t.category_id)) return;
      const current = expenseByCategory.get(t.category_id) || 0;
      expenseByCategory.set(t.category_id, current + t.amount);
    });
    const totalExpenses = Array.from(expenseByCategory.values()).reduce((s, v) => s + v, 0);
    monthlyReport = Array.from(expenseByCategory.entries())
      .map(([catId, value]) => {
        const cat = categoryMap.get(catId);
        return {
          name: cat?.name || 'Sin categoría',
          value,
          color: cat?.color || '#94a3b8',
          percentage: totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : '0',
        };
      })
      .sort((a, b) => b.value - a.value);

    householdGoals = await savingsGoalsService.getForHousehold(supabase, household.id);

    const { data: sharedRecs } = await adminClient
      .from('household_share_records')
      .select('transaction_id')
      .eq('household_id', household.id);
    sharedTransactionIds = Array.from(new Set((sharedRecs || []).map((r: any) => r.transaction_id)));
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Hogar</h1>
      <HouseholdManager
        initialHousehold={household}
        initialMembers={members}
        myRole={myRole}
        userId={user.id}
        userEmail={user.email || ''}
        initialTransactions={transactions}
        initialSettlements={settlements}
        profileMap={profileMap}
        initialHouseholdGoals={householdGoals}
        sharedTransactionIds={sharedTransactionIds}
        initialMonthlyReport={monthlyReport}
      />
    </div>
  );
}
