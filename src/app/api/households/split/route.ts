import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { householdSplitService } from '@/services/householdSplitService';
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
    const { household_id, transaction_id, amount, currency } = await req.json();

    if (!household_id || !transaction_id || !amount) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
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

    const { data: members } = await adminClient
      .from('household_members')
      .select('*')
      .eq('household_id', household_id);

    if (!members || members.length < 2) {
      return NextResponse.json({ error: 'Se necesitan al menos 2 miembros' }, { status: 400 });
    }

    const { data: incomes } = await adminClient
      .from('household_incomes')
      .select('*')
      .eq('household_id', household_id);

    const incomeMap = new Map((incomes || []).map((i: any) => [i.user_id, i.monthly_income_ars]));

    const result = await householdSplitService.splitHouseholdExpense(
      adminClient,
      transaction_id,
      household_id,
      user.id,
      amount,
      currency || 'ARS',
      members,
      incomeMap
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error splitting household expense:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
