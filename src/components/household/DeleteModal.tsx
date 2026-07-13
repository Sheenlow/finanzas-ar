'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'

interface DeleteModalProps {
  open: boolean
  householdName: string | undefined
  error: string | null
  loading: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}

export function DeleteModal({ open, householdName, error, loading, onConfirm, onClose }: DeleteModalProps) {
  const [confirmDeleteText, setConfirmDeleteText] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-semibold">Eliminar hogar</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          ¿Estás seguro de eliminar "{householdName}"? Se perderán TODOS los datos de gastos compartidos.
        </p>
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">Escribí "ELIMINAR" para confirmar</label>
          <input
            type="text"
            value={confirmDeleteText}
            onChange={(e) => setConfirmDeleteText(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-xl"
            placeholder="ELIMINAR"
          />
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => { setConfirmDeleteText(''); onClose() }}
            className="flex-1 px-4 py-2 border border-border rounded-xl hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || confirmDeleteText !== 'ELIMINAR'}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
