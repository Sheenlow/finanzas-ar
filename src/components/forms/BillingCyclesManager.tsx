'use client'

import { Plus, X } from 'lucide-react'
import type { Database } from '@/types/database.types'

type BillingCycle = Database['public']['Tables']['billing_cycles']['Row']

interface Props {
  creditCardId: string
  billingCycles: BillingCycle[]
  newCloseDate: string
  setNewCloseDate: (v: string) => void
  newDueDate: string
  setNewDueDate: (v: string) => void
  addingCycle: boolean
  setAddingCycle: (v: boolean) => void
  onAddCycle: () => void
  onRemoveCycle: (cycleId: string) => void
}

export function BillingCyclesManager({
  creditCardId, billingCycles,
  newCloseDate, setNewCloseDate, newDueDate, setNewDueDate,
  addingCycle, setAddingCycle, onAddCycle, onRemoveCycle,
}: Props) {
  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ciclos de facturación</p>
        <button
          type="button"
          onClick={() => setAddingCycle(!addingCycle)}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Agregar
        </button>
      </div>

      {addingCycle && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-0.5">Cierre</label>
            <input
              type="date"
              value={newCloseDate}
              onChange={(e) => setNewCloseDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg text-xs"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-0.5">Vence</label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg text-xs"
            />
          </div>
          <button
            type="button"
            onClick={onAddCycle}
            disabled={!newCloseDate}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50"
          >
            OK
          </button>
        </div>
      )}

      {billingCycles.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {billingCycles.map(cycle => (
            <div key={cycle.id} className="flex items-center justify-between text-xs bg-background px-3 py-1.5 rounded-lg">
              <span>
                Cierre: <strong>{new Date(cycle.close_date + 'T00:00:00').toLocaleDateString('es-AR')}</strong>
                {cycle.due_date && <> · Vence: {new Date(cycle.due_date + 'T00:00:00').toLocaleDateString('es-AR')}</>}
              </span>
              <button
                type="button"
                onClick={() => onRemoveCycle(cycle.id)}
                className="text-muted-foreground hover:text-rose-500 transition-colors"
                aria-label="Eliminar ciclo de facturación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
