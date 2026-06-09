'use client'

import { useState } from 'react'
import { transactionsService } from '@/services/transactionsService'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TransactionForm } from './forms/TransactionForm'
import { ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TransactionItem({ transaction, userId }: { transaction: any, userId: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de que deseas borrar esta transacción?')) {
      try {
        await transactionsService.delete(supabase, transaction.id)
        router.refresh()
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
    }
  }

  if (isEditing) {
    return (
      <TransactionForm 
        userId={userId} 
        initialTransaction={transaction} 
        onSuccess={() => setIsEditing(false)} 
      />
    )
  }

  const date = new Date(transaction.transaction_date)
  const formattedDate = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  const FREQ_MAP: Record<string, string> = { monthly: 'Mensual', quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual' }
  const isIncome = transaction.type === 'income'

  return (
    <div className="group p-4 bg-card border border-border/50 rounded-2xl flex items-center justify-between hover:border-border transition-all shadow-sm hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className={cn("p-2 rounded-full", isIncome ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            <ArrowRightLeft className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-medium text-foreground text-sm">{transaction.description}</h3>
          <p className="text-xs text-muted-foreground">{transaction.accounts?.name} • {formattedDate}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-right">
            <p className={cn("font-semibold text-sm", isIncome ? "text-emerald-700" : "text-foreground")}>
                {isIncome ? '+' : '-'}{' '}
                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: transaction.currency }).format(
                transaction.is_installment ? transaction.amount * transaction.installments_total : transaction.amount
                )}
            </p>
            <span className="text-[10px] uppercase font-medium tracking-tight text-muted-foreground">
                {transaction.is_installment 
                  ? `${transaction.installments_total} cuotas` 
                  : transaction.categories?.name === 'Servicios' ? 'PAGO MENSUAL' 
                  : transaction.type === 'subscription' 
                    ? `Fijo ${FREQ_MAP[transaction.subscription_frequency] || 'Mensual'}`.toUpperCase() 
                  : transaction.type === 'service' ? 'Servicio' 
                  : 'Pago único'}
            </span>
        </div>

        <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="p-2 text-xs hover:bg-secondary rounded-lg">Editar</button>
            <button onClick={handleDelete} className="p-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg">Borrar</button>
        </div>
      </div>
    </div>
  )
}
