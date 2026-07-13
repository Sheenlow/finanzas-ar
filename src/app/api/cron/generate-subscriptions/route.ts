import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { resolveBillingMonth } from '@/services/transactionsService';

export async function GET(req: Request) {
  // 1. Verificación de seguridad
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Cliente admin para operaciones de fondo
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 3. Obtener suscripciones base
  const { data: subscriptions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'subscription')
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
    // Verificar si ya existe una transacción para este mes/año hija de esta suscripción
    const { data: existing, error: checkError } = await supabase
      .from('transactions')
      .select('id')
      .eq('parent_transaction_id', sub.id)
      .gte('transaction_date', startOfMonth)
      .lt('transaction_date', endOfMonth);

    if (!existing || existing.length === 0) {
      const billingMonth = await resolveBillingMonth(
        supabase,
        sub.payment_method,
        sub.account_id,
        today
      );

      // Crear nueva transacción
      const { data, error: insertError } = await supabase
        .from('transactions')
        .insert([{
          user_id: sub.user_id,
          account_id: sub.account_id,
          amount: sub.amount,
          currency: sub.currency,
          type: 'subscription',
          description: sub.description,
          transaction_date: today.toISOString(),
          payment_method: sub.payment_method,
          parent_transaction_id: sub.id,
          subscription_frequency: sub.subscription_frequency,
          billing_month: billingMonth,
        }]);
      
      if (!insertError) generated.push(sub.id);
    }
  }

  return NextResponse.json({ message: 'Proceso completado', generatedCount: generated.length });
}
