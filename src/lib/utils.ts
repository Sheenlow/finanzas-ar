import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTransactionMeta(type: string, is_installment: boolean) {
  if (is_installment) return { label: 'Cuota', color: 'orange' };
  if (type === 'subscription') return { label: 'Suscripción', color: 'rose' };
  if (type === 'service') return { label: 'Servicio', color: 'blue' };
  return { label: 'Pago único', color: 'gray' };
}

export function calculateClosingDate(year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0)
  let d = new Date(lastDay)
  while (d.getDay() !== 4) {
    d.setDate(d.getDate() - 1)
  }
  const daysAfter = lastDay.getDate() - d.getDate()
  if (daysAfter >= 4) {
    d = new Date(year, month + 1, 1)
    while (d.getDay() !== 4) {
      d.setDate(d.getDate() + 1)
    }
  }
  return d
}

export function getBillingMonth(
  transactionDate: string | Date,
  closingDay: number
): string {
  const d = typeof transactionDate === 'string' ? new Date(transactionDate) : transactionDate
  const day = d.getDate()
  const year = d.getFullYear()
  const month = d.getMonth()

  if (day > closingDay) {
    const next = new Date(year, month + 1, 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function getBillingMonthFromRules(
  transactionDate: string | Date,
  closingRule: 'fixed' | 'last_thursday',
  closingDay: number
): string {
  if (closingRule === 'fixed') {
    return getBillingMonth(transactionDate, closingDay)
  }

  const d = typeof transactionDate === 'string' ? new Date(transactionDate) : transactionDate
  const closing = calculateClosingDate(d.getFullYear(), d.getMonth())

  if (d > closing) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getBillingMonthFromCycle(
  transactionDate: string | Date,
  closeDate: string
): string {
  const d = typeof transactionDate === 'string' ? new Date(transactionDate) : transactionDate
  const close = new Date(closeDate + 'T00:00:00')
  if (d > close) {
    const next = new Date(close.getFullYear(), close.getMonth() + 1, 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  }
  return `${close.getFullYear()}-${String(close.getMonth() + 1).padStart(2, '0')}`
}

export function getEffectiveMonth(t: {
  payment_method?: string | null
  billing_month?: string | null
  transaction_date?: string | null
}): string {
  if (t.payment_method === 'card' && t.billing_month) {
    return t.billing_month
  }
  return (t.transaction_date || '').slice(0, 7)
}

export function isCurrentBillingMonth(t: {
  payment_method?: string | null
  billing_month?: string | null
  transaction_date?: string | null
}, selectedMonth: string): boolean {
  return getEffectiveMonth(t) === selectedMonth
}

export function estimateNextClosing(closingRule: 'fixed' | 'last_thursday', closingDay: number): string {
  const now = new Date()
  if (closingRule === 'last_thursday') {
    const closing = calculateClosingDate(now.getFullYear(), now.getMonth())
    if (now > closing) {
      const next = calculateClosingDate(now.getFullYear(), now.getMonth() + 1)
      return next.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    return closing.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const current = new Date(now.getFullYear(), now.getMonth(), closingDay)
  if (now > current) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, closingDay)
    return next.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return current.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
