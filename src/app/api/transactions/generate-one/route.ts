import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { transactionId } = await request.json()
    if (!transactionId) return NextResponse.json({ error: 'Falta transactionId' }, { status: 400 })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: parent } = await adminClient
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single()

    if (!parent) return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })

    const currentMonthPrefix = new Date().toISOString().slice(0, 7)

    const { data: existing } = await adminClient
      .from('transactions')
      .select('id')
      .eq('parent_transaction_id', transactionId)
      .gte('transaction_date', currentMonthPrefix + '-01')
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'Ya existe una instancia este mes' }, { status: 409 })

    const { error: insertError } = await adminClient
      .from('transactions')
      .insert([{
        user_id: parent.user_id,
        account_id: parent.account_id,
        amount: parent.amount,
        currency: parent.currency,
        type: parent.type,
        category_id: parent.category_id,
        description: parent.description,
        transaction_date: new Date().toISOString(),
        payment_method: parent.payment_method,
        parent_transaction_id: parent.id,
        subscription_frequency: parent.subscription_frequency,
        household_id: parent.household_id,
      }])

    if (insertError) throw insertError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error inesperado' }, { status: 500 })
  }
}
