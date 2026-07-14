import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireOrigin, getClientIp } from '@/lib/security'
import { generalLimiter } from '@/lib/rateLimit'
import { DepositSchema } from '@/lib/schemas'

export async function POST(request: Request) {
  if (!requireOrigin(request)) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 })
  }

  const ip = getClientIp(request)
  const { success } = await generalLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { goalId, amount: depositAmount } = DepositSchema.parse(await request.json())

    const adminClient = createAdminClient()

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
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('Error depositing to goal:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
