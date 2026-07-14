import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { requireOrigin, getClientIp } from '@/lib/security';
import { generalLimiter } from '@/lib/rateLimit';
import { InviteSchema } from '@/lib/schemas';
import crypto from 'crypto';

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
    const { householdId, email } = InviteSchema.parse(await req.json());

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin')}/join?token=${token}`;

    const adminClient = createAdminClient();

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
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.issues }, { status: 400 });
    }
    console.error('Error creating invitation:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
