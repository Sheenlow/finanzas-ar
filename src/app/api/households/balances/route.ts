import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { householdSplitService } from '@/services/householdSplitService';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: membership } = await adminClient
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'No perteneces a ningún hogar' }, { status: 404 });
    }

    const balances = await householdSplitService.getBalances(
      adminClient,
      membership.household_id,
      user.id
    );

    return NextResponse.json({ balances });
  } catch (error: any) {
    console.error('Error fetching balances:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
