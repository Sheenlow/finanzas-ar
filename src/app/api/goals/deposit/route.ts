import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { goalId, amount } = body

    if (!goalId || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const depositAmount = parseFloat(amount)

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: goal } = await adminClient
      .from('savings_goals')
      .select('id, user_id, household_id, current_amount, target_amount')
      .eq('id', goalId)
      .single()

    if (!goal) {
      return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 })
    }

    const isOwner = goal.user_id === user.id
    let canDeposit = isOwner

    if (goal.household_id && !canDeposit) {
      const { data: membership } = await adminClient
        .from('household_members')
        .select('id')
        .eq('household_id', goal.household_id)
        .eq('user_id', user.id)
        .maybeSingle()
      canDeposit = !!membership
    }

    if (!canDeposit) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const newAmount = Math.min(goal.current_amount + depositAmount, goal.target_amount)

    const { error: depositError } = await adminClient
      .from('goal_deposits')
      .insert([{ goal_id: goalId, user_id: user.id, amount: depositAmount }])

    if (depositError) throw depositError

    const { error: updateError } = await adminClient
      .from('savings_goals')
      .update({ current_amount: newAmount })
      .eq('id', goalId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, newAmount })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error inesperado' }, { status: 500 })
  }
}
