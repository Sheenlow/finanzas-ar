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
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'El nombre del hogar es obligatorio' }, { status: 400 });
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

    const { data: household, error: householdError } = await adminClient
      .from('households')
      .insert([{ name: name.trim() }])
      .select()
      .single();

    if (householdError) throw householdError;

    const { error: memberError } = await adminClient
      .from('household_members')
      .insert([{
        household_id: household.id,
        user_id: user.id,
        role: 'admin',
        split_percentage: 100,
      }]);

    if (memberError) throw memberError;

    return NextResponse.json({ household });
  } catch (error: any) {
    console.error('Error creating household:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
