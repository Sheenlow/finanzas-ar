'use client'

import { LogOut } from 'lucide-react'

interface LeaveModalProps {
  open: boolean
  householdName: string | undefined
  isAdmin: boolean
  otherMembersCount: number
  loading: boolean
  onConfirm: () => void
  onClose: () => void
}

export function LeaveModal({ open, householdName, isAdmin, otherMembersCount, loading, onConfirm, onClose }: LeaveModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="leave-modal-title">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <LogOut className="w-5 h-5 text-amber-500" />
          <h3 id="leave-modal-title" className="text-lg font-semibold">Salirse del hogar</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          ¿Estás seguro de salir del hogar "{householdName}"? Perderás acceso a todos los gastos compartidos.
        </p>
        {isAdmin && otherMembersCount > 0 && (
          <p className="text-xs text-amber-600 mb-4 bg-amber-50 p-2 rounded-lg">
            Siendo admin, primero transferí el rol a otro miembro.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border rounded-xl hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || (isAdmin && otherMembersCount > 0)}
            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saliendo...' : 'Salirse'}
          </button>
        </div>
      </div>
    </div>
  )
}
