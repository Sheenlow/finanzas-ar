import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { requireOrigin } from '@/lib/security';
import crypto from 'crypto';

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  try {
    const { householdId, email } = await req.json();
    if (!householdId || !email?.trim()) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin')}/join?token=${token}`;

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminClient
      .from('invitations')
      .insert([{
        household_id: householdId,
        invited_email: email.trim().toLowerCase(),
        token,
      }]);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya hay una invitación pendiente para este email' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ inviteLink, token });
  } catch (error: any) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
