'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Edit3, Plus, Loader2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TransactionForm } from './forms/TransactionForm'

const FREQ_LABEL: Record<string, string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  biannual: 'Semestral',
  annual: 'Anual',
}

function getNextDate(baseDate: string, freq: string): string {
  const d = new Date(baseDate)
  const today = new Date()
  while (d <= today) {
    switch (freq) {
      case 'monthly': d.setMonth(d.getMonth() + 1); break
      case 'quarterly': d.setMonth(d.getMonth() + 3); break
      case 'biannual': d.setMonth(d.getMonth() + 6); break
      case 'annual': d.setFullYear(d.getFullYear() + 1); break
      default: d.setMonth(d.getMonth() + 1)
    }
  }
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

import type { Database } from '@/types/database.types'

type Transaction = Database['public']['Tables']['transactions']['Row'] & {
  categories?: { name: string; color?: string } | null
}

export function RecurringExpenses({ recurring, userId }: { recurring: Transaction[], userId: string }) {
  const [generating, setGenerating] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const router = useRouter()

  const handleGenerate = async (id: string) => {
    setGenerating(prev => new Set(prev).add(id))
    try {
      const res = await fetch('/api/transactions/generate-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: id }),
      })
      if (!res.ok) throw new Error('Error al generar')
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (recurring.length === 0) return null

  return (
    <section className="mt-8 bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-emerald-600" />
        Gastos Fijos Programados
      </h2>
      <div className="space-y-3">
        {recurring.map((item: Transaction) => {
          const freq = item.subscription_frequency || 'monthly'
          const isGenerating = generating.has(item.id)
          const isEditingThis = editing === item.id

          if (isEditingThis) {
            return (
              <TransactionForm
                key={item.id}
                userId={userId}
                initialTransaction={item}
                onSuccess={() => { setEditing(null); router.refresh() }}
              />
            )
          }

          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border/50 hover:border-border transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{item.description}</p>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                    {FREQ_LABEL[freq] || 'Mensual'}
                  </span>
                  {item.categories?.name && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.categories?.color + '18' || '#e5e7eb', color: item.categories?.color || '#6b7280' }}
                    >
                      {item.categories.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-medium text-foreground">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: item.currency || 'ARS' }).format(item.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Próx: {getNextDate(item.transaction_date, freq)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-3 shrink-0">
                <button
                  onClick={() => setEditing(item.id)}
                  className="p-2 text-xs hover:bg-secondary rounded-lg font-medium transition-colors"
                  title="Editar"
                  aria-label="Editar"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleGenerate(item.id)}
                  disabled={isGenerating}
                  className={cn(
                    "p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1",
                    "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  )}
                  title="Generar este mes"
                  aria-label="Generar este mes"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
