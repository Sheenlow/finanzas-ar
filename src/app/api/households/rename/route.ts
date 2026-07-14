import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { requireOrigin, getClientIp } from '@/lib/security';
import { generalLimiter } from '@/lib/rateLimit';
import { withValidation } from '@/lib/apiHandler';
import { RenameSchema } from '@/lib/schemas';

export const PATCH = withValidation(RenameSchema, async (body, req) => {
  if (!requireOrigin(req)) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  const ip = getClientIp(req)
  const { success } = await generalLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { data: membership } = await adminClient
    .from('household_members')
    .select('role')
    .eq('household_id', body.householdId)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Solo el admin puede renombrar el hogar' }, { status: 403 });
  }

  const { error } = await adminClient
    .from('households')
    .update({ name: body.name.trim() })
    .eq('id', body.householdId);

  if (error) throw error;

  return NextResponse.json({ success: true });
});
