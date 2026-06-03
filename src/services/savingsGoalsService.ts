import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

type SavingsGoal = Database['public']['Tables']['savings_goals']['Row'];
type SavingsGoalInsert = Database['public']['Tables']['savings_goals']['Insert'];
type SavingsGoalUpdate = Database['public']['Tables']['savings_goals']['Update'];
type GoalDeposit = Database['public']['Tables']['goal_deposits']['Row'];

export const savingsGoalsService = {
  async getAll(supabase: any, userId: string) {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', userId)
      .is('household_id', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as SavingsGoal[];
  },

  async getForHousehold(supabase: any, householdId: string) {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as SavingsGoal[];
  },

  async getDeposits(supabase: any, goalId: string) {
    const { data, error } = await supabase
      .from('goal_deposits')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as GoalDeposit[];
  },

  async create(supabase: any, goal: SavingsGoalInsert) {
    const { data, error } = await supabase
      .from('savings_goals')
      .insert([goal])
      .select()
      .single();
    
    if (error) throw error;
    return data as SavingsGoal;
  },

  async update(supabase: any, id: string, updates: SavingsGoalUpdate) {
    const { data, error } = await supabase
      .from('savings_goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as SavingsGoal;
  },

  async delete(supabase: any, id: string) {
    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};
