import { SupabaseClient } from '@supabase/supabase-js'
import { formatAmount } from './parser'
import { getCustomPrompt } from './keywords'
import { escapeHtml } from '@/lib/utils'
import { HELP_MESSAGE, MSG_NO_TRANSACTIONS, MSG_NO_BALANCES } from './messages'

export function isCommand(text: string): boolean {
  return /^\/(start|help|ayuda|stats|list|balance|config|vincular|desvincular)\b/.test(text.trim())
}

export async function handleCommand(
  text: string,
  supabase: SupabaseClient,
  userId: string,
  telegramUserId?: number
): Promise<string> {
  const cmd = text.trim().split(/\s+/)[0].toLowerCase()
  switch (cmd) {
    case '/start': case '/help': case '/ayuda':
      return HELP_MESSAGE

    case '/stats':
      return await getStatsMessage(supabase, userId)

    case '/list':
      return await getListMessage(supabase, userId)

    case '/balance':
      return await getBalancesMessage(supabase, userId)

    case '/vincular': {
      if (!telegramUserId) return '❌ Error: no se pudo identificar tu usuario de Telegram.'
      const token = text.slice('/vincular'.length).trim()
      if (!token || token.length < 30) return '❌ Código inválido. Copialo desde la app (Dashboard → Vinculá tu bot).'

      const { data: cfg } = await supabase.from('bot_config').select('user_id, link_token').eq('link_token', token).maybeSingle()
      if (!cfg) return '❌ Código inválido o ya fue usado. Andá al Dashboard para generar uno nuevo.'

      const { data: existingLink } = await supabase.from('bot_users')
        .select('telegram_user_id')
        .eq('supabase_user_id', cfg.user_id)
        .maybeSingle()

      if (existingLink && existingLink.telegram_user_id !== telegramUserId) {
        return '❌ Esta cuenta de FinanzasAR ya está vinculada a otro Telegram.'
      }

      await supabase.from('bot_users').upsert(
        { telegram_user_id: telegramUserId, supabase_user_id: cfg.user_id },
        { onConflict: 'telegram_user_id' }
      )

      await supabase.from('bot_config')
        .update({ link_token: null, updated_at: new Date().toISOString() })
        .eq('user_id', cfg.user_id)

      const { data: profile } = await supabase.from('profiles')
        .select('full_name')
        .eq('id', cfg.user_id)
        .maybeSingle()

      const name = escapeHtml(profile?.full_name?.split(' ')[0] || '')
      const greeting = name ? `¡Vinculado correctamente, ${name}!` : '¡Cuenta vinculada correctamente!'

      return `✅ ${greeting}\n\nYa podés registrar gastos en tu cuenta de FinanzasAR.\nProbá: /help para ver cómo usarme.`
    }

    case '/desvincular': {
      if (!telegramUserId) return '❌ Error: no se pudo identificar tu usuario de Telegram.'

      const { data: link } = await supabase.from('bot_users')
        .select('supabase_user_id')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle()

      if (!link) return '❌ No tenés ninguna cuenta vinculada.'

      await supabase.from('bot_users').delete().eq('telegram_user_id', telegramUserId)

      const newToken = crypto.randomUUID()
      await supabase.from('bot_config')
        .update({ link_token: newToken, updated_at: new Date().toISOString() })
        .eq('user_id', link.supabase_user_id)

      return '🔓 Cuenta desvinculada. Ya no recibiré gastos de este Telegram.\n\nPara volver a vincular, usá el código del Dashboard con /vincular.'
    }

    case '/config': {
      const rest = text.slice('/config'.length).trim()
      if (rest) {
        await supabase.from('bot_config').upsert(
          { user_id: userId, custom_prompt: rest, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        return '✅ Prompt personalizado actualizado:\n\n<i>' + escapeHtml(rest) + '</i>'
      }
      const prompt = await getCustomPrompt(supabase, userId)
      return prompt
        ? '📝 <b>Prompt personalizado actual:</b>\n\n' + escapeHtml(prompt) + '\n\nPara cambiarlo, mandá /config seguido del nuevo texto.'
        : '📝 No tenés un prompt personalizado.\n\nMandá /config seguido de tus instrucciones. Ejemplo:\n/config Mis cuentas son Galicia, MP y Efectivo.'
    }

    default: return ''
  }
}

async function getStatsMessage(supabase: SupabaseClient, userId: string): Promise<string> {
  const argStr = new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  const now = new Date(argStr)
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { data } = await supabase.from('transactions').select('amount, currency, type').eq('user_id', userId).like('transaction_date', `${monthPrefix}%`)
  let totalArs = 0, totalUsd = 0
  const expenses = (data || []).filter((t: any) => t.type !== 'income')
  expenses.forEach((t: any) => { if (t.currency === 'ARS') totalArs += t.amount; else totalUsd += t.amount })
  const monthName = now.toLocaleString('es-AR', { month: 'long' })
  return `<b>📊 Gastos de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${now.getFullYear()}</b>\n\n• Total ARS: ${formatAmount(totalArs, 'ARS')}\n• Total USD: ${formatAmount(totalUsd, 'USD')}\n• Transacciones: ${expenses.length}`
}

async function getListMessage(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from('transactions').select('id, description, amount, currency, type, is_installment, installments_total, installment_number').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
  if (!data || data.length === 0) return MSG_NO_TRANSACTIONS
  const lines = data.map((t: any, i: number) => {
    const inst = t.is_installment ? ` (${t.installment_number}/${t.installments_total})` : ''
    const icon = t.type === 'income' ? '💰' : t.type === 'subscription' ? '🔁' : t.type === 'service' ? '⚡' : '💸'
    return `${i + 1}. ${icon} ${escapeHtml(t.description)}: ${formatAmount(t.amount, t.currency)}${inst}`
  })
  return `<b>📋 Últimos movimientos</b>\n\n${lines.join('\n')}`
}

async function getBalancesMessage(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from('accounts').select('name, balance, currency').eq('user_id', userId).order('name')
  if (!data || data.length === 0) return MSG_NO_BALANCES
  return `<b>💰 Saldos</b>\n\n${data.map((a: any) => `• ${escapeHtml(a.name)}: ${formatAmount(a.balance, a.currency)}`).join('\n')}`
}
