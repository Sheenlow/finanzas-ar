import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTransactionMeta(type: string, is_installment: boolean) {
  if (is_installment) return { label: 'Cuota', color: 'orange' };
  if (type === 'subscription') return { label: 'Suscripción', color: 'rose' };
  if (type === 'service') return { label: 'Servicio', color: 'blue' };
  return { label: 'Pago único', color: 'gray' };
}

export function getBillingMonth(transactionDate: string | Date, closingDay: number): string {
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
