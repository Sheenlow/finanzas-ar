'use client'

import { useState, useEffect } from 'react'
import { transactionsService } from '@/services/transactionsService'
import { accountsService } from '@/services/accountsService'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { CustomSelect } from '../ui/CustomSelect'
import { Users, CreditCard, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type Transaction = Database['public']['Tables']['transactions']['Row']
type Account = Database['public']['Tables']['accounts']['Row']
type HouseholdMember = Database['public']['Tables']['household_members']['Row']
type HouseholdIncome = Database['public']['Tables']['household_incomes']['Row']

interface Category {
  id: string
  name: string
  color: string
}

interface SplitPreview {
  user_id: string
  name: string
  percentage: number
  amount: number
}

const INSTALLMENT_OPTIONS = [3, 6, 9, 12, 18, 24]

export function TransactionForm({ userId, initialTransaction, onSuccess }: {
  userId: string,
  initialTransaction?: Transaction,
  onSuccess?: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState(initialTransaction?.category_id || '')
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [isHouseholdVisible, setIsHouseholdVisible] = useState(false)
  const [isHouseholdExpense, setIsHouseholdExpense] = useState(false)
  const [householdMembers, setHouseholdMembers] = useState<(HouseholdMember & { profiles?: { full_name?: string } })[]>([])
  const [householdIncomes, setHouseholdIncomes] = useState<HouseholdIncome[]>([])
  const [splitPreview, setSplitPreview] = useState<SplitPreview[]>([])

  const [description, setDescription] = useState(initialTransaction?.description || '')
  const [amount, setAmount] = useState(initialTransaction?.amount.toString() || '')
  const [type, setType] = useState<'expense' | 'income'>(initialTransaction?.type === 'income' ? 'income' : 'expense')
  const [accountId, setAccountId] = useState(initialTransaction?.account_id || '')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(initialTransaction?.currency as 'ARS' | 'USD' || 'ARS')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>(initialTransaction?.payment_method as 'cash' | 'card' | 'transfer' || 'cash')
  const [isInstallment, setIsInstallment] = useState(initialTransaction?.is_installment || false)
  const [installmentsTotal, setInstallmentsTotal] = useState(initialTransaction?.installments_total?.toString() || '')
  const [customInstallments, setCustomInstallments] = useState('')
  const [transactionDate, setTransactionDate] = useState(
    initialTransaction?.transaction_date
      ? new Date(initialTransaction.transaction_date).toLocaleDateString('sv-SE')
      : new Date().toLocaleDateString('sv-SE')
  )
  const [loading, setLoading] = useState(false)
  const [isRecurring, setIsRecurring] = useState(!!initialTransaction?.subscription_frequency)
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'biannual' | 'annual'>(
    (initialTransaction?.subscription_frequency as any) || 'monthly'
  )

  useEffect(() => {
    async function load() {
      const data = await accountsService.getAll(supabase, userId)
      setAccounts(data)
      if (!accountId && data.length > 0) {
        setAccountId(data[0].id)
        setCurrency(data[0].currency as 'ARS' | 'USD')
      }

      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, color')
        .eq('type', 'expense')
        .order('name')
      setCategories(cats || [])

      const { data: membership } = (await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .maybeSingle()) as { data: { household_id: string } | null }
      if (membership) {
        setHouseholdId(membership.household_id)
        if (initialTransaction?.household_id) setIsHouseholdExpense(true)

        const [{ data: members }, { data: profiles }, { data: incomes }] = await Promise.all([
          supabase.from('household_members').select('*').eq('household_id', membership.household_id),
          supabase.from('profiles').select('id, full_name'),
          supabase.from('household_incomes').select('*').eq('household_id', membership.household_id),
        ]) as [
          { data: { id: string; user_id: string; household_id: string; role: 'admin' | 'member'; split_percentage: number; joined_at: string }[] | null },
          { data: { id: string; full_name: string | null }[] | null },
          { data: { id: string; user_id: string; household_id: string; monthly_income_ars: number; updated_at: string }[] | null },
        ]

        const profileLookup = new Map((profiles || []).map((p) => [p.id, p]))
        setHouseholdMembers((members || []).map((m) => ({
          ...m,
          profiles: profileLookup.has(m.user_id) ? { full_name: (profileLookup.get(m.user_id) as { full_name?: string | null })?.full_name ?? undefined } : undefined,
        })))
        setHouseholdIncomes(incomes || [])
      }
    }
    load()
  }, [supabase, userId])

  useEffect(() => {
    if (isHouseholdExpense && householdMembers.length > 0 && amount) {
      const totalAmount = parseFloat(amount) || 0
      const incomeMap = new Map(householdIncomes.map(i => [i.user_id, i.monthly_income_ars]))
      const memberList = householdMembers.filter(m => m.user_id !== userId)
      const totalIncome = Array.from(incomeMap.values()).reduce((sum, v) => sum + v, 0)

      const preview: SplitPreview[] = memberList.map(m => {
        const income = incomeMap.get(m.user_id) || 0
        const name = (m.profiles as { full_name?: string | null } | null)?.full_name || (m.user_id === userId ? 'Vos' : 'Miembro')
        const percentage = totalIncome > 0 ? (income / totalIncome) * 100 : (m.split_percentage || 0)
        return {
          user_id: m.user_id,
          name,
          percentage: Math.round(percentage * 100) / 100,
          amount: Math.round((totalAmount * percentage / 100) * 100) / 100
        }
      }).filter(p => p.percentage > 0)

      setSplitPreview(preview)
    } else {
      setSplitPreview([])
    }
  }, [isHouseholdExpense, amount, householdMembers, householdIncomes, userId])

  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId)
    const selectedAccount = accounts.find(acc => acc.id === newAccountId)
    if (selectedAccount) {
      setCurrency(selectedAccount.currency as 'ARS' | 'USD')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const parsedAmount = parseFloat(amount)
    const finalInstallments = isInstallment
      ? (parseInt(installmentsTotal) || parseInt(customInstallments) || 3)
      : 0

    const [year, month, day] = transactionDate.split('-').map(Number)
    const now = new Date()
    const txnDate = initialTransaction
      ? new Date(initialTransaction.transaction_date)
      : new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds())

    const transactionData = {
      user_id: userId,
      account_id: accountId,
      amount: parsedAmount,
      currency,
      type: (isRecurring ? 'subscription' : type) as 'income' | 'expense' | 'subscription',
      category_id: type === 'expense' && categoryId ? categoryId : null,
      description,
      transaction_date: txnDate.toISOString(),
      payment_method: paymentMethod,
      is_installment: isInstallment,
      installments_total: finalInstallments,
      installment_number: 1,
      subscription_frequency: isRecurring ? frequency : null,
      household_id: (isHouseholdExpense || isHouseholdVisible) && householdId ? householdId : null
    }

    try {
      let transaction: Transaction | Transaction[] | undefined
      if (initialTransaction) {
        await transactionsService.update(supabase, initialTransaction.id, transactionData)
      } else if (isInstallment) {
        transaction = await transactionsService.createInstallments(supabase, transactionData, finalInstallments)
      } else {
        transaction = await transactionsService.create(supabase, transactionData)
      }

      let transactionId: string | null = null
      if (transaction) {
        if (Array.isArray(transaction)) {
          transactionId = (transaction[0] as Transaction)?.id || null
        } else {
          transactionId = (transaction as Transaction).id || null
        }
      }

      if (transactionId && isHouseholdExpense && householdId && splitPreview.length > 0) {
        const splitAmount = isInstallment ? parsedAmount / finalInstallments : parsedAmount
        await fetch('/api/households/split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            household_id: householdId,
            transaction_id: transactionId,
            amount: splitAmount,
            currency,
          })
        })
      }

      router.refresh()
      if (onSuccess) onSuccess()
      if (!initialTransaction) {
        setDescription('')
        setAmount('')
        setCategoryId('')
        setIsInstallment(false)
        setInstallmentsTotal('')
        setCustomInstallments('')
        setIsHouseholdVisible(false)
        setIsHouseholdExpense(false)
      }
    } catch (error) {
      console.error('Error saving transaction:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedCategory = categories.find(c => c.id === categoryId)

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-2xl bg-card shadow-sm">
      <h2 className="text-lg font-semibold">{initialTransaction ? 'Editar consumo' : 'Nuevo consumo'}</h2>

      <input
        type="text"
        placeholder="Descripción"
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-xl text-sm"
        required
      />

      <input
        type="number"
        placeholder="Monto"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-xl text-sm"
        required
      />

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Fecha</label>
        <input
          type="date"
          value={transactionDate}
          onChange={e => setTransactionDate(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-xl text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Tipo</label>
        <div className="flex gap-2">
          {[
            { value: 'expense', label: 'Gasto' },
            { value: 'income', label: 'Ingreso' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value as 'expense' | 'income')}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
                type === opt.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {type === 'expense' && categories.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Categoría</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id === categoryId ? '' : cat.id)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-medium transition-all border",
                  categoryId === cat.id
                    ? "border-2 shadow-sm"
                    : "border-transparent hover:bg-muted/50"
                )}
                style={categoryId === cat.id ? { borderColor: cat.color, backgroundColor: cat.color + '15' } : undefined}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]"
                  style={{ backgroundColor: cat.color }}
                >
                  {categoryId === cat.id ? <Check className="w-3 h-3" /> : cat.name.charAt(0)}
                </span>
                <span className="text-center leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CustomSelect
        value={accountId}
        onChange={handleAccountChange}
        options={accounts.map(acc => ({ value: acc.id, label: acc.name }))}
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
        value={paymentMethod}
        onChange={val => setPaymentMethod(val as 'cash' | 'card' | 'transfer')}
        options={[
          { value: 'cash', label: 'Efectivo' },
          { value: 'card', label: 'Tarjeta' },
          { value: 'transfer', label: 'Transferencia' }
        ]}
      />

      {paymentMethod === 'card' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { setIsInstallment(!isInstallment); if (isInstallment) { setInstallmentsTotal(''); setCustomInstallments('') } }}
            className={cn(
              "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
              isInstallment
                ? "bg-amber-500/10 border-amber-500/30 text-amber-700"
                : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              En cuotas
            </span>
            <div className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              isInstallment ? "bg-amber-500" : "bg-muted-foreground/30"
            )}>
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                isInstallment ? "left-5" : "left-0.5"
              )} />
            </div>
          </button>

          {isInstallment && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {INSTALLMENT_OPTIONS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setInstallmentsTotal(n.toString()); setCustomInstallments('') }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      installmentsTotal === n.toString()
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="Otra"
                  value={customInstallments}
                  onChange={e => { setCustomInstallments(e.target.value); setInstallmentsTotal('') }}
                  className={cn(
                    "w-14 px-2 py-1.5 rounded-lg text-xs font-medium border text-center",
                    customInstallments ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/50 border-border"
                  )}
                  min="1"
                  max="99"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {type === 'expense' && !isInstallment && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setIsRecurring(!isRecurring)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
              isRecurring
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
                : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Fijar como gasto recurrente
            </span>
            <div className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              isRecurring ? "bg-emerald-500" : "bg-muted-foreground/30"
            )}>
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                isRecurring ? "left-5" : "left-0.5"
              )} />
            </div>
          </button>

          {isRecurring && (
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'monthly', label: 'Mensual' },
                { value: 'quarterly', label: 'Trimestral' },
                { value: 'biannual', label: 'Semestral' },
                { value: 'annual', label: 'Anual' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    frequency === opt.value
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {householdId && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              const next = !isHouseholdVisible
              setIsHouseholdVisible(next)
              if (!next) setIsHouseholdExpense(false)
            }}
            className={cn(
              "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
              isHouseholdVisible
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
                : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Mostrar en el hogar
            </span>
            <div className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              isHouseholdVisible ? "bg-emerald-500" : "bg-muted-foreground/30"
            )}>
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                isHouseholdVisible ? "left-5" : "left-0.5"
              )} />
            </div>
          </button>

          {isHouseholdVisible && (
            <button
              type="button"
              onClick={() => setIsHouseholdExpense(!isHouseholdExpense)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                isHouseholdExpense
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-700"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Compartir con el hogar
              </span>
              <div className={cn(
                "w-10 h-5 rounded-full transition-colors relative",
                isHouseholdExpense ? "bg-indigo-500" : "bg-muted-foreground/30"
              )}>
                <div className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                  isHouseholdExpense ? "left-5" : "left-0.5"
                )} />
              </div>
            </button>
          )}

          {isHouseholdExpense && splitPreview.length > 0 && (
            <div className="p-3 bg-indigo-50/50 border border-indigo-200/50 rounded-xl space-y-1">
              <p className="text-xs text-indigo-700 font-medium mb-1">División del gasto</p>
              {splitPreview.map(p => (
                <div key={p.user_id} className="flex justify-between text-sm">
                  <span className="text-indigo-700">{p.name}</span>
                  <span className="text-indigo-600">
                    {p.percentage}% = ${p.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !amount || !description.trim() || (type === 'expense' && !categoryId)}
        className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Guardando...' : initialTransaction ? 'Actualizar' : 'Crear'}
      </button>
    </form>
  )
}
