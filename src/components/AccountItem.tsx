'use client'

import { useState, useEffect } from 'react'
import { accountsService } from '@/services/accountsService'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { AccountForm } from './forms/AccountForm'
import { Wallet, CreditCard } from 'lucide-react'
import { estimateNextClosing } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  bank: 'Banco',
  cash: 'Efectivo',
  crypto: 'Crypto',
  credit_card: 'Tarjeta de Crédito',
}

type Account = Database['public']['Tables']['accounts']['Row']
type CreditCardRow = Database['public']['Tables']['credit_cards']['Row']

export function AccountItem({ account, userId }: { account: Account, userId: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [cardData, setCardData] = useState<CreditCardRow | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (account.type === 'credit_card') {
      accountsService.getCreditCard(supabase, account.id).then(setCardData)
    }
  }, [account.id, account.type])

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de que deseas borrar esta cuenta?')) {
      try {
        await accountsService.delete(supabase, account.id)
        router.refresh()
      } catch (error) {
        console.error('Error deleting account:', error)
      }
    }
  }

  if (isEditing) {
    return (
      <AccountForm 
        userId={userId} 
        initialAccount={account} 
        onSuccess={() => setIsEditing(false)} 
      />
    )
  }

  const Icon = account.type === 'credit_card' ? CreditCard : Wallet

  return (
    <div className="group p-5 bg-card border border-border/50 rounded-2xl flex items-center justify-between hover:border-border transition-all shadow-sm hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-full bg-secondary text-primary">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-sm">{account.name}</h3>
          <p className="text-xs text-muted-foreground">
            {TYPE_LABEL[account.type] || account.type}
            {cardData?.bank_name && ` · ${cardData.bank_name}`}
            {cardData?.last_4_digits && ` · ****${cardData.last_4_digits}`}
          </p>
          {cardData && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {cardData.closing_rule === 'last_thursday'
                ? <>Próx. cierre: {estimateNextClosing(cardData.closing_rule, cardData.closing_day)}</>
                : <>Cierra el {cardData.closing_day}</>
              }
              {cardData.due_day && ` · Vence el ${cardData.due_day}`}
              {cardData.credit_limit != null && ` · Límite ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: account.currency }).format(cardData.credit_limit)}`}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="font-bold text-lg text-foreground">
            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: account.currency }).format(account.balance)}
          </p>
        </div>

        <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="p-2 text-xs hover:bg-secondary rounded-lg font-medium">Editar</button>
            <button onClick={handleDelete} className="p-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium">Borrar</button>
        </div>
      </div>
    </div>
  )
}
