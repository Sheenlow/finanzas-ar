'use client'

import { AlertTriangle, Trash2 } from 'lucide-react'

interface Props {
  onDelete: () => void
}

export function DangerZone({ onDelete }: Props) {
  return (
    <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-4">
      <p className="text-sm font-medium text-rose-700 dark:text-rose-400 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />Zona de peligro
      </p>
      <button onClick={onDelete} className="w-full px-4 py-2 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors flex items-center justify-center gap-2">
        <Trash2 className="w-4 h-4" />Eliminar hogar
      </button>
    </div>
  )
}
