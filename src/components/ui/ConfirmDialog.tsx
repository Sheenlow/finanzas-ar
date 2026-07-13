'use client'

import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  variant?: 'danger' | 'warning' | 'default'
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

const variantConfig = {
  danger: {
    icon: Trash2,
    iconClass: 'bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400',
    confirmClass: 'bg-rose-600 text-white hover:bg-rose-700',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
    confirmClass: 'bg-amber-600 text-white hover:bg-amber-700',
  },
  default: {
    icon: AlertTriangle,
    iconClass: 'bg-primary/10 text-primary',
    confirmClass: 'bg-primary text-primary-foreground hover:opacity-90',
  },
}

export function ConfirmDialog({
  open,
  title,
  description,
  variant = 'default',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    },
    [onClose, loading]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open, handleEscape])

  const config = variantConfig[variant]
  const Icon = config.icon

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
          aria-labelledby="confirm-dialog-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', config.iconClass)}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="confirm-dialog-title" className="text-base font-semibold text-foreground">
                  {title}
                </h3>
              </div>
              <button
                onClick={() => !loading && onClose()}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">{description}</p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50',
                  config.confirmClass
                )}
              >
                {loading ? 'Procesando...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
