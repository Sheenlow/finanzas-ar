'use client'

import { useState, useEffect } from 'react'
import { accountsService } from '@/services/accountsService'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { CustomSelect } from '../ui/CustomSelect'
import { estimateNextClosing } from '@/lib/utils'
import { X, Plus } from 'lucide-react'

type Account = Database['public']['Tables']['accounts']['Row']
type BillingCycle = Database['public']['Tables']['billing_cycles']['Row']

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

  const [closingDay, setClosingDay] = useState('18')
  const [closingRule, setClosingRule] = useState<'fixed' | 'last_thursday'>('last_thursday')
  const [dueDay, setDueDay] = useState('')
  const [bankName, setBankName] = useState('')
  const [last4Digits, setLast4Digits] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [creditCardId, setCreditCardId] = useState<string | null>(null)
  const [billingCycles, setBillingCycles] = useState<BillingCycle[]>([])
  const [newCloseDate, setNewCloseDate] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [addingCycle, setAddingCycle] = useState(false)

  useEffect(() => {
    if (initialAccount && type === 'credit_card') {
      accountsService.getCreditCard(supabase, initialAccount.id).then(card => {
        if (card) {
          setClosingDay(card.closing_day?.toString() || '18')
          setClosingRule(card.closing_rule || 'last_thursday')
          setDueDay(card.due_day?.toString() || '')
          setBankName(card.bank_name || '')
          setLast4Digits(card.last_4_digits || '')
          setCreditLimit(card.credit_limit?.toString() || '')
          setCreditCardId(card.id)
          accountsService.getBillingCycles(supabase, card.id).then(setBillingCycles)
        }
      })
    }
  }, [initialAccount?.id])

  const addBillingCycle = async () => {
    if (!creditCardId || !newCloseDate) return
    try {
      const cycle = await accountsService.addBillingCycle(supabase, {
        credit_card_id: creditCardId,
        close_date: newCloseDate,
        due_date: newDueDate || null,
      })
      setBillingCycles(prev => [cycle, ...prev].sort((a, b) => b.close_date.localeCompare(a.close_date)))
      setNewCloseDate('')
      setNewDueDate('')
      setAddingCycle(false)
    } catch {}
  }

  const removeBillingCycle = async (cycleId: string) => {
    await accountsService.deleteBillingCycle(supabase, cycleId)
    setBillingCycles(prev => prev.filter(c => c.id !== cycleId))
  }

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
          closing_day: parseInt(closingDay) || 18,
          closing_rule: closingRule,
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
        setClosingDay('18')
        setClosingRule('last_thursday')
        setDueDay('')
        setBankName('')
        setLast4Digits('')
        setCreditLimit('')
        setBillingCycles([])
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

  const nextClosingEstimate = estimateNextClosing(closingRule, parseInt(closingDay) || 18)

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

          <CustomSelect
            value={closingRule}
            onChange={(val) => setClosingRule(val as 'fixed' | 'last_thursday')}
            options={[
              { value: 'last_thursday', label: 'Último jueves (autoestimar cierre)' },
              { value: 'fixed', label: 'Día fijo (indicar abajo)' },
            ]}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {closingRule === 'fixed' ? 'Día de cierre' : 'Día de cierre (fallback)'}
              </label>
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

          {closingRule === 'last_thursday' && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
              Próximo cierre estimado: <strong>{nextClosingEstimate}</strong>
            </p>
          )}

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

          {initialAccount && creditCardId && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ciclos de facturación</p>
                <button
                  type="button"
                  onClick={() => setAddingCycle(!addingCycle)}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Agregar
                </button>
              </div>

              {addingCycle && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground block mb-0.5">Cierre</label>
                    <input
                      type="date"
                      value={newCloseDate}
                      onChange={(e) => setNewCloseDate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-border rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground block mb-0.5">Vence</label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-border rounded-lg text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addBillingCycle}
                    disabled={!newCloseDate}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    OK
                  </button>
                </div>
              )}

              {billingCycles.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {billingCycles.map(cycle => (
                    <div key={cycle.id} className="flex items-center justify-between text-xs bg-background px-3 py-1.5 rounded-lg">
                      <span>
                        Cierre: <strong>{new Date(cycle.close_date + 'T00:00:00').toLocaleDateString('es-AR')}</strong>
                        {cycle.due_date && <> · Vence: {new Date(cycle.due_date + 'T00:00:00').toLocaleDateString('es-AR')}</>}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBillingCycle(cycle.id)}
                        className="text-muted-foreground hover:text-rose-500 transition-colors"
                        aria-label="Eliminar ciclo de facturación"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2 rounded-xl font-medium hover:opacity-90 transition-opacity">
        {loading ? 'Guardando...' : initialAccount ? 'Actualizar' : 'Crear Cuenta'}
      </button>
    </form>
  )
}
