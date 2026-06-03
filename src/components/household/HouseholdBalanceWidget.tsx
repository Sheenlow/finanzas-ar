'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

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
  userId: string
  className?: string
}

export function HouseholdBalanceWidget({ userId, className }: Props) {
  const [balances, setBalances] = useState<{ owes: BalancePair | null; owedBy: BalancePair | null; pairs: BalancePair[] }>({
    owes: null,
    owedBy: null,
    pairs: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/households/balances')
        if (res.ok) {
          const data = await res.json()
          setBalances(data.balances)
        }
      } catch (error) {
        console.error('Error loading balances:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return null

  const { owes, owedBy, pairs } = balances

  if (!owes && !owedBy && pairs.length === 0) return null

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

  return (
    <div className={cn('space-y-3', className)}>
      {owedBy && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Te deben</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {owedBy.from_user_name || owedBy.from_user_email?.split('@')[0]}
            </span>
            <span className="text-lg font-bold text-green-600">
              {formatter.format(owedBy.open_amount)}
            </span>
          </div>
        </div>
      )}

      {owes && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Debés</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {owes.to_user_name || owes.to_user_email?.split('@')[0]}
            </span>
            <span className="text-lg font-bold text-red-600">
              {formatter.format(owes.open_amount)}
            </span>
          </div>
        </div>
      )}

      {pairs.length > 1 && (
        <div className="bg-secondary/50 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-2">Todos los balances</p>
          {pairs.map((pair, i) => {
            const isOwing = pair.from_user_id === userId
            return (
              <div key={i} className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground">
                  {isOwing ? `→ ${pair.to_user_name || pair.to_user_email?.split('@')[0]}` : `← ${pair.from_user_name || pair.from_user_email?.split('@')[0]}`}
                </span>
                <span className={isOwing ? 'text-red-600' : 'text-green-600'}>
                  {formatter.format(pair.open_amount)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
