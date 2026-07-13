import type { Account, Category, FlowState, ParsedTransaction } from './types'
import { formatAmount } from './parser'
import { escapeHtml } from '@/lib/utils'

export function computeNext(pending: ParsedTransaction): FlowState {
  if (pending.type === 'subscription' && !pending.subscriptionFrequency) return 'ask_subscription'
  if (!pending.accountId) return 'select_account'
  if (!pending.categoryName) return 'select_category'
  if (pending.householdId && typeof pending.isSharing === 'undefined') return 'ask_household_show'
  return 'confirm'
}

export async function renderState(
  state: FlowState,
  pending: ParsedTransaction,
  deps: { getAccounts: () => Promise<Account[]>; getCategories: () => Promise<Category[]> }
): Promise<{ text: string; keyboard: { text: string; callback_data: string }[][] }> {
  switch (state) {
    case 'ask_cuotas':
      return {
        text: `💳 Detecté pago con tarjeta. ¿Es en cuotas?\n\n<b>${escapeHtml(pending.description)}</b> — ${formatAmount(pending.amount, pending.currency)}`,
        keyboard: [[{ text: 'Sí, en cuotas', callback_data: 'new:cuotas:si' }, { text: 'No, pago único', callback_data: 'new:cuotas:no' }],
        [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
      }

    case 'ask_cuotas_count':
      return {
        text: `¿Cuántas cuotas?\n\n<b>${escapeHtml(pending.description)}</b> — ${formatAmount(pending.amount, pending.currency)}`,
        keyboard: [
          [{ text: '3', callback_data: 'new:cuotas_n:3' }, { text: '6', callback_data: 'new:cuotas_n:6' }],
          [{ text: '9', callback_data: 'new:cuotas_n:9' }, { text: '12', callback_data: 'new:cuotas_n:12' }],
          [{ text: '18', callback_data: 'new:cuotas_n:18' }, { text: '24', callback_data: 'new:cuotas_n:24' }],
          [{ text: 'Cancelar', callback_data: 'new:cancel' }],
        ],
      }

    case 'select_account': {
      const accounts = await deps.getAccounts()
      const buttons = accounts.map(a => ([{ text: `${a.name} (${a.currency})`, callback_data: `new:acct:${a.id}` }]))
      buttons.push([{ text: 'Cancelar', callback_data: 'new:cancel' }])
      return { text: `🏦 ¿En qué cuenta?\n\n<b>${escapeHtml(pending.description)}</b> — ${formatAmount(pending.amount, pending.currency)}`, keyboard: buttons }
    }

    case 'ask_subscription':
      return {
        text: `🔁 ¿Es un gasto recurrente (suscripción)?\n\n<b>${escapeHtml(pending.description)}</b> — ${formatAmount(pending.amount, pending.currency)}`,
        keyboard: [[{ text: 'Sí, recurrente', callback_data: 'new:subscription:si' }, { text: 'No, único', callback_data: 'new:subscription:no' }],
        [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
      }

    case 'ask_frequency':
      return {
        text: `¿Cada cuánto se repite?\n\n<b>${escapeHtml(pending.description)}</b> — ${formatAmount(pending.amount, pending.currency)}`,
        keyboard: [
          [{ text: 'Mensual', callback_data: 'new:frequency:monthly' }, { text: 'Trimestral', callback_data: 'new:frequency:quarterly' }],
          [{ text: 'Semestral', callback_data: 'new:frequency:biannual' }, { text: 'Anual', callback_data: 'new:frequency:annual' }],
          [{ text: 'Cancelar', callback_data: 'new:cancel' }],
        ],
      }

    case 'ask_household_show':
      return {
        text: `🏠 ¿Mostrar en el hogar?\n\n<b>${escapeHtml(pending.description)}</b> — ${formatAmount(pending.amount, pending.currency)}`,
        keyboard: [[{ text: 'Sí, mostrar', callback_data: 'new:household_show:si' }, { text: 'No', callback_data: 'new:household_show:no' }],
        [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
      }

    case 'ask_household_share':
      return {
        text: `🤝 ¿Compartir el gasto con el hogar?\n\n<b>${escapeHtml(pending.description)}</b> — ${formatAmount(pending.amount, pending.currency)}`,
        keyboard: [[{ text: 'Sí, compartir', callback_data: 'new:household_share:si' }, { text: 'No, solo mostrar', callback_data: 'new:household_share:no' }],
        [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
      }

    case 'select_category': {
      const categories = await deps.getCategories()
      const buttons: { text: string; callback_data: string }[][] = []
      for (let i = 0; i < categories.length; i += 2) {
        buttons.push(categories.slice(i, i + 2).map(c => ({ text: c.name, callback_data: `new:cat:${encodeURIComponent(c.name)}` })))
      }
      buttons.push([{ text: 'Cancelar', callback_data: 'new:cancel' }])
      return { text: `🏷️ ¿Categoría?\n\n<b>${escapeHtml(pending.description)}</b> — ${formatAmount(pending.amount, pending.currency)}`, keyboard: buttons }
    }

    case 'confirm': {
      const perCuota = pending.installments > 0 ? Math.round((pending.amount / pending.installments) * 100) / 100 : pending.amount
      const lines: string[] = [`<b>${escapeHtml(pending.description)}</b>`]
      if (pending.installments > 0) {
        lines.push(`${formatAmount(perCuota, pending.currency)} c/u × ${pending.installments} cuotas (${formatAmount(pending.amount, pending.currency)} total)`)
      } else {
        lines.push(`${formatAmount(pending.amount, pending.currency)} ${pending.currency}`)
      }
      if (pending.accountName) lines.push(`Cuenta: ${escapeHtml(pending.accountName)}`)
      if (pending.categoryName) lines.push(`Categoría: ${escapeHtml(pending.categoryName)}`)
      if (pending.paymentMethod === 'card') lines.push('Pago: Tarjeta')
      else if (pending.paymentMethod === 'transfer') lines.push('Pago: Transferencia')
      else lines.push('Pago: Efectivo')
      if (pending.subscriptionFrequency) {
        const freqLabel: Record<string, string> = { monthly: 'Mensual', quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual' }
        lines.push(`🔁 ${freqLabel[pending.subscriptionFrequency]}`)
      }
      if (pending.householdId && pending.isSharing) lines.push('🏠 Compartido con el hogar')
      else if (pending.householdId) lines.push('🏠 Visible en el hogar')
      return {
        text: `¿Confirmás el gasto?\n\n${lines.join('\n')}`,
        keyboard: [[{ text: '✅ Confirmar', callback_data: 'new:confirm:yes' }, { text: '✏️ Editar', callback_data: 'new:confirm:edit' }],
        [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
      }
    }

    case 'edit': {
      const lines: string[] = []
      if (pending.categoryName) lines.push(`🏷️ <b>Categoría:</b> ${escapeHtml(pending.categoryName)}`)
      else lines.push(`🏷️ <b>Categoría:</b> sin asignar`)
      if (pending.accountName) lines.push(`🏦 <b>Cuenta:</b> ${escapeHtml(pending.accountName)}`)
      else lines.push(`🏦 <b>Cuenta:</b> sin asignar`)
      if (pending.installments > 0) lines.push(`💳 <b>Cuotas:</b> ${pending.installments}`)
      else lines.push(`💳 <b>Cuotas:</b> pago único`)
      if (pending.subscriptionFrequency) {
        const freqLabel: Record<string, string> = { monthly: 'Mensual', quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual' }
        lines.push(`🔁 <b>Recurrencia:</b> ${freqLabel[pending.subscriptionFrequency]}`)
      } else if (pending.type === 'subscription') {
        lines.push(`🔁 <b>Recurrencia:</b> sin definir`)
      }
      if (pending.householdId) {
        lines.push(pending.isSharing ? '🏠 <b>Hogar:</b> Compartido' : '🏠 <b>Hogar:</b> Visible')
      }
      return {
        text: `¿Qué querés editar?\n\n<b>${escapeHtml(pending.description)}</b> — ${formatAmount(pending.amount, pending.currency)}\n\n${lines.join('\n')}`,
        keyboard: [
          [{ text: '🏷️ Categoría', callback_data: 'new:edit:cat' }, { text: '🏦 Cuenta', callback_data: 'new:edit:acct' }],
          [{ text: '💳 Cuotas', callback_data: 'new:edit:cuotas' }],
          pending.householdId
            ? [{ text: '🏠 Hogar visible', callback_data: 'new:edit:household_show' }, { text: '🤝 Compartir', callback_data: 'new:edit:household_share' }]
            : [],
          [{ text: '🔙 Volver', callback_data: 'new:edit:back' }],
        ].filter(r => r.length > 0),
      }
    }

    default: return { text: '❓ Estado desconocido.', keyboard: [] }
  }
}
