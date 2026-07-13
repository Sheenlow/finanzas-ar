import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/security';
import { generalLimiter } from '@/lib/rateLimit';

export async function GET(req: Request) {
  const ip = getClientIp(req)
  const { success } = await generalLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  try {
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

    const { data: transactions } = await adminClient
      .from('transactions')
      .select('*, profiles:user_id(full_name)')
      .eq('household_id', membership.household_id)
      .order('transaction_date', { ascending: false });

    const { data: members } = await adminClient
      .from('household_members')
      .select('user_id')
      .eq('household_id', membership.household_id);

    const memberIds = new Set((members || []).map(m => m.user_id));

    const headers = ['Fecha', 'Descripción', 'Pagó', 'Monto', 'Moneda', 'Tipo']
      .map(h => `"${h}"`).join(',');

    const rows = (transactions || []).filter(t => memberIds.has(t.user_id)).map((t: any) => {
      const payer = t.profiles?.full_name || t.user_id;
      return [
        new Date(t.transaction_date).toLocaleDateString('es-AR'),
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${payer.replace(/"/g, '""')}"`,
        t.amount,
        t.currency,
        t.type,
      ].join(',');
    });

    const csv = [headers, ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=gastos-hogar.csv',
      },
    });
  } catch (error: any) {
    console.error('Error exporting household:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
