import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { requireOrigin } from '@/lib/security';

export async function DELETE(req: Request) {
  if (!requireOrigin(req)) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
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
      .select('household_id, role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Solo el admin puede eliminar el hogar' }, { status: 403 });
    }

    await adminClient
      .from('households')
      .delete()
      .eq('id', membership.household_id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting household:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
