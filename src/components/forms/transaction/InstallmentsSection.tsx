'use client'

import { CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

const INSTALLMENT_OPTIONS = [3, 6, 9, 12, 18, 24]

interface InstallmentsSectionProps {
  isInstallment: boolean
  installmentsTotal: string
  customInstallments: string
  onToggle: (value: boolean) => void
  onInstallmentsTotalChange: (value: string) => void
  onCustomInstallmentsChange: (value: string) => void
}

export function InstallmentsSection({
  isInstallment,
  installmentsTotal,
  customInstallments,
  onToggle,
  onInstallmentsTotalChange,
  onCustomInstallmentsChange,
}: InstallmentsSectionProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onToggle(!isInstallment)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
          isInstallment
            ? "bg-amber-500/10 border-amber-500/30 text-amber-700"
            : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
        )}
      >
        <span className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          En cuotas
        </span>
        <div className={cn(
          "w-10 h-5 rounded-full transition-colors relative",
          isInstallment ? "bg-amber-500" : "bg-muted-foreground/30"
        )}>
          <div className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
            isInstallment ? "left-5" : "left-0.5"
          )} />
        </div>
      </button>

      {isInstallment && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {INSTALLMENT_OPTIONS.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => { onInstallmentsTotalChange(n.toString()); onCustomInstallmentsChange('') }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  installmentsTotal === n.toString()
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              placeholder="Otra"
              value={customInstallments}
              onChange={e => { onCustomInstallmentsChange(e.target.value); onInstallmentsTotalChange('') }}
              className={cn(
                "w-14 px-2 py-1.5 rounded-lg text-xs font-medium border text-center",
                customInstallments ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/50 border-border"
              )}
              min="1"
              max="99"
            />
          </div>
        </div>
      )}
    </div>
  )
}
