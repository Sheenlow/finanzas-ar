import { SupabaseClient } from '@supabase/supabase-js'
import { getBillingMonthFromRules, getBillingMonthFromCycle, escapeHtml } from '@/lib/utils'
import { householdSplitService } from '@/services/householdSplitService'
import { getArgentinaISOString } from '@/lib/argentinaTime'
import { validateParsedTransaction } from './validator'
import { formatAmount } from './parser'
import type { Account, Category, ParsedTransaction, TransactionRow } from './types'

type SubscriptionFrequency = 'monthly' | 'quarterly' | 'biannual' | 'annual'

export class TransactionHandler {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async getAccounts(): Promise<Account[]> {
    const { data } = await this.supabase.from('accounts').select('id, name, currency, type').eq('user_id', this.userId)
    return (data || []) as Account[]
  }

  async getCategories(): Promise<Category[]> {
    const { data } = await this.supabase.from('categories').select('id, name').eq('type', 'expense').order('name')
    return (data || []) as Category[]
  }

  async getSmartDefaults(): Promise<{ accountId: string | null; accountName: string | null; paymentMethod: string }> {
    const { data } = await this.supabase.from('transactions')
      .select('account_id, payment_method, accounts!transactions_account_id_fkey(name)').eq('user_id', this.userId)
      .order('created_at', { ascending: false }).limit(10)
    if (!data || data.length === 0) return { accountId: null, accountName: null, paymentMethod: 'cash' }
    const accountIds = data.map((t) => t.account_id)
    const topAccount = accountIds.sort((a, b) => accountIds.filter((x) => x === b).length - accountIds.filter((x) => x === a).length)[0]
    const methods = data.map((t) => t.payment_method)
    const topMethod = methods.sort((a, b) => methods.filter((x) => x === b).length - methods.filter((x) => x === a).length)[0] || 'cash'
    const accRow = data.find((t) => t.account_id === topAccount)
    const accName = (accRow as Record<string, unknown> | undefined)?.accounts as { name?: string } | undefined
    return { accountId: topAccount, accountName: accName?.name || null, paymentMethod: topMethod }
  }

  async getUserHousehold(): Promise<string | null> {
    const { data } = await this.supabase.from('household_members')
      .select('household_id')
      .eq('user_id', this.userId)
      .maybeSingle()
    return data?.household_id || null
  }

