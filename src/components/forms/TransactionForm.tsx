'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { transactionsService } from '@/services/transactionsService'
import { accountsService } from '@/services/accountsService'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { enqueueTransaction, getQueueSize } from '@/lib/offlineQueue'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Check } from 'lucide-react'
import { cn, getBillingMonthFromRules } from '@/lib/utils'
import { useTransactionForm } from '@/hooks/useTransactionForm'
import { useCategories } from '@/hooks/useCategories'
import { useCreditCardInfo } from '@/hooks/useCreditCardInfo'
import { useSplitPreview } from '@/hooks/useSplitPreview'
import { TypeToggle, AmountInput, AccountSelect, InstallmentsSection, RecurringSection, HouseholdSection, BillingMonthPreview } from './transaction'

type Transaction = Database['public']['Tables']['transactions']['Row']
type Account = Database['public']['Tables']['accounts']['Row']
type HouseholdMember = Database['public']['Tables']['household_members']['Row']
type HouseholdIncome = Database['public']['Tables']['household_incomes']['Row']

export function TransactionForm({ userId, initialTransaction, onSuccess }: {
  userId: string, initialTransaction?: Transaction, onSuccess?: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const isOnline = useOnlineStatus()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [householdMembers, setHouseholdMembers] = useState<(HouseholdMember & { profiles?: { full_name?: string } })[]>([])
  const [householdIncomes, setHouseholdIncomes] = useState<HouseholdIncome[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const isEditing = !!initialTransaction

  const f = useTransactionForm(initialTransaction ?? null)
  const { categories } = useCategories()
  const { creditCardData } = useCreditCardInfo(f.paymentMethod === 'card' ? f.accountId : undefined)
  const { splitPreview } = useSplitPreview(f.amount, householdMembers, householdIncomes, userId, f.isHouseholdExpense)

  useEffect(() => { getQueueSize().then(setPendingCount) }, [])
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      import('@/lib/offlineQueue').then(({ processQueue }) => {
        processQueue().then(() => getQueueSize().then(setPendingCount))
      })
    }
  }, [isOnline])

  const billingMonth = useMemo(() => {
    if (f.paymentMethod !== 'card' || !creditCardData) return null
    const [y, m, d] = f.transactionDate.split('-').map(Number)
    return getBillingMonthFromRules(new Date(y, m - 1, d), creditCardData.closing_rule, creditCardData.closing_day)
  }, [f.paymentMethod, creditCardData, f.transactionDate])

  const billingMonthLabel = useMemo(() => {
    if (!billingMonth) return null
    const [y, m] = billingMonth.split('-').map(Number)
    return new Date(y, m - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  }, [billingMonth])

  useEffect(() => {
    (async () => {
      const data = await accountsService.getAll(supabase, userId)
      setAccounts(data)
      if (!f.accountId && data.length > 0) { f.setAccountId(data[0].id); f.setCurrency(data[0].currency as 'ARS' | 'USD') }

      const { data: membership } = await supabase.from('household_members').select('household_id')
        .eq('user_id', userId).maybeSingle() as { data: { household_id: string } | null }
      if (!membership) return
      setHouseholdId(membership.household_id)
      if (isEditing && initialTransaction?.household_id) f.setIsHouseholdExpense(true)

      const [{ data: members }, { data: profiles }, { data: incomes }] = await Promise.all([
        supabase.from('household_members').select('*').eq('household_id', membership.household_id),
        supabase.from('profiles').select('id, full_name'),
        supabase.from('household_incomes').select('*').eq('household_id', membership.household_id),
      ])
      const lookup = new Map((profiles || []).map((p: any) => [p.id, p]))
      setHouseholdMembers((members || []).map((m: any) => ({ ...m, profiles: lookup.has(m.user_id) ? { full_name: lookup.get(m.user_id)?.full_name ?? undefined } : undefined })))
      setHouseholdIncomes(incomes || [])
    })()
  }, [supabase, userId])

  const handleAccountChange = (newId: string) => {
    f.setAccountId(newId)
    const acc = accounts.find(a => a.id === newId)
    if (acc) f.setCurrency(acc.currency as 'ARS' | 'USD')
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    f.setLoading(true)
    try {
      const parsedAmount = parseFloat(f.amount)
      const finalInstallments = f.getFinalInstallments()
      const [y, m, d] = f.transactionDate.split('-').map(Number)
      const now = new Date()
      const txnDate = isEditing ? new Date(initialTransaction!.transaction_date) : new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())

      const body = {
        user_id: userId, account_id: f.accountId, amount: parsedAmount, currency: f.currency,
        type: (f.isRecurring ? 'subscription' : f.type) as 'income' | 'expense' | 'subscription',
        category_id: f.type === 'expense' && f.categoryId ? f.categoryId : null,
        description: f.description, transaction_date: txnDate.toISOString(), payment_method: f.paymentMethod,
        is_installment: f.isInstallment, installments_total: finalInstallments, installment_number: 1,
        subscription_frequency: f.isRecurring ? f.frequency : null,
        household_id: (f.isHouseholdExpense || f.isHouseholdVisible) && householdId ? householdId : null
      }

      let txn: Transaction | Transaction[] | undefined
      if (isEditing) {
        await transactionsService.update(supabase, initialTransaction!.id, body)
      } else if (!isOnline && !isEditing) {
        await enqueueTransaction({
          id: crypto.randomUUID(),
          description: f.description,
          amount: parsedAmount,
          currency: f.currency,
          type: body.type,
          accountId: f.accountId,
          paymentMethod: f.paymentMethod,
          installments: finalInstallments,
          createdAt: txnDate.toISOString(),
        })
        setPendingCount(prev => prev + 1)
        f.setLoading(false)
        if (onSuccess) onSuccess()
        f.resetForm()
        return
      } else if (f.isInstallment) {
        txn = await transactionsService.createInstallments(supabase, body, finalInstallments)
      } else {
        txn = await transactionsService.create(supabase, body)
      }

      let txnId: string | null = null
      if (txn) txnId = Array.isArray(txn) ? (txn[0] as Transaction)?.id || null : (txn as Transaction).id || null

      if (txnId && f.isHouseholdExpense && householdId && splitPreview.length > 0) {
        await fetch('/api/households/split', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ household_id: householdId, transaction_id: txnId, amount: f.isInstallment ? parsedAmount / finalInstallments : parsedAmount, currency: f.currency })
        })
      }
      router.refresh()
      if (onSuccess) onSuccess()
      if (!isEditing) f.resetForm()
    } catch (error) { console.error('Error saving transaction:', error) }
    finally { f.setLoading(false) }
  }, [f, isEditing, initialTransaction, householdId, splitPreview, supabase, router, userId, onSuccess])

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-2xl bg-card shadow-sm">
      <h2 className="text-lg font-semibold">{isEditing ? 'Editar consumo' : 'Nuevo consumo'}</h2>

      <div>
        <label htmlFor="txn-description" className="text-xs text-muted-foreground mb-1 block">
          Descripción
        </label>
        <input
          id="txn-description"
          type="text"
          placeholder="Descripción"
          value={f.description}
          onChange={e => f.setDescription(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-xl text-sm"
          required
        />
      </div>
      <AmountInput id="txn-amount" label="Monto" value={f.amount} onChange={f.setAmount} />

      <div>
        <label htmlFor="txn-date" className="text-xs text-muted-foreground mb-1 block">Fecha</label>
        <input id="txn-date" type="date" value={f.transactionDate} onChange={e => f.setTransactionDate(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-xl text-sm" />
      </div>

      <TypeToggle value={f.type} onChange={f.setType} />

      {f.type === 'expense' && categories.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Categoría</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {categories.map(cat => (
              <button key={cat.id} type="button" onClick={() => f.setCategoryId(cat.id === f.categoryId ? '' : cat.id)}
                className={cn("flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-medium transition-all border",
                  f.categoryId === cat.id ? "border-2 shadow-sm" : "border-transparent hover:bg-muted/50")}
                style={f.categoryId === cat.id ? { borderColor: cat.color, backgroundColor: cat.color + '15' } : undefined}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: cat.color }}>
                  {f.categoryId === cat.id ? <Check className="w-3 h-3" /> : cat.name.charAt(0)}
                </span>
                <span className="text-center leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <AccountSelect value={f.accountId} accounts={accounts} onChange={handleAccountChange} />
      <CustomSelect value={f.currency} onChange={v => f.setCurrency(v as 'ARS' | 'USD')} options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]} />
      <CustomSelect value={f.paymentMethod} onChange={v => f.setPaymentMethod(v as 'cash' | 'card' | 'transfer')}
        options={[{ value: 'cash', label: 'Efectivo' }, { value: 'card', label: 'Tarjeta' }, { value: 'transfer', label: 'Transferencia' }]} />

      <BillingMonthPreview label={billingMonthLabel} />

      {f.paymentMethod === 'card' && (
        <InstallmentsSection isInstallment={f.isInstallment} installmentsTotal={f.installmentsTotal} customInstallments={f.customInstallments}
          onToggle={v => { f.setIsInstallment(v); if (!v) { f.setInstallmentsTotal(''); f.setCustomInstallments('') } }}
          onInstallmentsTotalChange={f.setInstallmentsTotal} onCustomInstallmentsChange={f.setCustomInstallments} />
      )}

      {f.type === 'expense' && !f.isInstallment && (
        <RecurringSection isRecurring={f.isRecurring} frequency={f.frequency} onToggle={f.setIsRecurring} onFrequencyChange={f.setFrequency} />
      )}

      <HouseholdSection householdId={householdId} isHouseholdVisible={f.isHouseholdVisible} isHouseholdExpense={f.isHouseholdExpense}
        splitPreview={splitPreview} onVisibleToggle={f.setIsHouseholdVisible} onExpenseToggle={f.setIsHouseholdExpense} />

      <button type="submit" disabled={f.loading || !f.amount || !f.description.trim() || (f.type === 'expense' && !f.categoryId)}
        className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
        {f.loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
      </button>

      {!isOnline && !isEditing && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
          Sin conexión — se guardará al reconectar
        </p>
      )}
      {pendingCount > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
          {pendingCount} transacción{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronización
        </p>
      )}
    </form>
  )
}
