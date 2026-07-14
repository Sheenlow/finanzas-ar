import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { requireOrigin, getClientIp } from '@/lib/security';
import { generalLimiter } from '@/lib/rateLimit';
import { withValidation } from '@/lib/apiHandler';
import { CreateHouseholdSchema } from '@/lib/schemas';

export const POST = withValidation(CreateHouseholdSchema, async (body, req) => {
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

  const { data: household, error: householdError } = await adminClient
    .from('households')
    .insert([{ name: body.name.trim() }])
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
});
