import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireOrigin, getClientIp } from '@/lib/security'
import { generalLimiter } from '@/lib/rateLimit'

interface BalanceDiff {
  from_user_id: string
  to_user_id: string
  expected_open_amount: number
  actual_open_amount: number
  difference: number
}

export async function GET(req: Request) {
  if (!requireOrigin(req)) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 })
  }

  const ip = getClientIp(req)
  const { success } = await generalLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: membership } = await adminClient
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No perteneces a ningún hogar' }, { status: 404 })
    }

    const householdId = membership.household_id

    const { data: shareRecords } = await adminClient
      .from('household_share_records')
      .select('paying_user_id, owed_user_id, share_amount')
      .eq('household_id', householdId)
      .eq('is_settled', false)

    const expectedBalances = new Map<string, number>()
    for (const record of (shareRecords || [])) {
      const key = `${record.paying_user_id}:${record.owed_user_id}`
      const current = expectedBalances.get(key) || 0
      expectedBalances.set(key, current + record.share_amount)
    }

    const { data: currentBalances } = await adminClient
      .from('household_balances')
      .select('from_user_id, to_user_id, open_amount')
      .eq('household_id', householdId)
      .neq('open_amount', 0)

    const actualBalances = new Map<string, number>()
    for (const balance of (currentBalances || [])) {
      const key = `${balance.from_user_id}:${balance.to_user_id}`
      actualBalances.set(key, balance.open_amount)
    }

    const diffs: BalanceDiff[] = []
    const allKeys = new Set([...expectedBalances.keys(), ...actualBalances.keys()])

    for (const key of allKeys) {
      const expected = expectedBalances.get(key) || 0
      const actual = actualBalances.get(key) || 0
      if (expected !== actual) {
        const [from, to] = key.split(':')
        diffs.push({
          from_user_id: from,
          to_user_id: to,
          expected_open_amount: expected,
          actual_open_amount: actual,
          difference: expected - actual,
        })
      }
    }

    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(new Set(diffs.flatMap(d => [d.from_user_id, d.to_user_id]))))

    const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name?.split(' ')[0] || p.id.slice(0, 8)]))

    const readableDiffs = diffs.map(d => ({
      from: nameMap.get(d.from_user_id) || d.from_user_id.slice(0, 8),
      to: nameMap.get(d.to_user_id) || d.to_user_id.slice(0, 8),
      expected_open_amount: d.expected_open_amount,
      actual_open_amount: d.actual_open_amount,
      difference: d.difference,
    }))

    return NextResponse.json({
      consistent: diffs.length === 0,
      total_diffs: diffs.length,
      diffs: readableDiffs,
      summary: diffs.length === 0
        ? 'Todos los balances son consistentes con los share_records.'
        : `Se encontraron ${diffs.length} inconsistencia(s).`,
    })
  } catch (error: any) {
    console.error('Error reconciling household balances:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
