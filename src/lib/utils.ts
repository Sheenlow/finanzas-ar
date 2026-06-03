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
