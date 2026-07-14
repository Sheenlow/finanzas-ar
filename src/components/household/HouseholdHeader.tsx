'use client'

import { Home, Pencil } from 'lucide-react'

interface Props {
  name: string
  memberCount: number
  isAdmin: boolean
  editing: boolean
  editValue: string
  onEditValueChange: (v: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  loading: boolean
}

export function HouseholdHeader({
  name, memberCount, isAdmin,
  editing, editValue, onEditValueChange,
  onStartEdit, onSaveEdit, onCancelEdit, loading,
}: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Home className="w-5 h-5 text-primary" /></div>
        <div className="flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input type="text" value={editValue} onChange={e => onEditValueChange(e.target.value)} className="px-3 py-1 border border-border rounded-lg text-sm font-semibold w-48" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit() }} />
              <button onClick={onSaveEdit} disabled={loading} className="p-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded">OK</button>
              <button onClick={onCancelEdit} className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{name}</h2>
              {isAdmin && <button onClick={onStartEdit} className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded" title="Renombrar" aria-label="Renombrar hogar"><Pencil className="w-3.5 h-3.5" /></button>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{memberCount} miembro{memberCount !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  )
}
