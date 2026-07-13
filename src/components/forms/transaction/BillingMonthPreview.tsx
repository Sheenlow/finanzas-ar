'use client'

import { Calendar } from 'lucide-react'

interface BillingMonthPreviewProps {
  label: string | null
}

export function BillingMonthPreview({ label }: BillingMonthPreviewProps) {
  if (!label) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
      <Calendar className="w-4 h-4" />
      <span>Mes de facturación: <strong className="capitalize">{label}</strong></span>
    </div>
  )
}
