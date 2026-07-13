'use client'

import { Calendar } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'

interface BillingMonthPreviewProps {
  label: string | null
}

export function BillingMonthPreview({ label }: BillingMonthPreviewProps) {
  if (!label) return null

  return (
    <Alert variant="info">
      <Calendar className="w-4 h-4 inline mr-1" />
      Mes de facturación: <strong className="capitalize">{label}</strong>
    </Alert>
  )
}
