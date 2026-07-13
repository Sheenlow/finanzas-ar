'use client'

import { Home, Plus, Loader2 } from 'lucide-react'

interface Props {
  householdName: string
  onNameChange: (name: string) => void
  onCreate: () => void
  loading: boolean
  error: string | null
}

export function CreateHouseholdForm({ householdName, onNameChange, onCreate, loading, error }: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
      <div className="text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Home className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Todavía no tenés un hogar</h2>
        <p className="text-sm text-muted-foreground">
          Creá un hogar para gestionar gastos compartidos con otra persona.
        </p>
        <div className="flex gap-3 max-w-xs mx-auto">
          <input
            type="text"
            placeholder="Nombre del hogar (ej: Casa)"
            value={householdName}
            onChange={e => onNameChange(e.target.value)}
            className="flex-1 px-4 py-2 border border-border rounded-xl text-sm"
          />
          <button
            onClick={onCreate}
            disabled={loading || !householdName.trim()}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  )
}
