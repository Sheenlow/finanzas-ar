'use client'

import { useState, useEffect } from 'react'
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
  const [type, setType] = useState<'bank' | 'cash' | 'crypto' | 'credit_card'>(initialAccount?.type || 'bank')
  const [loading, setLoading] = useState(false)

  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [bankName, setBankName] = useState('')
  const [last4Digits, setLast4Digits] = useState('')
  const [creditLimit, setCreditLimit] = useState('')

  useEffect(() => {
    if (initialAccount && type === 'credit_card') {
      accountsService.getCreditCard(supabase, initialAccount.id).then(card => {
        if (card) {
          setClosingDay(card.closing_day?.toString() || '')
          setDueDay(card.due_day?.toString() || '')
          setBankName(card.bank_name || '')
          setLast4Digits(card.last_4_digits || '')
          setCreditLimit(card.credit_limit?.toString() || '')
        }
      })
    }
  }, [initialAccount?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const color = type === 'crypto' ? 'var(--color-crypto)' : type === 'bank' ? 'var(--color-celeste)' : type === 'credit_card' ? 'var(--color-celeste)' : 'var(--color-peso)'

      let account: Account
      if (initialAccount) {
        account = await accountsService.update(supabase, initialAccount.id, {
          name,
          balance: parseFloat(balance),
          currency,
          type,
          color,
        })
      } else {
        account = await accountsService.create(supabase, {
          user_id: userId,
          name,
          balance: parseFloat(balance),
          currency,
          type,
          color,
        })
      }

      if (type === 'credit_card') {
        await accountsService.upsertCreditCard(supabase, {
          account_id: account.id,
          closing_day: parseInt(closingDay) || 1,
          due_day: dueDay ? parseInt(dueDay) : null,
          bank_name: bankName || null,
          last_4_digits: last4Digits || null,
          credit_limit: creditLimit ? parseFloat(creditLimit) : null,
        })
      } else if (initialAccount) {
        await accountsService.deleteCreditCard(supabase, initialAccount.id).catch(() => {})
      }
      
      router.refresh()
      if (onSuccess) onSuccess()
      if (!initialAccount) {
        setName('')
        setBalance('')
        setClosingDay('')
        setDueDay('')
        setBankName('')
        setLast4Digits('')
        setCreditLimit('')
      }
    } catch (error) {
      console.error('Error saving account:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const dayOptions = Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }))

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
        onChange={(val) => setType(val as 'bank' | 'cash' | 'crypto' | 'credit_card')}
        options={[
            { value: 'bank', label: 'Banco' },
            { value: 'cash', label: 'Efectivo' },
            { value: 'crypto', label: 'Crypto' },
            { value: 'credit_card', label: 'Tarjeta de Crédito' }
        ]}
      />

      {type === 'credit_card' && (
        <div className="space-y-3 p-4 bg-secondary/20 rounded-xl border border-border/50">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Datos de la tarjeta</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Día de cierre</label>
              <CustomSelect
                value={closingDay}
                onChange={setClosingDay}
                options={dayOptions}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Día de vencimiento</label>
              <CustomSelect
                value={dueDay}
                onChange={setDueDay}
                options={[{ value: '', label: '—' }, ...dayOptions]}
              />
            </div>
          </div>

          <input
            type="text"
            placeholder="Banco / Nombre de la tarjeta (ej: Visa Galicia)"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-xl text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Últimos 4 dígitos"
              value={last4Digits}
              onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              className="w-full px-4 py-2 border border-border rounded-xl text-sm"
            />
            <input
              type="number"
              placeholder="Límite de crédito"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-xl text-sm"
            />
          </div>
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2 rounded-xl font-medium hover:opacity-90 transition-opacity">
        {loading ? 'Guardando...' : initialAccount ? 'Actualizar' : 'Crear Cuenta'}
      </button>
    </form>
  )
}
