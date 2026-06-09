import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];
type CreditCard = Database['public']['Tables']['credit_cards']['Row'];
type CreditCardInsert = Database['public']['Tables']['credit_cards']['Insert'];

export const accountsService = {
  async getAll(supabase: any, userId: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data as Account[];
  },

  async getById(supabase: any, id: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Account;
  },

  async create(supabase: any, account: AccountInsert) {
    const { data, error } = await supabase
      .from('accounts')
      .insert([account])
      .select()
      .single();
    
    if (error) throw error;
    return data as Account;
  },

  async update(supabase: any, id: string, updates: AccountUpdate) {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Account;
  },

  async delete(supabase: any, id: string) {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async getCreditCard(supabase: any, accountId: string) {
    const { data, error } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();
    
    if (error) throw error;
    return data as CreditCard | null;
  },

  async upsertCreditCard(supabase: any, data: CreditCardInsert) {
    const { data: result, error } = await supabase
      .from('credit_cards')
      .upsert(data, { onConflict: 'account_id' })
      .select()
      .single();
    
    if (error) throw error;
    return result as CreditCard;
  },

  async deleteCreditCard(supabase: any, accountId: string) {
    const { error } = await supabase
      .from('credit_cards')
      .delete()
      .eq('account_id', accountId);
    
    if (error) throw error;
  },
};
