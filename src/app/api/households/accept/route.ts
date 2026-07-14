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
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión para aceptar la invitación' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: invitation, error: fetchError } = await adminClient
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invitación no válida o expirada' }, { status: 404 });
    }

    if (invitation.invited_email !== user.email) {
      return NextResponse.json({ error: 'Esta invitación fue enviada a otro email' }, { status: 403 });
    }

    const { error: joinError } = await adminClient
      .from('household_members')
      .insert([{
        household_id: invitation.household_id,
        user_id: user.id,
        role: 'member',
        split_percentage: 0,
      }]);

    if (joinError) {
      if (joinError.code === '23505') {
        return NextResponse.json({ error: 'Ya eres miembro de este hogar' }, { status: 409 });
      }
      throw joinError;
    }

    await adminClient
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    return NextResponse.json({ success: true, householdId: invitation.household_id });
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
