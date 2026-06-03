import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { householdSplitService } from '@/services/householdSplitService';

export async function POST(req: Request) {
  try {
    const { to_user_id, amount } = await req.json();

    if (!to_user_id || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Datos de liquidación inválidos' }, { status: 400 });
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
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'No perteneces a ningún hogar' }, { status: 404 });
    }

    const { data: balance1 } = await adminClient
      .from('household_balances')
      .select('*')
      .eq('household_id', membership.household_id)
      .eq('from_user_id', user.id)
      .eq('to_user_id', to_user_id)
      .maybeSingle();

    const { data: balance2 } = await adminClient
      .from('household_balances')
      .select('*')
      .eq('household_id', membership.household_id)
      .eq('from_user_id', to_user_id)
      .eq('to_user_id', user.id)
      .maybeSingle();

    const balance = balance1 || balance2;

    if (!balance) {
      return NextResponse.json({ error: 'No hay balance pendiente con ese miembro' }, { status: 404 });
    }

    const debtorId = balance.from_user_id;
    const creditorId = balance.to_user_id;

    await householdSplitService.settle(
      adminClient,
      membership.household_id,
      debtorId,
      creditorId,
      amount
    );

    const { data: accounts } = await adminClient
      .from('accounts')
      .select('id')
      .eq('user_id', creditorId)
      .limit(1);

    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, full_name')
      .in('id', [debtorId, creditorId]);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const debtorName = profileMap.get(debtorId)?.full_name || 'Miembro';
    const creditorName = profileMap.get(creditorId)?.full_name || 'Miembro';

    if (accounts && accounts.length > 0) {
      await adminClient
        .from('transactions')
        .insert([{
          user_id: creditorId,
          account_id: accounts[0].id,
          amount,
          currency: 'ARS',
          type: 'income',
          description: `Liquidación: ${debtorName} → ${creditorName}`,
          transaction_date: new Date().toISOString(),
          payment_method: 'transfer',
        }]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error settling balance:', error);
    return NextResponse.json({ error: error.message || 'Error al liquidar' }, { status: 500 });
  }
}
