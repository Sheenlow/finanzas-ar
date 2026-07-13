'use client'

import { Users, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SplitPreviewItem {
  user_id: string
  name: string
  percentage: number
  amount: number
}

interface HouseholdSectionProps {
  householdId: string | null
  isHouseholdVisible: boolean
  isHouseholdExpense: boolean
  splitPreview: SplitPreviewItem[]
  onVisibleToggle: (value: boolean) => void
  onExpenseToggle: (value: boolean) => void
}

export function HouseholdSection({
  householdId,
  isHouseholdVisible,
  isHouseholdExpense,
  splitPreview,
  onVisibleToggle,
  onExpenseToggle,
}: HouseholdSectionProps) {
  if (!householdId) return null

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          const next = !isHouseholdVisible
          onVisibleToggle(next)
          if (!next) onExpenseToggle(false)
        }}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
          isHouseholdVisible
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
            : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
        )}
      >
        <span className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Mostrar en el hogar
        </span>
        <div className={cn(
          "w-10 h-5 rounded-full transition-colors relative",
          isHouseholdVisible ? "bg-emerald-500" : "bg-muted-foreground/30"
        )}>
          <div className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
            isHouseholdVisible ? "left-5" : "left-0.5"
          )} />
        </div>
      </button>

      {isHouseholdVisible && (
        <button
          type="button"
          onClick={() => onExpenseToggle(!isHouseholdExpense)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
            isHouseholdExpense
              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-700"
              : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Compartir con el hogar
          </span>
          <div className={cn(
            "w-10 h-5 rounded-full transition-colors relative",
            isHouseholdExpense ? "bg-indigo-500" : "bg-muted-foreground/30"
          )}>
            <div className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
              isHouseholdExpense ? "left-5" : "left-0.5"
            )} />
          </div>
        </button>
      )}

      {isHouseholdExpense && splitPreview.length > 0 && (
        <div className="p-3 bg-indigo-50/50 border border-indigo-200/50 rounded-xl space-y-1">
          <p className="text-xs text-indigo-700 font-medium mb-1">División del gasto</p>
          {splitPreview.map(p => (
            <div key={p.user_id} className="flex justify-between text-sm">
              <span className="text-indigo-700">{p.name}</span>
              <span className="text-indigo-600">
                {p.percentage}% = ${p.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
