import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
      .select('*, households(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'No eres miembro de ningún hogar' }, { status: 404 });
    }

    if (membership.role === 'admin') {
      const { data: members } = await adminClient
        .from('household_members')
        .select('id')
        .eq('household_id', membership.household_id);

      if (members && members.length > 1) {
        return NextResponse.json({ 
          error: 'Primero transferí el admin a otro miembro antes de salir' 
        }, { status: 400 });
      }

      await adminClient
        .from('households')
        .delete()
        .eq('id', membership.household_id);

      return NextResponse.json({ success: true, householdDeleted: true });
    }

    await adminClient
      .from('household_members')
      .delete()
      .eq('id', membership.id);

    return NextResponse.json({ success: true, householdDeleted: false });
  } catch (error: any) {
    console.error('Error leaving household:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