  async createTransaction(parsed: ParsedTransaction): Promise<string> {
    const dateStr = getArgentinaISOString()

    const accounts = await this.getAccounts()
    const categories = await this.getCategories()
    const validation = validateParsedTransaction(parsed, accounts, categories)
    if (!validation.valid) {
      console.error('AI transaction validation failed:', validation.reason, parsed)
      throw new Error('Transacción rechazada por validación de seguridad')
    }

    let categoryId: string | null = null
    if (parsed.categoryName) {
      const cat = categories.find(c => c.name.toLowerCase() === parsed.categoryName!.toLowerCase())
      if (cat) categoryId = cat.id
    }

    const installmentAmount = parsed.installments > 0
      ? Math.round((parsed.amount / parsed.installments) * 100) / 100
      : parsed.amount

    const freq: SubscriptionFrequency | null = parsed.subscriptionFrequency as SubscriptionFrequency | null || (parsed.type === 'subscription' ? 'monthly' : null)

    let billingMonth: string | null = null
    if (parsed.paymentMethod === 'card' && parsed.accountId) {
      try {
        const { data: card } = await this.supabase
          .from('credit_cards')
          .select('id, closing_day, closing_rule')
          .eq('account_id', parsed.accountId)
          .maybeSingle()
        if (card) {
          const { data: cycle } = await this.supabase
            .from('billing_cycles')
            .select('*')
            .eq('credit_card_id', card.id)
            .gte('close_date', dateStr.slice(0, 10))
            .order('close_date', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (cycle) {
            billingMonth = getBillingMonthFromCycle(new Date(dateStr), cycle.close_date)
          } else {
            billingMonth = getBillingMonthFromRules(new Date(dateStr), card.closing_rule, card.closing_day)
          }
        }
      } catch {}
    }

    const { data, error } = await this.supabase.from('transactions').insert([{
      user_id: this.userId, account_id: parsed.accountId, category_id: categoryId,
      amount: installmentAmount, currency: parsed.currency, type: parsed.type,
      description: parsed.description, transaction_date: dateStr, payment_method: parsed.paymentMethod,
      is_installment: parsed.installments > 0, installments_total: parsed.installments || 1, installment_number: 1,
      subscription_frequency: freq,
      household_id: parsed.householdId || null,
      billing_month: billingMonth,
    }]).select('id').single()
    if (error) { console.error('Error creating transaction:', error); throw new Error('Error al guardar el gasto') }

    if (parsed.accountId) {
      const { data: account } = await this.supabase.from('accounts').select('balance').eq('id', parsed.accountId).single()
      if (account) {
        const balanceChange = parsed.type === 'income' ? installmentAmount : -installmentAmount
        await this.supabase.from('accounts').update({ balance: account.balance + balanceChange }).eq('id', parsed.accountId)
      }
    }

    if (parsed.householdId && parsed.isSharing && data) {
      try {
        const { data: members } = await this.supabase.from('household_members')
          .select('id, user_id, split_percentage')
          .eq('household_id', parsed.householdId)
        const { data: incomes } = await this.supabase.from('household_incomes')
          .select('user_id, monthly_income_ars')
          .eq('household_id', parsed.householdId)
        const incomeMap = new Map((incomes || []).map((i) => [i.user_id, i.monthly_income_ars]))

        await householdSplitService.splitHouseholdExpense(
          this.supabase, data.id, parsed.householdId, this.userId,
          installmentAmount, parsed.currency as 'ARS' | 'USD' | 'USDT' | 'USDC' | 'BTC' | 'ETH', members || [], incomeMap
        )
      } catch {}
    }

    return data.id
  }

  async updateTransactionField(id: string, field: string, value: unknown) {
    const { error } = await this.supabase.from('transactions').update({ [field]: value }).eq('id', id)
    if (error) throw error
  }

  async deleteTransaction(id: string) {
    const { error } = await this.supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
  }

  async getTransaction(id: string): Promise<TransactionRow | null> {
    const { data } = await this.supabase.from('transactions').select('*, accounts!transactions_account_id_fkey(name)').eq('id', id).single()
    return data as TransactionRow | null
  }

  formatConfirmation(parsed: ParsedTransaction, transactionId: string): string {
    const parts: string[] = []
    parts.push(`✅ <b>${escapeHtml(parsed.description)}</b>`)

    if (parsed.installments > 0) {
      const perCuota = Math.round((parsed.amount / parsed.installments) * 100) / 100
      parts.push(`${formatAmount(perCuota, parsed.currency)} (${parsed.installments} cuotas — ${formatAmount(parsed.amount, parsed.currency)} total)`)
    } else {
      parts.push(`${formatAmount(parsed.amount, parsed.currency)} ${parsed.currency}`)
    }

    if (parsed.accountName) parts.push(`[${escapeHtml(parsed.accountName)}]`)
    if (parsed.categoryName) parts.push(`#${escapeHtml(parsed.categoryName)}`)
    if (parsed.subscriptionFrequency) {
      const freqLabel: Record<string, string> = { monthly: 'Mensual', quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual' }
      parts.push(`🔁 ${freqLabel[parsed.subscriptionFrequency] || parsed.subscriptionFrequency}`)
    }
    if (parsed.householdId && parsed.isSharing) parts.push('🏠 Compartido')
    else if (parsed.householdId) parts.push('🏠 Hogar')
    return parts.join(' · ')
  }

  confirmationKeyboard(transactionId: string) {
    return [
      [{ text: '🏷️ Categoría', callback_data: `cat|${transactionId}` }, { text: '🏦 Cuenta', callback_data: `acct|${transactionId}` }],
      [{ text: '🗑️ Deshacer', callback_data: `undo|${transactionId}` }],
    ]
  }
}

export { formatAmount } from './parser'
