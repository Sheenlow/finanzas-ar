import type { Account, ParsedTransaction } from './types'
import { formatAmount } from './parser'
import { escapeHtml } from '@/lib/utils'

export const HELP_MESSAGE = `<b>🤖 ¿Cómo usar el bot de Finanzas AR?</b>

<b>Registrar un gasto por texto:</b>
Escribí: [descripción] [monto] [medio de pago]

<b>Medios de pago:</b>
• efectivo
• débito
• crédito
• transferencia

<b>Ejemplos:</b>
• Supermercado 8000 efectivo
• Netflix 12 USD débito suscripción
• Nafta 5000 crédito 3 cuotas
• Zapatillas 25000 crédito

<b>¿Cómo funcionan las tarjetas de crédito?</b>
Cuando pagás con crédito, el bot asigna automáticamente el gasto al mes de facturación correcto usando la regla de cierre de tu tarjeta. Si tu tarjeta cierra el 18 y comprás el 20, el gasto va al mes siguiente (cuando llega el resumen). Podés configurar la regla de cierre (último jueves o día fijo) y cargar ciclos reales desde la app web en la sección Cuentas.

<b>Comandos:</b>
/stats — resumen de gastos del mes
/list — últimos 10 gastos
/balance — saldo de todas tus cuentas
/config — personalizar cómo la IA interpreta tus gastos
/ayuda — esta guía
/desvincular — desvincular tu cuenta

<b>¿Cómo aprende el bot?</b>
Cuando corregís una categoría o cuenta después de confirmar un gasto, el bot aprende de esa corrección. La próxima vez que uses palabras similares, las va a asignar automáticamente.

<b>¿Cómo vinculo mi cuenta?</b>
Andá al Dashboard de la app web, copiá el código de vinculación, y mandalo acá: /vincular TU-CODIGO

<b>Consejos:</b>
• Mencioná el medio de pago para agilizar (efectivo, débito, crédito).
• Si pagás con tarjeta de crédito, el bot calcula automáticamente el mes de facturación correcto.
• Usá /config para enseñarle tus cuentas y preferencias.

<b>Compartí el bot:</b>
Link: https://t.me/FinanzasArBot
Usuario: @FinanzasArBot`

export function formatTransactionSummary(txn: ParsedTransaction, amount?: number, currency?: string): string {
  const amt = amount ?? txn.amount
  const curr = currency ?? txn.currency
  const parts: string[] = []

  if (txn.installments > 0) {
    const perCuota = Math.round((amt / txn.installments) * 100) / 100
    parts.push(`${formatAmount(perCuota, curr)} c/u × ${txn.installments} cuotas (${formatAmount(amt, curr)} total)`)
  } else {
    parts.push(`${formatAmount(amt, curr)} ${curr}`)
  }

  if (txn.accountName) parts.push(`Cuenta: ${escapeHtml(txn.accountName)}`)
  if (txn.categoryName) parts.push(`Categoría: ${escapeHtml(txn.categoryName)}`)
  if (txn.paymentMethod === 'card') parts.push('Pago: Tarjeta')
  else if (txn.paymentMethod === 'transfer') parts.push('Pago: Transferencia')
  else parts.push('Pago: Efectivo')
  if (txn.subscriptionFrequency) {
    const freqLabel: Record<string, string> = { monthly: 'Mensual', quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual' }
    parts.push(`🔁 ${freqLabel[txn.subscriptionFrequency]}`)
  }
  if (txn.householdId && txn.isSharing) parts.push('🏠 Compartido con el hogar')
  else if (txn.householdId) parts.push('🏠 Visible en el hogar')

  return parts.join('\n')
}

export function formatAccountList(accounts: Account[]): string {
  return accounts.map(a => `• ${escapeHtml(a.name)} (${a.currency})`).join('\n')
}

export const MSG_NO_ACCOUNTS = 'No tenés cuentas registradas. Creá una cuenta primero desde la app.'
export const MSG_CANT_PARSE = 'No pude identificar el monto. Probá: "Supermercado 8000 en Efectivo"'
export const MSG_NO_TRANSACTIONS = '📋 No tenés gastos registrados todavía.'
export const MSG_NO_BALANCES = '💰 No tenés cuentas registradas.'
export const MSG_UNKNOWN_ACTION = '❓ Acción desconocida.'
export const MSG_UNKNOWN_STATE = '❓ Estado desconocido.'
export const MSG_NO_PENDING = '❓ No hay una operación pendiente. Empezá de nuevo con un gasto.'
export const MSG_CANCELED = 'Operación cancelada.'
export const MSG_ERROR = 'Ocurrió un error. Intentá de nuevo.'
export const MSG_TEXT_ONLY = 'Solo acepto mensajes de texto.'
export const MSG_HOUSEHOLD_BALANCE_NO_HOGAR = 'No pertenecés a ningún hogar. Creá o unite a uno desde la app web.'
