import type { TypedSupabaseClient } from '@/types/supabase';
import { Database } from '@/types/database.types';
import { resolveBillingMonth } from './transactionsService';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];

function shouldGenerateThisMonth(
  frequency: string | null | undefined,
  currentMonth: number,
  parentDateStr: string | null
): boolean {
  if (!frequency || frequency === 'monthly') return true;

  const parentMonth = parentDateStr
    ? new Date(parentDateStr).getMonth() + 1
    : currentMonth;

  if (frequency === 'quarterly') {
    const diff = (currentMonth - parentMonth + 12) % 12;
    return diff % 3 === 0;
  }

  if (frequency === 'biannual') {
    const diff = (currentMonth - parentMonth + 12) % 12;
    return diff % 6 === 0;
  }

  if (frequency === 'annual') {
    return currentMonth === parentMonth;
  }

  return true;
}

export const subscriptionService = {
  async generateMissingSubscriptions(supabase: TypedSupabaseClient, userId: string) {
    const { data: recurringItems, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .in('type', ['subscription', 'service'])
      .eq('is_installment', false)
      .is('parent_transaction_id', null);

    if (error) throw error;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01T00:00:00Z`;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const endOfMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00Z`;

    for (const item of (recurringItems || []) as Transaction[]) {
      if (!shouldGenerateThisMonth(item.subscription_frequency, currentMonth, item.transaction_date)) {
        continue;
      }

      const { data: existing, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('parent_transaction_id', item.id)
        .gte('transaction_date', startOfMonth)
        .lt('transaction_date', endOfMonth);

      if (checkError) throw checkError;
      if (existing && existing.length > 0) continue;

      const billingMonth = await resolveBillingMonth(
        supabase,
        item.payment_method,
        item.account_id,
        now
      );

      await supabase
        .from('transactions')
        .insert([{
          user_id: item.user_id,
          account_id: item.account_id,
          amount: item.amount,
          currency: item.currency,
          type: item.type,
          description: item.description,
          transaction_date: now.toISOString(),
          payment_method: item.payment_method,
          parent_transaction_id: item.id,
          subscription_frequency: item.subscription_frequency,
          billing_month: billingMonth,
        }]);
    }
  },
};
