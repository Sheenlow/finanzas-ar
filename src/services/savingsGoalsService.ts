import type { TypedSupabaseClient } from '@/types/supabase';
import { Database } from '@/types/database.types';
import { auditService } from './auditService';

type SavingsGoal = Database['public']['Tables']['savings_goals']['Row'];
type SavingsGoalInsert = Database['public']['Tables']['savings_goals']['Insert'];
type SavingsGoalUpdate = Database['public']['Tables']['savings_goals']['Update'];
type GoalDeposit = Database['public']['Tables']['goal_deposits']['Row'];

export const savingsGoalsService = {
  async getAll(supabase: TypedSupabaseClient, userId: string) {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', userId)
      .is('household_id', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as SavingsGoal[];
  },

  async getForHousehold(supabase: TypedSupabaseClient, householdId: string) {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as SavingsGoal[];
  },

  async getDeposits(supabase: TypedSupabaseClient, goalId: string) {
    const { data, error } = await supabase
      .from('goal_deposits')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as GoalDeposit[];
  },

  async create(supabase: TypedSupabaseClient, goal: SavingsGoalInsert) {
    const { data, error } = await supabase
      .from('savings_goals')
      .insert([goal])
      .select()
      .single();
    
    if (error) throw error;

    auditService.log({
      userId: data.user_id,
      action: 'create',
      entityType: 'goal',
      entityId: data.id,
    }).catch(() => {});

    return data as SavingsGoal;
  },

  async update(supabase: TypedSupabaseClient, id: string, updates: SavingsGoalUpdate) {
    const { data, error } = await supabase
      .from('savings_goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as SavingsGoal;
  },

  async delete(supabase: TypedSupabaseClient, id: string) {
    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};
