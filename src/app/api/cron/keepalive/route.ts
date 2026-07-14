import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await supabase
    .from('bot_pending')
    .delete()
    .lt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return NextResponse.json({ ok: true });
}
