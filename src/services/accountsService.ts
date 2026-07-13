import type { TypedSupabaseClient } from '@/types/supabase';
import { Database } from '@/types/database.types';
import { auditService } from './auditService';

type Account = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];
type CreditCard = Database['public']['Tables']['credit_cards']['Row'];
type CreditCardInsert = Database['public']['Tables']['credit_cards']['Insert'];
type BillingCycle = Database['public']['Tables']['billing_cycles']['Row'];
type BillingCycleInsert = Database['public']['Tables']['billing_cycles']['Insert'];

export const accountsService = {
  async getAll(supabase: TypedSupabaseClient, userId: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data as Account[];
  },

  async getById(supabase: TypedSupabaseClient, id: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Account;
  },

  async create(supabase: TypedSupabaseClient, account: AccountInsert) {
    const { data, error } = await supabase
      .from('accounts')
      .insert([account])
      .select()
      .single();
    
    if (error) throw error;

    auditService.log({
      userId: data.user_id,
      action: 'create',
      entityType: 'account',
      entityId: data.id,
    }).catch(() => {});

    return data as Account;
  },

  async update(supabase: TypedSupabaseClient, id: string, updates: AccountUpdate) {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;

    auditService.log({
      userId: data.user_id,
      action: 'update',
      entityType: 'account',
      entityId: id,
    }).catch(() => {});

    return data as Account;
  },

  async delete(supabase: TypedSupabaseClient, id: string) {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async getCreditCard(supabase: TypedSupabaseClient, accountId: string) {
    const { data, error } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();
    
    if (error) throw error;
    return data as CreditCard | null;
  },

  async upsertCreditCard(supabase: TypedSupabaseClient, data: CreditCardInsert) {
    const { data: result, error } = await supabase
      .from('credit_cards')
      .upsert(data, { onConflict: 'account_id' })
      .select()
      .single();
    
    if (error) throw error;
    return result as CreditCard;
  },

  async deleteCreditCard(supabase: TypedSupabaseClient, accountId: string) {
    const { error } = await supabase
      .from('credit_cards')
      .delete()
      .eq('account_id', accountId);
    
    if (error) throw error;
  },

  async getBillingCycles(supabase: TypedSupabaseClient, creditCardId: string) {
    const { data, error } = await supabase
      .from('billing_cycles')
      .select('*')
      .eq('credit_card_id', creditCardId)
      .order('close_date', { ascending: false });
    
    if (error) throw error;
    return data as BillingCycle[];
  },

  async addBillingCycle(supabase: TypedSupabaseClient, cycle: BillingCycleInsert) {
    const { data, error } = await supabase
      .from('billing_cycles')
      .insert([cycle])
      .select()
      .single();
    
    if (error) throw error;
    return data as BillingCycle;
  },

  async deleteBillingCycle(supabase: TypedSupabaseClient, cycleId: string) {
    const { error } = await supabase
      .from('billing_cycles')
      .delete()
      .eq('id', cycleId);
    
    if (error) throw error;
  },

  async findClosestBillingCycle(supabase: TypedSupabaseClient, creditCardId: string, transactionDate: string) {
    const txDate = transactionDate.slice(0, 10);
    const { data, error } = await supabase
      .from('billing_cycles')
      .select('*')
      .eq('credit_card_id', creditCardId)
      .gte('close_date', txDate)
      .order('close_date', { ascending: true })
      .limit(1);
    
    if (error) throw error;
    return (data?.[0] as BillingCycle) || null;
  },
};
