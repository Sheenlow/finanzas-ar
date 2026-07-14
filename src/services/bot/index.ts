import OpenAI from 'openai'
import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { householdSplitService } from '@/services/householdSplitService'
import { getBillingMonthFromRules, getBillingMonthFromCycle, escapeHtml } from '@/lib/utils'
import type {
  Account, Category, ParsedTransaction,
  TransactionRow, FlowState,
} from './types'
import {
  normalizeAmount, getArgentinaISOString, extractKeywords,
  detectPaymentMethod, isCardPayment, parseText, formatAmount,
} from './parser'
import { parseWithAI } from './ai'
import { validateParsedTransaction } from './validator'
import { getKeywordRules, getCustomPrompt, saveKeywordRule } from './keywords'
import { computeNext, renderState } from './stateMachine'
import { isCommand, handleCommand } from './commands'
import { MSG_NO_ACCOUNTS, MSG_CANT_PARSE } from './messages'

export class BotProcessor {
  private openai: OpenAI
  private supabase: SupabaseClient
  private userId: string

  constructor(userId: string) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.supabase = createAdminClient()
    this.userId = userId
  }

  // ──── DB helpers ────────────────────────────────────

  private async getAccounts(): Promise<Account[]> {
    const { data } = await this.supabase.from('accounts').select('id, name, currency, type').eq('user_id', this.userId)
    return (data || []) as Account[]
  }

  private async getCategories(): Promise<Category[]> {
    const { data } = await this.supabase.from('categories').select('id, name').eq('type', 'expense').order('name')
    return (data || []) as Category[]
  }

  private async getSmartDefaults(): Promise<{ accountId: string | null; accountName: string | null; paymentMethod: string }> {
    const { data } = await this.supabase.from('transactions')
      .select('account_id, payment_method, accounts!transactions_account_id_fkey(name)').eq('user_id', this.userId)
      .order('created_at', { ascending: false }).limit(10)
    if (!data || data.length === 0) return { accountId: null, accountName: null, paymentMethod: 'cash' }
    const accounts = data.map((t: any) => t.account_id)
    const topAccount = accounts.sort((a: any, b: any) => accounts.filter((x: any) => x === b).length - accounts.filter((x: any) => x === a).length)[0]
    const methods = data.map((t: any) => t.payment_method)
    const topMethod = methods.sort((a: any, b: any) => methods.filter((x: any) => x === b).length - methods.filter((x: any) => x === a).length)[0] || 'cash'
    const accRow = data.find((t: any) => t.account_id === topAccount)
    return { accountId: topAccount, accountName: (accRow as any)?.accounts?.name || null, paymentMethod: topMethod }
  }

  private async getUserHousehold(): Promise<string | null> {
    const { data } = await this.supabase.from('household_members')
      .select('household_id')
      .eq('user_id', this.userId)
      .maybeSingle()
    return data?.household_id || null
  }

  // ──── Pending state ─────────────────────────────────

  private async getPending(): Promise<{ state: FlowState; pending: ParsedTransaction } | null> {
    const { data } = await this.supabase.from('bot_pending').select('state, pending').eq('user_id', this.userId).maybeSingle()
    return data ? { state: data.state as FlowState, pending: data.pending as ParsedTransaction } : null
  }

  private async setPending(state: FlowState, pending: ParsedTransaction) {
    await this.supabase.from('bot_pending').upsert({ user_id: this.userId, state, pending: pending as any, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  }

  private async clearPending() {
    await this.supabase.from('bot_pending').delete().eq('user_id', this.userId)
  }

  // ──── Commands ──────────────────────────────────────

  async handleCommand(text: string, telegramUserId?: number): Promise<string> {
    return handleCommand(text, this.supabase, this.userId, telegramUserId)
  }

  // ──── Transaction CRUD ──────────────────────────────

  private async createTransaction(parsed: ParsedTransaction): Promise<string> {
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

    const freq = parsed.subscriptionFrequency || (parsed.type === 'subscription' ? 'monthly' : null)

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
      subscription_frequency: freq as any,
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
        const incomeMap = new Map((incomes || []).map((i: any) => [i.user_id, i.monthly_income_ars]))

        await householdSplitService.splitHouseholdExpense(
          this.supabase, data.id, parsed.householdId, this.userId,
          installmentAmount, parsed.currency as any, (members || []) as any, incomeMap
        )
      } catch {}
    }

    return data.id
  }

  private async updateTransactionField(id: string, field: string, value: any) {
    const { error } = await this.supabase.from('transactions').update({ [field]: value }).eq('id', id)
    if (error) throw error
  }

  private async deleteTransaction(id: string) {
    const { error } = await this.supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
  }

  private async getTransaction(id: string): Promise<TransactionRow | null> {
    const { data } = await this.supabase.from('transactions').select('*, accounts!transactions_account_id_fkey(name)').eq('id', id).single()
    return data as TransactionRow | null
  }

  // ──── Confirmation formatting ───────────────────────

  private formatConfirmation(parsed: ParsedTransaction, transactionId: string): string {
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

  private confirmationKeyboard(transactionId: string) {
    return [
      [{ text: '🏷️ Categoría', callback_data: `cat|${transactionId}` }, { text: '🏦 Cuenta', callback_data: `acct|${transactionId}` }],
      [{ text: '🗑️ Deshacer', callback_data: `undo|${transactionId}` }],
    ]
  }

  // ──── OLD callback handler (post-confirmation editing) ──

  private async handleOldCallback(action: string, transactionId: string, rest: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    if (action === 'undo') { await this.deleteTransaction(transactionId); return { text: '🗑️ Gasto eliminado.', keyboard: [] } }

    if (action === 'cat') {
      const categories = await this.getCategories()
      const buttons: { text: string; callback_data: string }[][] = []
      for (let i = 0; i < categories.length; i += 2) {
        buttons.push(categories.slice(i, i + 2).map(c => ({ text: c.name, callback_data: `setcat|${transactionId}|${c.name}` })))
      }
      buttons.push([{ text: 'Cancelar', callback_data: `cancel|${transactionId}` }])
      return { text: '🏷️ Elegí la categoría:', keyboard: buttons }
    }

    if (action === 'acct') {
      const accounts = await this.getAccounts()
      const buttons = accounts.map(a => ([{ text: `${a.name} (${a.currency})`, callback_data: `setacct|${transactionId}|${a.id}` }]))
      buttons.push([{ text: 'Cancelar', callback_data: `cancel|${transactionId}` }])
      return { text: '🏦 Elegí la cuenta:', keyboard: buttons }
    }

    if (action === 'setcat') {
      const categoryName = decodeURIComponent(rest)
      const cats = await this.getCategories()
      const cat = cats.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
      if (!cat) return { text: `❓ Categoría "${escapeHtml(categoryName)}" no encontrada.`, keyboard: this.confirmationKeyboard(transactionId) }
      await this.updateTransactionField(transactionId, 'category_id', cat.id)
      const txn = await this.getTransaction(transactionId)
      if (txn) for (const w of extractKeywords(txn.description || '')) await saveKeywordRule(this.supabase, this.userId, w, 'category_name', categoryName)
      return { text: `✅ Categoría actualizada → ${escapeHtml(categoryName)}`, keyboard: this.confirmationKeyboard(transactionId) }
    }

    if (action === 'setacct') {
      const accountId = rest
      await this.updateTransactionField(transactionId, 'account_id', accountId)
      const accs = await this.getAccounts(); const acc = accs.find(a => a.id === accountId)
      const txn = await this.getTransaction(transactionId)
      if (txn && acc) for (const w of extractKeywords(txn.description || '')) await saveKeywordRule(this.supabase, this.userId, w, 'account_name', acc.name)
      return { text: `✅ Cuenta actualizada → ${escapeHtml(acc?.name || accountId)}`, keyboard: this.confirmationKeyboard(transactionId) }
    }

    if (action === 'cancel') return { text: 'Operación cancelada.', keyboard: this.confirmationKeyboard(transactionId) }
    return { text: '❓ Acción desconocida.' }
  }

  // ──── MAIN callback router ──────────────────────────

  async handleCallback(data: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    if (!data.startsWith('new:')) {
      const parts = data.split('|')
      const action = parts[0]; const transactionId = parts[1]
      if (action === 'setcat') return this.handleOldCallback(action, transactionId, parts.slice(2).join('|'))
      return this.handleOldCallback(action, transactionId, parts[2] || '')
    }

    const payload = data.slice(4)
    const [action, ...rest] = payload.split(':')
    const value = rest.join(':')

    const prev = await this.getPending()
    if (!prev) return { text: '❓ No hay una operación pendiente. Empezá de nuevo con un gasto.' }

    const pending = { ...prev.pending }
    let nextState: FlowState = prev.state

    switch (action) {
      case 'cuotas':
        if (value === 'si') nextState = 'ask_cuotas_count'
        else { pending.installments = 0; nextState = computeNext(pending) }
        break
      case 'cuotas_n':
        pending.installments = parseInt(value) || 0
        nextState = computeNext(pending)
        break
      case 'subscription':
        if (value === 'si') nextState = 'ask_frequency'
        else { pending.type = 'expense'; pending.subscriptionFrequency = null; nextState = computeNext(pending) }
        break
      case 'frequency':
        pending.subscriptionFrequency = value
        nextState = computeNext(pending)
        break
      case 'acct':
        pending.accountId = value
        const accs = await this.getAccounts(); const acc = accs.find(a => a.id === value)
        pending.accountName = acc?.name || null
        if (!pending.paymentMethod || pending.paymentMethod === 'cash') {
          if (acc && acc.type === 'bank') pending.paymentMethod = 'card'
        }
        nextState = computeNext(pending)
        break
      case 'cat':
        pending.categoryName = decodeURIComponent(value)
        nextState = computeNext(pending)
        break
      case 'household_show':
        if (value === 'si') nextState = 'ask_household_share'
        else { pending.householdId = null; pending.isSharing = false; nextState = 'confirm' }
        break
      case 'household_share':
        pending.isSharing = value === 'si'
        nextState = 'confirm'
        break
      case 'edit':
        if (value === 'cat') nextState = 'select_category'
        else if (value === 'acct') nextState = 'select_account'
        else if (value === 'cuotas') nextState = 'ask_cuotas'
        else if (value === 'household_show') nextState = 'ask_household_show'
        else if (value === 'household_share') nextState = 'ask_household_share'
        else if (value === 'back') nextState = 'confirm'
        else nextState = 'confirm'
        break
      case 'confirm':
        if (value === 'yes') {
          await this.clearPending()
          const txnId = await this.createTransaction(pending)
          const words = extractKeywords(pending.description)
          if (pending.categoryName) for (const w of words) await saveKeywordRule(this.supabase, this.userId, w, 'category_name', pending.categoryName)
          if (pending.accountName) for (const w of words) await saveKeywordRule(this.supabase, this.userId, w, 'account_name', pending.accountName)
          return { text: this.formatConfirmation(pending, txnId), keyboard: this.confirmationKeyboard(txnId) }
        }
        nextState = 'edit'
        break
      case 'cancel':
        await this.clearPending()
        return { text: 'Operación cancelada.' }
      default:
        return { text: '❓ Acción desconocida.' }
    }

    await this.setPending(nextState, pending)
    return renderState(nextState, pending, {
      getAccounts: () => this.getAccounts(),
      getCategories: () => this.getCategories(),
    })
  }

  // ──── Main entry: process text ──────────────────────

  async processText(text: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    if (isCommand(text)) return { text: await this.handleCommand(text) }

    await this.clearPending()

    const accounts = await this.getAccounts()
    if (accounts.length === 0) return { text: MSG_NO_ACCOUNTS }

    const categories = await this.getCategories()
    const keywordRules = await getKeywordRules(this.supabase, this.userId)
    const defaults = await this.getSmartDefaults()

    let parsed = parseText(text, accounts, categories, keywordRules)
    if (!parsed || parsed.amount === 0) {
      const customPrompt = await getCustomPrompt(this.supabase, this.userId)
      parsed = await parseWithAI(text, this.openai, accounts, categories, keywordRules, customPrompt, this.userId)
    }

    if (!parsed || parsed.amount === 0) {
      return { text: MSG_CANT_PARSE }
    }

    if (parsed.accountName && !parsed.accountId) {
      const found = accounts.find(a => a.name.toLowerCase() === parsed.accountName!.toLowerCase())
      if (found) parsed.accountId = found.id
    }

    const hasAccount = !!parsed.accountId
    const hasCategory = !!parsed.categoryName
    const needsCuotasQuestion = isCardPayment(text) && parsed.installments === 0
    const isSubscription = parsed.type === 'subscription'
    const householdId = await this.getUserHousehold()

    if (!parsed.paymentMethod || parsed.paymentMethod === 'cash') {
      if (parsed.accountId) {
        const acc = accounts.find(a => a.id === parsed.accountId)
        if (acc && acc.type === 'bank') parsed.paymentMethod = 'card'
      }
    }
    if (!parsed.paymentMethod) parsed.paymentMethod = defaults.paymentMethod

    parsed.householdId = householdId

    let firstState: FlowState
    if (needsCuotasQuestion) {
      firstState = 'ask_cuotas'
    } else if (isSubscription) {
      firstState = 'ask_subscription'
    } else if (!hasAccount) {
      firstState = 'select_account'
    } else if (!hasCategory) {
      firstState = 'select_category'
    } else if (householdId) {
      firstState = 'ask_household_show'
    } else {
      firstState = 'confirm'
    }

    await this.setPending(firstState, parsed)
    return renderState(firstState, parsed, {
      getAccounts: () => this.getAccounts(),
      getCategories: () => this.getCategories(),
    })
  }
}
