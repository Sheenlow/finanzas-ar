import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

type Household = Database['public']['Tables']['households']['Row'];
type HouseholdMember = Database['public']['Tables']['household_members']['Row'];

export const householdService = {
  async getByUserId(supabase: any, userId: string) {
    const { data, error } = await supabase
      .from('household_members')
      .select('households(*)')
      .eq('user_id', userId);

    if (error) throw error;
    const households = data?.map((m: any) => m.households).filter(Boolean) || [];
    return households as Household[];
  },

  async getMembers(supabase: any, householdId: string) {
    const { data, error } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId);

    if (error) throw error;
    return (data || []) as (HouseholdMember & { users?: { email?: string; user_metadata?: { full_name?: string } } })[];
  },

  async create(supabase: any, name: string, userId: string) {
    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert([{ name }])
      .select()
      .single();

    if (householdError) throw householdError;

    const { error: memberError } = await supabase
      .from('household_members')
      .insert([{
        household_id: household.id,
        user_id: userId,
        role: 'admin',
        split_percentage: 100,
      }]);

    if (memberError) throw memberError;

    return household as Household;
  },

  async createAsAdmin(name: string, userId: string) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert([{ name }])
      .select()
      .single();

    if (householdError) throw householdError;

    const { error: memberError } = await supabase
      .from('household_members')
      .insert([{
        household_id: household.id,
        user_id: userId,
        role: 'admin',
        split_percentage: 100,
      }]);

    if (memberError) throw memberError;

    return household as Household;
  },

  async updateSplit(supabase: any, memberId: string, splitPercentage: number) {
    const { data, error } = await supabase
      .from('household_members')
      .update({ split_percentage: splitPercentage })
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;
    return data as HouseholdMember;
  },

  async getMyMembership(supabase: any, userId: string) {
    const { data, error } = await supabase
      .from('household_members')
      .select('*, households(*)')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data as (HouseholdMember & { households: Household }) | null;
  },

  async removeMember(supabase: any, memberId: string) {
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
  },

  async transferAdmin(supabase: any, currentAdminMemberId: string, newAdminMemberId: string) {
    await supabase
      .from('household_members')
      .update({ role: 'member' })
      .eq('id', currentAdminMemberId);

    await supabase
      .from('household_members')
      .update({ role: 'admin' })
      .eq('id', newAdminMemberId);
  },
};
