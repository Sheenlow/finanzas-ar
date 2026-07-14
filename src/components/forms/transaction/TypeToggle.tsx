'use client'

import { cn } from '@/lib/utils'

interface TypeToggleProps {
  value: 'expense' | 'income'
  onChange: (value: 'expense' | 'income') => void
}

export function TypeToggle({ value, onChange }: TypeToggleProps) {
  const id = 'transaction-type'
  return (
    <div role="radiogroup" aria-label="Tipo de transacción">
      <label id={`${id}-label`} className="text-xs text-muted-foreground mb-2 block">Tipo</label>
      <div className="flex gap-2">
        {[
          { value: 'expense' as const, label: 'Gasto' },
          { value: 'income' as const, label: 'Ingreso' },
        ].map(opt => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
              value === opt.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
