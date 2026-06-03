import OpenAI from 'openai'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface Account {
  id: string
  name: string
  currency: string
  type: string
}

interface Category {
  id: string
  name: string
}

interface KeywordRule {
  keyword: string
  field: 'category_name' | 'account_name' | 'type'
  value: string
}

interface ParsedTransaction {
  description: string
  amount: number
  currency: string
  type: string
  accountId: string | null
  accountName: string | null
  paymentMethod: string
  installments: number
  categoryName: string | null
  confidence: 'rules' | 'keywords' | 'ai'
}

interface TransactionRow {
  id: string
  description: string
  amount: number
  currency: string
  type: string
  account_id: string
  is_installment: boolean
  installments_total: number
  installment_number: number
  accounts?: { name: string } | null
}

function normalizeAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
}

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3)
  return [...new Set(words)]
}

const PAYMENT_KEYWORDS: Record<string, string> = {
  efectivo: 'cash',
  cash: 'cash',
  débito: 'card',
  debito: 'card',
  crédito: 'card',
  credito: 'card',
  transferencia: 'transfer',
  transfer: 'transfer',
}

function detectPaymentMethod(text: string): string | null {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [kw, method] of Object.entries(PAYMENT_KEYWORDS)) {
    if (lower.includes(kw)) return method
  }
  return null
}

