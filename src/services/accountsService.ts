import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

export const accountsService = {
  async getAll(supabase: any, userId: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data as Account[];
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
};
