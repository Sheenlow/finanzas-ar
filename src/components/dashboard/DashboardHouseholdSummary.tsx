'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Home, Users, ArrowRight } from 'lucide-react'
import { HouseholdBalanceWidget } from '@/components/household/HouseholdBalanceWidget'
import { SettlementModal } from '@/components/household/SettlementModal'

interface Transaction {
  id: string
  description: string
  amount: number
  currency: string
  type: string
  household_id: string | null
  user_id: string
  transaction_date: string
}

interface Member {
  id: string
  user_id: string
  split_percentage: number
  role: string
  profiles?: { full_name?: string } | null
}

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
  transactions: Transaction[]
  members: Member[]
  mySplitPercentage: number
  userId: string
  sharedTransactionIds: string[]
}

export function DashboardHouseholdSummary({ transactions, members, mySplitPercentage, userId, sharedTransactionIds }: Props) {
  const [balance, setBalance] = useState<BalancePair | null>(null)
  const [showSettleModal, setShowSettleModal] = useState(false)

  useEffect(() => {
    async function loadBalance() {
      try {
        const res = await fetch('/api/households/balances')
        if (res.ok) {
          const data = await res.json()
          return data.balances
        }
      } catch (error) {
        console.error('Error loading balance:', error)
      }
      return { owes: null, owedBy: null, pairs: [] }
    }

    loadBalance().then(b => {
      if (b.owedBy) {
        setBalance(b.owedBy)
      } else if (b.owes) {
        setBalance(b.owes)
      }
    })
  }, [])

  const householdExpenses = transactions
    .filter(t => t.type === 'expense' || t.type === 'subscription' || t.type === 'service')

  const totalArs = householdExpenses
    .filter(t => t.currency === 'ARS')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalUsd = householdExpenses
    .filter(t => t.currency === 'USD')
    .reduce((sum, t) => sum + t.amount, 0)

  const myShareArs = totalArs * (mySplitPercentage / 100)
  const myShareUsd = totalUsd * (mySplitPercentage / 100)
  const memberCount = members.length

  if (memberCount === 0) return null

  const arsFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
  const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

  const memberMap = new Map(members.map(m => [m.user_id, m.profiles?.full_name || 'Miembro']))

  return (
    <>
      <section className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Home className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Gastos del hogar</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-secondary/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total gastos compartidos</p>
            {totalArs > 0 && (
              <p className="text-xl font-bold">{arsFormatter.format(totalArs)}</p>
            )}
            {totalUsd > 0 && (
              <p className="text-xl font-bold">{usdFormatter.format(totalUsd)}</p>
            )}
            {totalArs === 0 && totalUsd === 0 && (
              <p className="text-sm text-muted-foreground">Sin gastos</p>
            )}
          </div>

          <div className="bg-primary/5 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Tu parte ({mySplitPercentage}%)</p>
            {totalArs > 0 && (
              <p className="text-xl font-bold text-primary">{arsFormatter.format(myShareArs)}</p>
            )}
            {totalUsd > 0 && (
              <p className="text-xl font-bold text-primary">{usdFormatter.format(myShareUsd)}</p>
            )}
          </div>

          <div className="bg-secondary/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="w-3 h-3" />
              Miembros
            </p>
            <p className="text-xl font-bold">{memberCount}</p>
          </div>
        </div>

        {transactions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Últimos gastos del hogar</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left py-2 px-3 font-medium">Descripción</th>
                    <th className="text-left py-2 px-3 font-medium w-28">Fecha</th>
                    <th className="text-right py-2 px-3 font-medium w-28">Monto</th>
                    <th className="text-left py-2 px-3 font-medium w-24">Pagado por</th>
                    <th className="text-center py-2 px-3 font-medium w-20">Compartido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {transactions.map((t: Transaction) => {
                    const isMine = t.user_id === userId
                    const payerName = isMine ? 'Vos' : (memberMap.get(t.user_id) || 'Otro')
                    const isShared = sharedTransactionIds.includes(t.id)
                    return (
                      <tr key={t.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-3 text-foreground truncate max-w-[200px]">{t.description}</td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">
                          {new Date(t.transaction_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: t.currency || 'ARS' }).format(t.amount)}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isMine ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {payerName}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isShared ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                            {isShared ? 'Sí' : 'No'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <HouseholdBalanceWidget userId={userId} className="mt-4" />

        {balance && (
          <button
            onClick={() => setShowSettleModal(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
          >
            <span>Ya me pagó</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </section>

      <SettlementModal
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        balance={balance}
        currentUserId={userId}
      />
    </>
  )
}
