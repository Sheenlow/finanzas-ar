'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, X } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !loading && onClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <h3 id="delete-modal-title" className="text-lg font-semibold">Eliminar hogar</h3>
              </div>
              <button
                onClick={() => !loading && onClose()}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              ¿Estás seguro de eliminar &ldquo;{householdName}&rdquo;? Se perderán TODOS los datos de gastos compartidos.
            </p>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-1 block">Escribí "ELIMINAR" para confirmar</label>
              <input
                type="text"
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground"
                placeholder="ELIMINAR"
              />
            </div>
            {error && <Alert variant="error" className="mb-2">{error}</Alert>}
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
                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
