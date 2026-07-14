import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { householdSplitService } from '@/services/householdSplitService';
import { requireOrigin, getClientIp } from '@/lib/security';
import { generalLimiter } from '@/lib/rateLimit';
import { IncomeSchema } from '@/lib/schemas';
import type { Database } from '@/types/database.types';

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
    const { household_id, monthly_income_ars } = IncomeSchema.parse(await req.json());

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminClient = createAdminClient()

    const income = await householdSplitService.upsertIncome(
      adminClient,
      household_id,
      user.id,
      monthly_income_ars
    );

    return NextResponse.json({ income });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.issues }, { status: 400 });
    }
    console.error('Error updating household income:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminClient = createAdminClient()

    const { data: membership } = await adminClient
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'No perteneces a ningún hogar' }, { status: 404 });
    }

    const { members, autoSplit } = await householdSplitService.getMemberSplits(
      adminClient,
      membership.household_id
    );

    const incomes = await householdSplitService.getIncomes(adminClient, membership.household_id);

    return NextResponse.json({ incomes, members, autoSplit });
  } catch (error: any) {
    console.error('Error fetching household incomes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
