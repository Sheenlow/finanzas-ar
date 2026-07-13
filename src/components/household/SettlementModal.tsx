'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert } from '@/components/ui/Alert'

interface BalancePair {
  from_user_id: string
  to_user_id: string
  open_amount: number
  from_user_email?: string
  from_user_name?: string
  to_user_email?: string
  to_user_name?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  balance: BalancePair | null
  currentUserId: string
}

export function SettlementModal({ isOpen, onClose, balance, currentUserId }: Props) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (balance) {
      setAmount(balance.open_amount.toString())
    }
  }, [balance])

  const handleSettle = async () => {
    if (!balance) return

    const settleAmount = parseFloat(amount)
    if (isNaN(settleAmount) || settleAmount <= 0 || settleAmount > balance.open_amount) {
      setError('Monto inválido')
      return
    }

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const targetUserId = balance.from_user_id === currentUserId ? balance.to_user_id : balance.from_user_id

      const res = await fetch('/api/households/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_user_id: targetUserId,
          amount: settleAmount,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al liquidar')
      }

      onClose()
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!balance) return null

  const otherUserName = balance.from_user_id === currentUserId
    ? balance.to_user_name || balance.to_user_email?.split('@')[0]
    : balance.from_user_name || balance.from_user_email?.split('@')[0]

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !loading && onClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settlement-modal-title"
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
              <h3 id="settlement-modal-title" className="text-lg font-semibold">Liquidar con {otherUserName}</h3>
              <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Deuda pendiente</p>
              <p className="text-2xl font-bold">{formatter.format(balance.open_amount)}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Monto a liquidar</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={balance.open_amount}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground"
                  placeholder="0.00"
                />
              </div>

              {error && <Alert variant="error">{error}</Alert>}

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSettle}
                  disabled={loading}
                  className={cn(
                    "flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl transition-colors",
                    loading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {loading ? 'Liquidando...' : 'Liquidar'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
