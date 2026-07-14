import OpenAI from 'openai'
import { SupabaseClient } from '@supabase/supabase-js'
import { TransactionHandler } from './transactionHandler'
import type { Account, Category, ParsedTransaction, FlowState } from './types'
import { detectPaymentMethod, isCardPayment, parseText, extractKeywords } from './parser'
import { parseWithAI } from './ai'
import { getKeywordRules, getCustomPrompt, saveKeywordRule } from './keywords'
import { computeNext, renderState } from './stateMachine'
import { isCommand, handleCommand } from './commands'
import { MSG_NO_ACCOUNTS, MSG_CANT_PARSE } from './messages'

export class ConversationFlow {
  private tx: TransactionHandler

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    private openai: OpenAI,
  ) {
    this.tx = new TransactionHandler(supabase, userId)
  }

  async handleCommand(text: string, telegramUserId?: number): Promise<string> {
    return handleCommand(text, this.supabase, this.userId, telegramUserId)
  }

  private async getPending(): Promise<{ state: FlowState; pending: ParsedTransaction } | null> {
    const { data } = await this.supabase.from('bot_pending').select('state, pending').eq('user_id', this.userId).maybeSingle()
    return data ? { state: data.state as FlowState, pending: data.pending as ParsedTransaction } : null
  }

  private async setPending(state: FlowState, pending: ParsedTransaction) {
    await this.supabase.from('bot_pending').upsert({ user_id: this.userId, state, pending: pending as unknown as Record<string, unknown>, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  }

  private async clearPending() {
    await this.supabase.from('bot_pending').delete().eq('user_id', this.userId)
  }

  private async handleOldCallback(action: string, transactionId: string, rest: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    if (action === 'undo') { await this.tx.deleteTransaction(transactionId); return { text: '🗑️ Gasto eliminado.', keyboard: [] } }

    if (action === 'cat') {
      const categories = await this.tx.getCategories()
      const buttons: { text: string; callback_data: string }[][] = []
      for (let i = 0; i < categories.length; i += 2) {
        buttons.push(categories.slice(i, i + 2).map(c => ({ text: c.name, callback_data: `setcat|${transactionId}|${c.name}` })))
      }
      buttons.push([{ text: 'Cancelar', callback_data: `cancel|${transactionId}` }])
      return { text: '🏷️ Elegí la categoría:', keyboard: buttons }
    }

    if (action === 'acct') {
      const accounts = await this.tx.getAccounts()
      const buttons = accounts.map(a => ([{ text: `${a.name} (${a.currency})`, callback_data: `setacct|${transactionId}|${a.id}` }]))
      buttons.push([{ text: 'Cancelar', callback_data: `cancel|${transactionId}` }])
      return { text: '🏦 Elegí la cuenta:', keyboard: buttons }
    }

    if (action === 'setcat') {
      const categoryName = decodeURIComponent(rest)
      const cats = await this.tx.getCategories()
      const cat = cats.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
      if (!cat) return { text: `❓ Categoría no encontrada.`, keyboard: this.tx.confirmationKeyboard(transactionId) }
      await this.tx.updateTransactionField(transactionId, 'category_id', cat.id)
      const txn = await this.tx.getTransaction(transactionId)
      if (txn) for (const w of extractKeywords(txn.description || '')) await saveKeywordRule(this.supabase, this.userId, w, 'category_name', categoryName)
      return { text: `✅ Categoría actualizada → ${categoryName}`, keyboard: this.tx.confirmationKeyboard(transactionId) }
    }

    if (action === 'setacct') {
      const accountId = rest
      await this.tx.updateTransactionField(transactionId, 'account_id', accountId)
      const accs = await this.tx.getAccounts(); const acc = accs.find(a => a.id === accountId)
      const txn = await this.tx.getTransaction(transactionId)
      if (txn && acc) for (const w of extractKeywords(txn.description || '')) await saveKeywordRule(this.supabase, this.userId, w, 'account_name', acc.name)
      return { text: `✅ Cuenta actualizada → ${acc?.name || accountId}`, keyboard: this.tx.confirmationKeyboard(transactionId) }
    }

    if (action === 'cancel') return { text: 'Operación cancelada.', keyboard: this.tx.confirmationKeyboard(transactionId) }
    return { text: '❓ Acción desconocida.' }
  }

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
        const accs = await this.tx.getAccounts(); const acc = accs.find(a => a.id === value)
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
          const txnId = await this.tx.createTransaction(pending)
          const words = extractKeywords(pending.description)
          if (pending.categoryName) for (const w of words) await saveKeywordRule(this.supabase, this.userId, w, 'category_name', pending.categoryName)
          if (pending.accountName) for (const w of words) await saveKeywordRule(this.supabase, this.userId, w, 'account_name', pending.accountName)
          return { text: this.tx.formatConfirmation(pending, txnId), keyboard: this.tx.confirmationKeyboard(txnId) }
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
      getAccounts: () => this.tx.getAccounts(),
      getCategories: () => this.tx.getCategories(),
    })
  }

  async processText(text: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    if (isCommand(text)) return { text: await this.handleCommand(text) }

    await this.clearPending()

    const accounts = await this.tx.getAccounts()
    if (accounts.length === 0) return { text: MSG_NO_ACCOUNTS }

    const categories = await this.tx.getCategories()
    const keywordRules = await getKeywordRules(this.supabase, this.userId)
    const defaults = await this.tx.getSmartDefaults()

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
    const householdId = await this.tx.getUserHousehold()

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
      getAccounts: () => this.tx.getAccounts(),
      getCategories: () => this.tx.getCategories(),
    })
  }
}