function parseWithRules(
  text: string,
  accounts: Account[],
  categories: Category[],
  keywordRules: KeywordRule[]
): ParsedTransaction | null {
  let remaining = text.trim()

  if (!remaining) return null

  // Apply keyword rules for type
  let type = 'expense'
  const typeKeywords = keywordRules.filter(r => r.field === 'type')
  for (const rule of typeKeywords) {
    if (remaining.toLowerCase().includes(rule.keyword.toLowerCase())) {
      type = rule.value
      break
    }
  }

  // Detect explicit type keywords in text
  if (remaining.match(/\b(suscripci[oó]n|subscription)\b/i)) {
    type = 'subscription'
    remaining = remaining.replace(/\b(suscripci[oó]n|subscription)\b/i, '').trim()
  } else if (remaining.match(/\b(servicio|service)\b/i)) {
    type = 'service'
    remaining = remaining.replace(/\b(servicio|service)\b/i, '').trim()
  }

  // Detect currency
  let currency = 'ARS'
  const currencyMatch = remaining.match(/\b(USD|usd|d[oó]lar(es)?|dolar(es)?|U\$S|usdt|USDC|usdc|BTC|btc|ETH|eth)\b/i)
  if (currencyMatch) {
    const curr = currencyMatch[1].toUpperCase()
    if (['USD', 'USDT', 'USDC'].includes(curr) || curr.startsWith('D') || curr.startsWith('U$')) {
      currency = 'USD'
    } else if (curr === 'BTC') currency = 'BTC'
    else if (curr === 'ETH') currency = 'ETH'
    remaining = remaining.replace(currencyMatch[0], '').trim()
  }

  // Detect "en [cuenta]" pattern
  let accountId: string | null = null
  let accountName: string | null = null
  const enMatch = remaining.match(/\ben\s+([a-záéíóúA-ZÁÉÍÓÚ\s]+?)(?:\s|$)/i)
  if (enMatch) {
    const candidate = enMatch[1].trim()
    const sorted = [...accounts].sort((a, b) => b.name.length - a.name.length)
    for (const acc of sorted) {
      if (candidate.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .includes(acc.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
        accountId = acc.id
        accountName = acc.name
        remaining = remaining.replace(enMatch[0], '').trim()
        break
      }
    }
  }

  // Apply keyword rules for account (after explicit detection)
  if (!accountId) {
    const accountRules = keywordRules.filter(r => r.field === 'account_name')
    for (const rule of accountRules) {
      if (remaining.toLowerCase().includes(rule.keyword.toLowerCase())) {
        const acc = accounts.find(a => a.name.toLowerCase() === rule.value.toLowerCase())
        if (acc) {
          accountId = acc.id
          accountName = acc.name
          break
        }
      }
    }
  }

  // Detect account by name match (without "en" prefix, as fallback)
  if (!accountId) {
    const sorted = [...accounts].sort((a, b) => b.name.length - a.name.length)
    for (const acc of sorted) {
      const escaped = acc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escaped}\\b`, 'i')
      if (remaining.match(regex)) {
        accountId = acc.id
        accountName = acc.name
        remaining = remaining.replace(regex, '').trim()
        break
      }
    }
  }

  // Detect payment method
  let paymentMethod = 'cash'
  const detectedPayment = detectPaymentMethod(remaining)
  if (detectedPayment) {
    paymentMethod = detectedPayment
    const lower = remaining.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    for (const [kw] of Object.entries(PAYMENT_KEYWORDS)) {
      if (lower.includes(kw)) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i')
        remaining = remaining.replace(regex, '').trim()
        break
      }
    }
    // Remove "con" prefix if present
    remaining = remaining.replace(/^con\s+/i, '').trim()
  }

  // Detect installments
  let installments = 0
  const cuotasMatch = remaining.match(/cuotas?\s*(\d+)/i) || remaining.match(/(\d+)\s*cuotas?/i)
  if (cuotasMatch) {
    installments = parseInt(cuotasMatch[1])
    remaining = remaining.replace(cuotasMatch[0], '').trim()
  }

  // Detect amount (last number)
  const numberMatches = [...remaining.matchAll(/(\d+[.,]?\d*)/g)]
  if (numberMatches.length === 0) return null

  const lastNumber = numberMatches[numberMatches.length - 1]
  const amount = normalizeAmount(lastNumber[1])
  const beforeAmount = remaining.slice(0, lastNumber.index).trim()
  const afterAmount = remaining.slice(lastNumber.index! + lastNumber[0].length).trim()
  remaining = [beforeAmount, afterAmount].filter(Boolean).join(' ').trim()

  // Apply keyword rules for category
  let categoryName: string | null = null
  const catRules = keywordRules.filter(r => r.field === 'category_name')
  const allWords = extractKeywords(text)
  for (const word of allWords) {
    const match = catRules.find(r => r.keyword.toLowerCase() === word)
    if (match) {
      categoryName = match.value
      break
    }
  }

  const description = remaining || text.split(/\d/)[0]?.trim() || 'Gasto sin descripción'

  return {
    description: description.length > 100 ? description.slice(0, 100) : description,
    amount,
    currency,
    type,
    accountId,
    accountName,
    paymentMethod,
    installments,
    categoryName,
    confidence: 'rules',
  }
}

async function parseWithAI(
  text: string,
  openai: OpenAI,
  accounts: Account[],
  categories: Category[],
  keywordRules: KeywordRule[],
  customPrompt?: string
): Promise<ParsedTransaction> {
  const accountList = accounts.map(a => `"${a.name}" (${a.currency})`).join(', ')
  const categoryList = categories.map(c => `"${c.name}"`).join(', ')
  const rulesDesc = keywordRules.length > 0
    ? '\n\nReglas aprendidas:\n' + keywordRules.map(r => `  "${r.keyword}" → ${r.field} = "${r.value}"`).join('\n')
    : ''

  const extraPrompt = customPrompt ? `\n\nInstrucciones adicionales del usuario:\n${customPrompt}` : ''

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Eres un asistente que extrae información de gastos de mensajes en español. Devuelve SOLO un JSON con:
{
  "description": "string breve (máximo 100 caracteres)",
  "amount": number,
  "currency": "ARS" | "USD" | "USDT" | "USDC" | "BTC" | "ETH",
  "type": "expense" | "subscription" | "service",
  "accountName": "string o null",
  "paymentMethod": "cash" | "card" | "transfer",
  "installments": number (0 si no aplica),
  "categoryName": "string o null"
}

Cuentas disponibles: ${accountList}
Categorías disponibles: ${categoryList}${rulesDesc}

Reglas:
- La moneda por defecto es ARS.
- Si dice "cuotas N" o "N cuotas", installments = N; sino 0.
- Si dice "suscripción" o "subscription", type = "subscription".
- Si dice "servicio" o "service", type = "service".
- paymentMethod: "efectivo" o "cash" → cash, "débito" o "debito" → card, "crédito" o "credito" → card, "transferencia" o "transfer" → transfer.
- Si no se especifica método de pago, inferilo: si la cuenta es "Efectivo" → cash, si es banco → card.
- accountName debe coincidir exactamente con una de la lista. Si no coincide con ninguna, usá null.
- categoryName debe coincidir exactamente con una de la lista. Si no estás seguro, usá null.
- El monto es el último número del texto.${extraPrompt}`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
    max_tokens: 300,
  })

  const raw = response.choices[0]?.message?.content || '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}')

  return {
    description: parsed.description || text.slice(0, 100),
    amount: parsed.amount || 0,
    currency: parsed.currency || 'ARS',
    type: parsed.type || 'expense',
    accountId: null,
    accountName: parsed.accountName || null,
    paymentMethod: parsed.paymentMethod || 'cash',
    installments: parsed.installments || 0,
    categoryName: parsed.categoryName || null,
    confidence: 'ai',
  }
}

