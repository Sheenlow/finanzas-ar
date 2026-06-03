import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'El nombre del hogar es obligatorio' }, { status: 400 });
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

    const { data: household, error: householdError } = await adminClient
      .from('households')
      .insert([{ name: name.trim() }])
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
  } catch (error: any) {
    console.error('Error creating household:', error);
    return NextResponse.json({ error: error.message || 'Error al crear el hogar' }, { status: 500 });
  }
}
