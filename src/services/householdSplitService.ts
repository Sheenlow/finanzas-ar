import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

type HouseholdIncome = Database['public']['Tables']['household_incomes']['Row'];
type HouseholdBalance = Database['public']['Tables']['household_balances']['Row'];
type HouseholdSettlement = Database['public']['Tables']['household_settlements']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type HouseholdShareRecord = Database['public']['Tables']['household_share_records']['Row'];
type HouseholdMember = Database['public']['Tables']['household_members']['Row'];

interface SplitMember {
  user_id: string;
  split_percentage: number;
  monthly_income_ars?: number;
}

interface ShareRecordInput {
  transaction_id: string;
  household_id: string;
  paying_user_id: string;
  owed_user_id: string;
  share_amount: number;
  split_percentage: number;
  is_settled: boolean;
  settled_at: null;
}

interface BalancePair {
  from_user_id: string;
  to_user_id: string;
  open_amount: number;
  from_user_email?: string;
  from_user_name?: string;
  to_user_email?: string;
  to_user_name?: string;
}

export const householdSplitService = {
  async getIncomes(supabase: SupabaseClient, householdId: string) {
    const { data, error } = await supabase
      .from('household_incomes')
      .select('*')
      .eq('household_id', householdId);

    if (error) throw error;
    return (data || []) as HouseholdIncome[];
  },

  async upsertIncome(supabase: SupabaseClient, householdId: string, userId: string, monthlyIncomeArs: number) {
    const { data, error } = await supabase
      .from('household_incomes')
      .upsert({
        household_id: householdId,
        user_id: userId,
        monthly_income_ars: monthlyIncomeArs,
      }, {
        onConflict: 'household_id,user_id',
      })
      .select()
      .single();

    if (error) throw error;
    return data as HouseholdIncome;
  },

  async calculateAutoSplit(_householdId: string, members: SplitMember[], incomeMap: Map<string, number>): Promise<Map<string, number>> {
    const totalIncome = Array.from(incomeMap.values()).reduce((sum, v) => sum + v, 0);

    if (totalIncome <= 0) {
      return new Map(members.map(m => [m.user_id, m.split_percentage]));
    }

    const splitMap = new Map<string, number>();
    for (const member of members) {
      const income = incomeMap.get(member.user_id) || 0;
      const percentage = (income / totalIncome) * 100;
      splitMap.set(member.user_id, Math.round(percentage * 100) / 100);
    }

    return splitMap;
  },

  async splitHouseholdExpense(
    supabase: SupabaseClient,
    transactionId: string,
    householdId: string,
    payingUserId: string,
    totalAmount: number,
    _currency: 'ARS' | 'USD' | 'USDT' | 'USDC' | 'BTC' | 'ETH',
    members: SplitMember[],
    incomeMap: Map<string, number>
  ) {
    const autoSplit = await this.calculateAutoSplit(householdId, members, incomeMap);

    const shareRecords: ShareRecordInput[] = [];

    for (const member of members) {
      if (member.user_id === payingUserId) continue;

      const percentage = autoSplit.get(member.user_id) || member.split_percentage;
      const shareAmount = Math.round((totalAmount * percentage / 100) * 100) / 100;

      if (shareAmount <= 0) continue;

      shareRecords.push({
        transaction_id: transactionId,
        household_id: householdId,
        paying_user_id: payingUserId,
        owed_user_id: member.user_id,
        share_amount: shareAmount,
        split_percentage: percentage,
        is_settled: false,
        settled_at: null,
      });
    }

    if (shareRecords.length > 0) {
      const { error: recordError } = await supabase
        .from('household_share_records')
        .insert(shareRecords);

      if (recordError) throw recordError;
    }

    for (const record of shareRecords) {
      await this.updateBalance(supabase, householdId, record.owed_user_id, record.paying_user_id, record.share_amount);
    }

    return { shareRecords, splitMap: autoSplit };
  },

  async updateBalance(
    supabase: SupabaseClient,
    householdId: string,
    fromUserId: string,
    toUserId: string,
    amount: number
  ) {
    const { error } = await supabase.rpc('atomic_update_balance', {
      p_household_id: householdId,
      p_from: fromUserId,
      p_to: toUserId,
      p_amount: amount,
    })

    if (error) throw error
  },

  async getBalances(supabase: SupabaseClient, householdId: string, currentUserId: string) {
    const { data: balances, error } = await supabase
      .from('household_balances')
      .select('*')
      .eq('household_id', householdId)
      .neq('open_amount', 0);

    if (error) throw error;

    const memberIds = new Set<string>();
    (balances || []).forEach((b: HouseholdBalance) => {
      memberIds.add(b.from_user_id);
      memberIds.add(b.to_user_id);
    });

    if (memberIds.size === 0) {
      return {
        owes: null as BalancePair | null,
        owedBy: null as BalancePair | null,
        pairs: [] as BalancePair[],
      };
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(memberIds));

    const profileMap = new Map((profiles || []).map((p) => [p.id, p] as [string, typeof p]));

    let owes: BalancePair | null = null;
    let owedBy: BalancePair | null = null;
    const pairs: BalancePair[] = [];

    const owesMap = new Map<string, number>();
    const owedByMap = new Map<string, number>();

    for (const balance of (balances || []) as HouseholdBalance[]) {
      const fromProfile = profileMap.get(balance.from_user_id);
      const toProfile = profileMap.get(balance.to_user_id);

      const pair: BalancePair = {
        from_user_id: balance.from_user_id,
        to_user_id: balance.to_user_id,
        open_amount: balance.open_amount,
        from_user_email: fromProfile?.full_name || balance.from_user_id,
        from_user_name: fromProfile?.full_name,
        to_user_email: toProfile?.full_name || balance.to_user_id,
        to_user_name: toProfile?.full_name,
      };

      pairs.push(pair);

      if (balance.from_user_id === currentUserId) {
        const existing = owesMap.get(balance.to_user_id) || 0;
        owesMap.set(balance.to_user_id, existing + balance.open_amount);
      }
      if (balance.to_user_id === currentUserId) {
        const existing = owedByMap.get(balance.from_user_id) || 0;
        owedByMap.set(balance.from_user_id, existing + balance.open_amount);
      }
    }

    if (owesMap.size > 0) {
      const firstOwes = owesMap.entries().next().value;
      if (firstOwes) {
        const [userId, amount] = firstOwes;
        const profile = profileMap.get(userId);
        owes = {
          from_user_id: currentUserId,
          to_user_id: userId,
          open_amount: amount,
          from_user_email: undefined,
          from_user_name: undefined,
          to_user_email: profile?.full_name || userId,
          to_user_name: profile?.full_name,
        };
      }
    }

    if (owedByMap.size > 0) {
      const firstOwedBy = owedByMap.entries().next().value;
      if (firstOwedBy) {
        const [userId, amount] = firstOwedBy;
        const profile = profileMap.get(userId);
        owedBy = {
          from_user_id: userId,
          to_user_id: currentUserId,
          open_amount: amount,
          from_user_email: profile?.full_name || userId,
          from_user_name: profile?.full_name,
          to_user_email: undefined,
          to_user_name: undefined,
        };
      }
    }

    return { owes, owedBy, pairs };
  },

  async getSettlements(supabase: SupabaseClient, householdId: string) {
    const { data, error } = await supabase
      .from('household_settlements')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as HouseholdSettlement[];
  },

  async settle(
    supabase: SupabaseClient,
    householdId: string,
    fromUserId: string,
    toUserId: string,
    amount: number
  ) {
    const { error } = await supabase.rpc('atomic_settle', {
      p_household_id: householdId,
      p_from: fromUserId,
      p_to: toUserId,
      p_amount: amount,
    })

    if (error) throw error
  },

  async getMemberSplits(supabase: SupabaseClient, householdId: string) {
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId);

    if (membersError) throw membersError;

    const { data: incomes } = await supabase
      .from('household_incomes')
      .select('*')
      .eq('household_id', householdId);

    if (incomes) {
      const incomeMap = new Map((incomes as HouseholdIncome[]).map(i => [i.user_id, i.monthly_income_ars]));
      const autoSplit = await this.calculateAutoSplit(
        householdId,
        (members || []) as SplitMember[],
        incomeMap
      );
      return { members, autoSplit: Object.fromEntries(autoSplit) };
    }

    return { members, autoSplit: {} };
  },
};
