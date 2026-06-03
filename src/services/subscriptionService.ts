import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { accountsService } from './accountsService';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];

export const subscriptionService = {
  async generateMissingSubscriptions(supabase: any, userId: string) {
    const { data: recurringItems, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .in('type', ['subscription', 'service'])
      .eq('is_installment', false)
      .is('parent_transaction_id', null);

    if (error) throw error;

    for (const item of (recurringItems || []) as Transaction[]) {
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);
      const { data: existing, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('parent_transaction_id', item.id)
        .gte('transaction_date', currentMonthPrefix + '-01')
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) continue;

      await supabase
        .from('transactions')
        .insert([{
          user_id: item.user_id,
          account_id: item.account_id,
          amount: item.amount,
          currency: item.currency,
          type: item.type,
          description: item.description,
          transaction_date: new Date().toISOString(),
          payment_method: item.payment_method,
          parent_transaction_id: item.id,
          subscription_frequency: item.subscription_frequency,
        }]);
    }
  },
};
