'use client'

import { useState } from 'react'
import { accountsService } from '@/services/accountsService'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { CustomSelect } from '../ui/CustomSelect'

type Account = Database['public']['Tables']['accounts']['Row']

export function AccountForm({ userId, initialAccount, onSuccess }: { 
  userId: string, 
  initialAccount?: Account,
  onSuccess?: () => void 
}) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(initialAccount?.name || '')
  const [balance, setBalance] = useState(initialAccount?.balance.toString() || '')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(initialAccount?.currency as 'ARS' | 'USD' || 'ARS')
  const [type, setType] = useState<'bank' | 'cash' | 'crypto'>(initialAccount?.type || 'bank')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (initialAccount) {
        await accountsService.update(supabase, initialAccount.id, {
          name,
          balance: parseFloat(balance),
          currency,
          type,
          color: type === 'crypto' ? 'var(--color-crypto)' : type === 'bank' ? 'var(--color-celeste)' : 'var(--color-peso)'
        })
      } else {
        await accountsService.create(supabase, {
          user_id: userId,
          name,
          balance: parseFloat(balance),
          currency,
          type,
          color: type === 'crypto' ? 'var(--color-crypto)' : type === 'bank' ? 'var(--color-celeste)' : 'var(--color-peso)'
        })
      }
      
      router.refresh()
      if (onSuccess) onSuccess()
      if (!initialAccount) {
        setName('')
        setBalance('')
      }
    } catch (error) {
      console.error('Error saving account:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-2xl bg-card shadow-sm">
      <h2 className="text-lg font-semibold">{initialAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
      <input
        type="text"
        placeholder="Nombre de la cuenta"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all"
        required
      />
      <input
        type="number"
        placeholder="Balance inicial"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all"
        required
      />
      <CustomSelect 
        value={currency} 
        onChange={(val) => setCurrency(val as 'ARS' | 'USD')}
        options={[
            { value: 'ARS', label: 'ARS' },
            { value: 'USD', label: 'USD' }
        ]}
      />
      <CustomSelect 
        value={type} 
        onChange={(val) => setType(val as 'bank' | 'cash' | 'crypto')}
        options={[
            { value: 'bank', label: 'Banco' },
            { value: 'cash', label: 'Efectivo' },
            { value: 'crypto', label: 'Crypto' }
        ]}
      />
      <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2 rounded-xl font-medium hover:opacity-90 transition-opacity">
        {loading ? 'Guardando...' : initialAccount ? 'Actualizar' : 'Crear Cuenta'}
      </button>
    </form>
  )
}
