import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { requireOrigin, getClientIp } from '@/lib/security';
import { generalLimiter } from '@/lib/rateLimit';

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  const ip = getClientIp(req)
  const { success } = await generalLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  try {
    const { memberId } = await req.json();

    if (!memberId) {
      return NextResponse.json({ error: 'memberId es obligatorio' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: membership } = await adminClient
      .from('household_members')
      .select('id, household_id, role, user_id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Solo el admin puede transferir el rol' }, { status: 403 });
    }

    const { data: targetMember } = await adminClient
      .from('household_members')
      .select('*')
      .eq('id', memberId)
      .eq('household_id', membership.household_id)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });
    }

    if (targetMember.role === 'admin') {
      return NextResponse.json({ error: 'Ya es admin' }, { status: 400 });
    }

    await adminClient
      .from('household_members')
      .update({ role: 'admin' })
      .eq('id', memberId);

    await adminClient
      .from('household_members')
      .update({ role: 'member' })
      .eq('id', membership.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error transferring admin:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
