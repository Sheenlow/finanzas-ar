import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { resolveBillingMonth } from '@/services/transactionsService';

function shouldGenerateThisMonth(
  frequency: string | null | undefined,
  currentMonth: number,
  parentDateStr: string | null
): boolean {
  if (!frequency || frequency === 'monthly') return true;

  const parentMonth = parentDateStr
    ? new Date(parentDateStr).getMonth() + 1
    : currentMonth;

  if (frequency === 'quarterly') {
    const diff = (currentMonth - parentMonth + 12) % 12;
    return diff % 3 === 0;
  }

  if (frequency === 'biannual') {
    const diff = (currentMonth - parentMonth + 12) % 12;
    return diff % 6 === 0;
  }

  if (frequency === 'annual') {
    return currentMonth === parentMonth;
  }

  return true;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: subscriptions, error } = await supabase
    .from('transactions')
    .select('*')
    .in('type', ['subscription', 'service'])
    .eq('is_installment', false)
    .is('parent_transaction_id', null);

  if (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Error al procesar suscripciones' }, { status: 500 })
  }

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01T00:00:00Z`;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const endOfMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00Z`;

  const generated = [];

  for (const sub of subscriptions) {
    if (!shouldGenerateThisMonth(sub.subscription_frequency, currentMonth, sub.transaction_date)) {
      continue;
    }

    const { data: existing, error: checkError } = await supabase
      .from('transactions')
      .select('id')
      .eq('parent_transaction_id', sub.id)
      .gte('transaction_date', startOfMonth)
      .lt('transaction_date', endOfMonth);

    if (checkError) {
      console.error('Error checking existing:', checkError);
      continue;
    }

    if (existing && existing.length > 0) continue;

    const billingMonth = await resolveBillingMonth(
      supabase,
      sub.payment_method,
      sub.account_id,
      today
    );

    const { error: insertError } = await supabase
      .from('transactions')
      .insert([{
        user_id: sub.user_id,
        account_id: sub.account_id,
        amount: sub.amount,
        currency: sub.currency,
        type: sub.type,
        description: sub.description,
        transaction_date: today.toISOString(),
        payment_method: sub.payment_method,
        parent_transaction_id: sub.id,
        subscription_frequency: sub.subscription_frequency,
        billing_month: billingMonth,
      }]);

    if (!insertError) generated.push(sub.id);
  }

  return NextResponse.json({ message: 'Proceso completado', generatedCount: generated.length });
}
