'use client'

import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecurringSectionProps {
  isRecurring: boolean
  frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual'
  onToggle: (value: boolean) => void
  onFrequencyChange: (value: 'monthly' | 'quarterly' | 'biannual' | 'annual') => void
}

export function RecurringSection({
  isRecurring,
  frequency,
  onToggle,
  onFrequencyChange,
}: RecurringSectionProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onToggle(!isRecurring)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
          isRecurring
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
            : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
        )}
      >
        <span className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Fijar como gasto recurrente
        </span>
        <div className={cn(
          "w-10 h-5 rounded-full transition-colors relative",
          isRecurring ? "bg-emerald-500" : "bg-muted-foreground/30"
        )}>
          <div className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
            isRecurring ? "left-5" : "left-0.5"
          )} />
        </div>
      </button>

      {isRecurring && (
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 'monthly', label: 'Mensual' },
            { value: 'quarterly', label: 'Trimestral' },
            { value: 'biannual', label: 'Semestral' },
            { value: 'annual', label: 'Anual' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFrequencyChange(opt.value as 'monthly' | 'quarterly' | 'biannual' | 'annual')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                frequency === opt.value
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
