'use client'

import { useState, useEffect } from 'react'
import { accountsService } from '@/services/accountsService'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { estimateNextClosing } from '@/lib/utils'
import { AccountBasicFields } from './AccountBasicFields'
import { CreditCardConfig } from './CreditCardConfig'
import { BillingCyclesManager } from './BillingCyclesManager'

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
          name, balance: parseFloat(balance), currency, type, color,
        })
      } else {
        account = await accountsService.create(supabase, {
          user_id: userId, name, balance: parseFloat(balance), currency, type, color,
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
        setName(''); setBalance('')
        setClosingDay('18'); setClosingRule('last_thursday'); setDueDay('')
        setBankName(''); setLast4Digits(''); setCreditLimit('')
        setBillingCycles([])
      }
    } catch (error) {
      console.error('Error saving account:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const nextClosingEstimate = estimateNextClosing(closingRule, parseInt(closingDay) || 18)

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-2xl bg-card shadow-sm">
      <h2 className="text-lg font-semibold">{initialAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>

      <AccountBasicFields
        name={name} setName={setName}
        balance={balance} setBalance={setBalance}
        currency={currency} setCurrency={setCurrency}
        type={type} setType={setType}
      />

      {type === 'credit_card' && (
        <CreditCardConfig
          closingRule={closingRule} setClosingRule={setClosingRule}
          closingDay={closingDay} setClosingDay={setClosingDay}
          dueDay={dueDay} setDueDay={setDueDay}
          bankName={bankName} setBankName={setBankName}
          last4Digits={last4Digits} setLast4Digits={setLast4Digits}
          creditLimit={creditLimit} setCreditLimit={setCreditLimit}
          nextClosingEstimate={nextClosingEstimate}
        >
          {initialAccount && creditCardId && (
            <BillingCyclesManager
              creditCardId={creditCardId}
              billingCycles={billingCycles}
              newCloseDate={newCloseDate} setNewCloseDate={setNewCloseDate}
              newDueDate={newDueDate} setNewDueDate={setNewDueDate}
              addingCycle={addingCycle} setAddingCycle={setAddingCycle}
              onAddCycle={addBillingCycle}
              onRemoveCycle={removeBillingCycle}
            />
          )}
        </CreditCardConfig>
      )}

      <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2 rounded-xl font-medium hover:opacity-90 transition-opacity">
        {loading ? 'Guardando...' : initialAccount ? 'Actualizar' : 'Crear Cuenta'}
      </button>
    </form>
  )
}
