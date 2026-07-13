import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { requireOrigin, getClientIp } from '@/lib/security';
import { generalLimiter } from '@/lib/rateLimit';

export async function PATCH(req: Request) {
  if (!requireOrigin(req)) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  const ip = getClientIp(req)
  const { success } = await generalLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

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
    console.error('Error renaming household:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
