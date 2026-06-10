import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { requireOrigin } from '@/lib/security';

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
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

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: membership } = await adminClient
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Solo el admin puede expulsar miembros' }, { status: 403 });
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
      return NextResponse.json({ error: 'No puedes expulsar a otro admin' }, { status: 400 });
    }

    await adminClient
      .from('household_members')
      .delete()
      .eq('id', memberId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing member:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
