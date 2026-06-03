import { createClient } from '@/lib/supabase/server';
import { savingsGoalsService } from '@/services/savingsGoalsService';
import { safeRedirect } from '@/lib/redirect';
import { GoalsContainer } from '@/components/GoalsContainer';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return safeRedirect('/login');
  }

  const personalGoals = await savingsGoalsService.getAll(supabase, user.id);

  let householdId: string | null = null;
  let householdName: string | undefined;
  let householdGoals: any[] = [];
  const profileMap = new Map<string, string>();

  const { data: membership } = (await supabase
    .from('household_members')
    .select('households(id, name)')
    .eq('user_id', user.id)
    .maybeSingle()) as { data: { households: { id: string; name: string } | null } | null };

  if (membership?.households) {
    householdId = membership.households.id;
    householdName = membership.households.name;

    householdGoals = await savingsGoalsService.getForHousehold(supabase, householdId);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name');
    (profiles || []).forEach((p: any) => profileMap.set(p.id, p.full_name));
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Mis Metas de Ahorro</h1>
      <GoalsContainer
        userId={user.id}
        initialGoals={personalGoals}
        householdId={householdId}
        householdName={householdName}
        householdGoals={householdGoals}
        profileMap={profileMap}
      />
    </div>
  );
}
