'use client'

import { useState } from 'react'
import { accountsService } from '@/services/accountsService'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { AccountForm } from './forms/AccountForm'
import { Wallet } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = {
  bank: 'Banco',
  cash: 'Efectivo',
  crypto: 'Crypto',
}

type Account = Database['public']['Tables']['accounts']['Row']

export function AccountItem({ account, userId }: { account: Account, userId: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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

  return (
    <div className="group p-5 bg-card border border-border/50 rounded-2xl flex items-center justify-between hover:border-border transition-all shadow-sm hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-full bg-secondary text-primary">
            <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-sm">{account.name}</h3>
          <p className="text-xs text-muted-foreground">{TYPE_LABEL[account.type] || account.type}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="font-bold text-lg text-foreground">
            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: account.currency }).format(account.balance)}
          </p>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="p-2 text-xs hover:bg-secondary rounded-lg font-medium">Editar</button>
            <button onClick={handleDelete} className="p-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium">Borrar</button>
        </div>
      </div>
    </div>
  )
}
