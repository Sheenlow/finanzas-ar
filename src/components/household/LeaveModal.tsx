'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, X } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'

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
          aria-labelledby="leave-modal-title"
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
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 id="leave-modal-title" className="text-lg font-semibold">Salirse del hogar</h3>
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
              ¿Estás seguro de salir del hogar &ldquo;{householdName}&rdquo;? Perderás acceso a todos los gastos compartidos.
            </p>
            {isAdmin && otherMembersCount > 0 && (
              <Alert variant="warning" className="mb-4">
                Siendo admin, primero transferí el rol a otro miembro.
              </Alert>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