function formatAmount(amount: number, currency: string): string {
  const opts: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'ARS',
    minimumFractionDigits: 2,
  }
  return new Intl.NumberFormat('es-AR', opts).format(amount)
}

export class BotProcessor {
  private openai: OpenAI
  private supabase: SupabaseClient
  private userId: string

  constructor(userId: string) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    this.userId = userId
  }

  // ── Data helpers ──────────────────────────────────────

  private async getAccounts(): Promise<Account[]> {
    const { data } = await this.supabase
      .from('accounts')
      .select('id, name, currency, type')
      .eq('user_id', this.userId)
    return (data || []) as Account[]
  }

  private async getCategories(): Promise<Category[]> {
    const { data } = await this.supabase
      .from('categories')
      .select('id, name')
      .order('name')
    return (data || []) as Category[]
  }

  private async getKeywordRules(): Promise<KeywordRule[]> {
    const { data } = await this.supabase
      .from('bot_rules')
      .select('keyword, field, value')
      .eq('user_id', this.userId)
    return (data || []) as KeywordRule[]
  }

  private async getCustomPrompt(): Promise<string | undefined> {
    const { data } = await this.supabase
      .from('bot_config')
      .select('custom_prompt')
      .eq('user_id', this.userId)
      .maybeSingle()
    return data?.custom_prompt || undefined
  }

  private async getSmartDefaults(): Promise<{ accountId: string | null; accountName: string | null; paymentMethod: string }> {
    const { data } = await this.supabase
      .from('transactions')
      .select('account_id, payment_method, accounts!transactions_account_id_fkey(name)')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!data || data.length === 0) return { accountId: null, accountName: null, paymentMethod: 'cash' }

    const accounts = data.map((t: any) => t.account_id)
    const methods = data.map((t: any) => t.payment_method)

    const topAccount = accounts.sort((a, b) =>
      accounts.filter(x => x === b).length - accounts.filter(x => x === a).length
    )[0]

    const topMethod = methods.sort((a, b) =>
      methods.filter(x => x === b).length - methods.filter(x => x === a).length
    )[0] || 'cash'

    const accRow = data.find((t: any) => t.account_id === topAccount)
    const accName = (accRow as any)?.accounts?.name || null

    return { accountId: topAccount, accountName: accName, paymentMethod: topMethod }
  }

  private async saveKeywordRule(keyword: string, field: 'category_name' | 'account_name' | 'type', value: string) {
    await this.supabase
      .from('bot_rules')
      .upsert({ user_id: this.userId, keyword: keyword.toLowerCase(), field, value }, { onConflict: 'user_id,keyword,field' })
  }

  // ── Command handlers ──────────────────────────────────

  private isCommand(text: string): boolean {
    return /^\/(start|help|stats|list|balance|config)\b/.test(text.trim())
  }

  async handleCommand(text: string): Promise<string> {
    const cmd = text.trim().split(/\s+/)[0].toLowerCase()

    switch (cmd) {
      case '/start':
      case '/help':
        return `<b>🤖 Cómo usarme</b>

<b>Gastos (texto):</b>
  [qué] [monto] [en cuenta?] [con pago?] [cuotas?]

<b>Ejemplos:</b>
  • Supermercado 8000 en Efectivo
  • Netflix 12 USD débito suscripción
  • Nafta 5000 crédito 3 cuotas

<b>Palabras clave:</b>
  <i>Cuentas:</i> en [nombre]
  <i>Pago:</i> efectivo, débito, crédito, transferencia
  <i>Cuotas:</i> cuotas 3, 3 cuotas

También podés mandar audios 🎤

<b>Comandos:</b>
  /stats — resumen del mes
  /list — últimos gastos
  /balance — saldo de cuentas
  /config — personalizar IA`

      case '/stats':
        return await this.getStatsMessage()

      case '/list':
        return await this.getListMessage()

      case '/balance':
        return await this.getBalancesMessage()

      case '/config': {
        const rest = text.slice('/config'.length).trim()
        if (rest) {
          await this.supabase
            .from('bot_config')
            .upsert({ user_id: this.userId, custom_prompt: rest, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          return '✅ Prompt personalizado actualizado:\n\n<i>' + rest + '</i>'
        }
        const prompt = await this.getCustomPrompt()
        return prompt
          ? '📝 <b>Prompt personalizado actual:</b>\n\n' + prompt + '\n\nPara cambiarlo, mandá /config seguido del nuevo texto.'
          : '📝 No tenés un prompt personalizado.\n\nMandá /config seguido de tus instrucciones. Ejemplo:\n/config Mis cuentas son Galicia, MP y Efectivo. Si no digo cuenta, usá Galicia.'
      }

      default:
        return ''
    }
  }

  private async getStatsMessage(): Promise<string> {
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const { data } = await this.supabase
      .from('transactions')
      .select('amount, currency, type')
      .eq('user_id', this.userId)
      .like('transaction_date', `${monthPrefix}%`)

    let totalArs = 0
    let totalUsd = 0
    const expenseTypes = (data || []).filter(t => t.type !== 'income')

    expenseTypes.forEach(t => {
      if (t.currency === 'ARS') totalArs += t.amount
      else totalUsd += t.amount
    })

    const monthName = now.toLocaleString('es-AR', { month: 'long' })
    return `<b>📊 Gastos de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${now.getFullYear()}</b>

• Total ARS: ${formatAmount(totalArs, 'ARS')}
• Total USD: ${formatAmount(totalUsd, 'USD')}
• Transacciones: ${expenseTypes.length}`
  }

  private async getListMessage(): Promise<string> {
    const { data } = await this.supabase
      .from('transactions')
      .select('id, description, amount, currency, type, is_installment, installments_total, installment_number')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!data || data.length === 0) return '📋 No tenés gastos registrados todavía.'

    const lines = data.map((t: any, i: number) => {
      const instLabel = t.is_installment ? ` (${t.installment_number}/${t.installments_total})` : ''
      const typeIcon = t.type === 'income' ? '💰' : t.type === 'subscription' ? '🔁' : t.type === 'service' ? '⚡' : '💸'
      return `${i + 1}. ${typeIcon} ${t.description}: ${formatAmount(t.amount, t.currency)}${instLabel}`
    })

    return `<b>📋 Últimos movimientos</b>\n\n${lines.join('\n')}`
  }

  private async getBalancesMessage(): Promise<string> {
    const { data } = await this.supabase
      .from('accounts')
      .select('name, balance, currency')
      .eq('user_id', this.userId)
      .order('name')

    if (!data || data.length === 0) return '💰 No tenés cuentas registradas.'

    const lines = data.map((a: any) => `• ${a.name}: ${formatAmount(a.balance, a.currency)}`)
    return `<b>💰 Saldos</b>\n\n${lines.join('\n')}`
  }

  // ── Transaction CRUD ──────────────────────────────────

  private async createTransaction(parsed: ParsedTransaction): Promise<string> {
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T12:00:00Z`

    let categoryId: string | null = null
    if (parsed.categoryName) {
      const cats = await this.getCategories()
      const cat = cats.find(c => c.name.toLowerCase() === parsed.categoryName!.toLowerCase())
      if (cat) categoryId = cat.id
    }

    const { data, error } = await this.supabase
      .from('transactions')
      .insert([{
        user_id: this.userId,
        account_id: parsed.accountId,
        category_id: categoryId,
        amount: parsed.amount,
        currency: parsed.currency,
        type: parsed.type,
        description: parsed.description,
        transaction_date: dateStr,
        payment_method: parsed.paymentMethod,
        is_installment: parsed.installments > 0,
        installments_total: parsed.installments || 1,
        installment_number: 1,
        subscription_frequency: parsed.type === 'subscription' ? 'monthly' : null,
      }])
      .select('id')
      .single()

    if (error) {
      console.error('Error creating transaction:', error)
      throw new Error('Error al guardar el gasto')
    }

    return data.id
  }

  private async updateTransactionField(id: string, field: string, value: any) {
    const { error } = await this.supabase
      .from('transactions')
      .update({ [field]: value })
      .eq('id', id)
    if (error) throw error
  }

  private async deleteTransaction(id: string) {
    const { error } = await this.supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
  }

  private async getTransaction(id: string): Promise<TransactionRow | null> {
    const { data } = await this.supabase
      .from('transactions')
      .select('*, accounts!transactions_account_id_fkey(name)')
      .eq('id', id)
      .single()
    return data as TransactionRow | null
  }

  // ── Confirmation message formatter ────────────────────

  private formatConfirmation(parsed: ParsedTransaction, transactionId: string): string {
    const parts: string[] = []
    parts.push(`✅ <b>${parsed.description}</b>`)
    parts.push(`${formatAmount(parsed.amount, parsed.currency)} ${parsed.currency}`)

    if (parsed.installments > 0) parts.push(`${parsed.installments} cuotas`)
    if (parsed.accountName) parts.push(`[${parsed.accountName}]`)
    if (parsed.categoryName) parts.push(`#${parsed.categoryName}`)

    return parts.join(' · ')
  }

  private confirmationKeyboard(transactionId: string) {
    return [
      [
        { text: '🏷️ Categoría', callback_data: `cat|${transactionId}` },
        { text: '🏦 Cuenta', callback_data: `acct|${transactionId}` },
      ],
      [
        { text: '🗑️ Deshacer', callback_data: `undo|${transactionId}` },
      ],
    ]
  }

  // ── Callback handler ──────────────────────────────────

  async handleCallback(callbackData: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    const parts = callbackData.split('|')
    const action = parts[0]
    const transactionId = parts[1]

    if (action === 'undo') {
      await this.deleteTransaction(transactionId)
      return { text: '🗑️ Gasto eliminado.', keyboard: [] }
    }

    if (action === 'cat') {
      const categories = await this.getCategories()
      const chunkSize = 3
      const buttons: { text: string; callback_data: string }[][] = []
      for (let i = 0; i < categories.length; i += chunkSize) {
        buttons.push(categories.slice(i, i + chunkSize).map(c => ({
          text: c.name,
          callback_data: `setcat|${transactionId}|${c.name}`,
        })))
      }
      buttons.push([{ text: 'Cancelar', callback_data: `cancel|${transactionId}` }])
      return { text: '🏷️ Elegí la categoría:', keyboard: buttons }
    }

    if (action === 'acct') {
      const accounts = await this.getAccounts()
      const buttons = accounts.map(a => ([{
        text: `${a.name} (${a.currency})`,
        callback_data: `setacct|${transactionId}|${a.id}`,
      }]))
      buttons.push([{ text: 'Cancelar', callback_data: `cancel|${transactionId}` }])
      return { text: '🏦 Elegí la cuenta:', keyboard: buttons }
    }

    if (action === 'setcat') {
      const categoryName = parts.slice(2).join('|')
      const categories = await this.getCategories()
      const cat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
      if (!cat) {
        return { text: `❓ Categoría "${categoryName}" no encontrada.`, keyboard: this.confirmationKeyboard(transactionId) }
      }
      await this.updateTransactionField(transactionId, 'category_id', cat.id)

      const txn = await this.getTransaction(transactionId)
      if (txn) {
        const words = extractKeywords(txn.description || '')
        for (const word of words) {
          await this.saveKeywordRule(word, 'category_name', categoryName)
        }
      }

      return {
        text: `✅ Categoría actualizada → ${categoryName}`,
        keyboard: this.confirmationKeyboard(transactionId),
      }
    }

    if (action === 'setacct') {
      const accountId = parts[2]
      await this.updateTransactionField(transactionId, 'account_id', accountId)
      const accounts = await this.getAccounts()
      const acc = accounts.find(a => a.id === accountId)

      const txn = await this.getTransaction(transactionId)
      if (txn && acc) {
        const words = extractKeywords(txn.description || '')
        for (const word of words) {
          await this.saveKeywordRule(word, 'account_name', acc.name)
        }
      }

      return {
        text: `✅ Cuenta actualizada → ${acc?.name || accountId}`,
        keyboard: this.confirmationKeyboard(transactionId),
      }
    }

    if (action === 'cancel') {
      return { text: 'Operación cancelada.', keyboard: this.confirmationKeyboard(transactionId) }
    }

    return { text: '❓ Acción desconocida.' }
  }

  // ── Main entry points ─────────────────────────────────

  async processText(text: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    if (this.isCommand(text)) {
      return { text: await this.handleCommand(text) }
    }

    const accounts = await this.getAccounts()
    if (accounts.length === 0) {
      return { text: 'No tenés cuentas registradas. Creá una cuenta primero desde la app.' }
    }

    const categories = await this.getCategories()
    const keywordRules = await this.getKeywordRules()
    const defaults = await this.getSmartDefaults()

    // Try rules first
    let parsed = parseWithRules(text, accounts, categories, keywordRules)

    // Try AI fallback
    if (!parsed || parsed.amount === 0) {
      const customPrompt = await this.getCustomPrompt()
      parsed = await parseWithAI(text, this.openai, accounts, categories, keywordRules, customPrompt)
    }

    if (parsed.amount === 0) {
      return {
        text: 'No pude identificar el monto del gasto. Probá: "Supermercado 8000 en Efectivo"',
      }
    }

    // Resolve account from AI name match
    if (parsed.accountName && !parsed.accountId) {
      const found = accounts.find(a => a.name.toLowerCase() === parsed.accountName!.toLowerCase())
      if (found) parsed.accountId = found.id
    }

    // Fallback to smart default account
    if (!parsed.accountId) {
      if (defaults.accountId) {
        parsed.accountId = defaults.accountId
        parsed.accountName = defaults.accountName
      } else {
        parsed.accountId = accounts[0].id
        parsed.accountName = accounts[0].name
      }
    }

    // Fallback payment method based on account type
    if (!parsed.paymentMethod || parsed.paymentMethod === 'cash') {
      const acc = accounts.find(a => a.id === parsed.accountId)
      if (acc && acc.type === 'bank') {
        parsed.paymentMethod = 'card'
      }
    }

    // Save keyword rules from successful parse
    if (parsed.confidence === 'rules' || parsed.confidence === 'ai') {
      const words = extractKeywords(text)
      if (parsed.categoryName) {
        for (const word of words) {
          await this.saveKeywordRule(word, 'category_name', parsed.categoryName)
        }
      }
      if (parsed.accountName) {
        for (const word of words) {
          await this.saveKeywordRule(word, 'account_name', parsed.accountName)
        }
      }
      if (parsed.type !== 'expense') {
        for (const word of words) {
          await this.saveKeywordRule(word, 'type', parsed.type)
        }
      }
    }

    const transactionId = await this.createTransaction(parsed)

    return {
      text: this.formatConfirmation(parsed, transactionId),
      keyboard: this.confirmationKeyboard(transactionId),
    }
  }

  async processVoice(fileId: string, telegramToken: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    const { TelegramClient } = await import('./telegramClient')
    const telegram = new TelegramClient(telegramToken)

    const { file_path } = await telegram.getFile(fileId)
    const audioBuffer = await telegram.downloadFile(file_path)
    const file = new File([new Uint8Array(audioBuffer)], 'voice.ogg', { type: 'audio/ogg' })

    const transcription = await this.openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'es',
      response_format: 'text',
    })

    return this.processText(transcription)
  }
}
