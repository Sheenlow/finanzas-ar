import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

  if (error) return NextResponse.json({ error }, { status: 500 });

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const generated = [];

  for (const sub of subscriptions) {
    // Verificar si ya existe una transacción para este mes/año hija de esta suscripción
    const { data: existing, error: checkError } = await supabase
      .from('transactions')
      .select('id')
      .eq('parent_transaction_id', sub.id)
      .eq('transaction_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`); // Ajustar lógica de fecha si es necesario

    if (!existing || existing.length === 0) {
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
          transaction_date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01T00:00:00Z`,
          payment_method: sub.payment_method,
          parent_transaction_id: sub.id,
          subscription_frequency: sub.subscription_frequency
        }]);
      
      if (!insertError) generated.push(sub.id);
    }
  }

  return NextResponse.json({ message: 'Proceso completado', generatedCount: generated.length });
}
