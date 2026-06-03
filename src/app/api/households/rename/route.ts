import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function PATCH(req: Request) {
  try {
    const { householdId, name } = await req.json();

    if (!householdId || !name?.trim()) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

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
      .select('role')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Solo el admin puede renombrar el hogar' }, { status: 403 });
    }

    const { error } = await adminClient
      .from('households')
      .update({ name: name.trim() })
      .eq('id', householdId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al renombrar' }, { status: 500 });
  }
}
