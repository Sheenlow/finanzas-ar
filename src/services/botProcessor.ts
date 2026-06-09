import OpenAI from 'openai'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { householdSplitService } from './householdSplitService'
import { getBillingMonthFromRules, getBillingMonthFromCycle } from '@/lib/utils'

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
  subscriptionFrequency: string | null
  householdId: string | null
  isSharing: boolean | undefined
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

type FlowState = 'ask_cuotas' | 'ask_cuotas_count' | 'ask_subscription' | 'ask_frequency' | 'select_account' | 'select_category' | 'ask_household_show' | 'ask_household_share' | 'confirm' | 'edit'

function normalizeAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
}

function getArgentinaISOString(): string {
  const argStr = new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  const d = new Date(argStr)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.000-03:00`
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

function isCardPayment(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return /\b(cr[eé]dito|credito|t(c|arjeta))\b/i.test(lower)
}

function parseText(
  text: string,
  accounts: Account[],
  categories: Category[],
  keywordRules: KeywordRule[]
): ParsedTransaction | null {
  let remaining = text.trim()
  if (!remaining) return null

  let type = 'expense'
  const typeKeywords = keywordRules.filter(r => r.field === 'type')
  for (const rule of typeKeywords) {
    if (remaining.toLowerCase().includes(rule.keyword.toLowerCase())) { type = rule.value; break }
  }
  if (remaining.match(/\b(suscripci[oó]n|subscription)\b/i)) {
    type = 'subscription'; remaining = remaining.replace(/\b(suscripci[oó]n|subscription)\b/i, '').trim()
  } else if (remaining.match(/\b(servicio|service)\b/i)) {
    type = 'service'; remaining = remaining.replace(/\b(servicio|service)\b/i, '').trim()
  }

  let currency = 'ARS'
  const currencyMatch = remaining.match(/\b(USD|usd|d[oó]lar(es)?|dolar(es)?|U\$S|usdt|USDC|usdc|BTC|btc|ETH|eth)\b/i)
  if (currencyMatch) {
    const curr = currencyMatch[1].toUpperCase()
    if (['USD', 'USDT', 'USDC'].includes(curr) || curr.startsWith('D') || curr.startsWith('U$')) currency = 'USD'
    else if (curr === 'BTC') currency = 'BTC'
    else if (curr === 'ETH') currency = 'ETH'
    remaining = remaining.replace(currencyMatch[0], '').trim()
  }

  let accountId: string | null = null
  let accountName: string | null = null
  const enMatch = remaining.match(/\ben\s+([a-záéíóúA-ZÁÉÍÓÚ\s]+?)(?:\s|$)/i)
  if (enMatch) {
    const candidate = enMatch[1].trim()
    const sorted = [...accounts].sort((a, b) => b.name.length - a.name.length)
    for (const acc of sorted) {
      if (candidate.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .includes(acc.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
        accountId = acc.id; accountName = acc.name
        remaining = remaining.replace(enMatch[0], '').trim(); break
      }
    }
  }

  if (!accountId) {
    const accountRules = keywordRules.filter(r => r.field === 'account_name')
    for (const rule of accountRules) {
      if (remaining.toLowerCase().includes(rule.keyword.toLowerCase())) {
        const acc = accounts.find(a => a.name.toLowerCase() === rule.value.toLowerCase())
        if (acc) { accountId = acc.id; accountName = acc.name; break }
      }
    }
  }

  if (!accountId) {
    const sorted = [...accounts].sort((a, b) => b.name.length - a.name.length)
    for (const acc of sorted) {
      const escaped = acc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escaped}\\b`, 'i')
      if (remaining.match(regex)) { accountId = acc.id; accountName = acc.name; remaining = remaining.replace(regex, '').trim(); break }
    }
  }

  let paymentMethod = 'cash'
  const detected = detectPaymentMethod(remaining)
  if (detected) { paymentMethod = detected; remaining = remaining.replace(/\b(efectivo|cash|d[eé]bito|debito|cr[eé]dito|credito|transferencia|transfer)\b/i, '').trim() }
  remaining = remaining.replace(/^con\s+/i, '').trim()

  let installments = 0
  const cuotasMatch = remaining.match(/cuotas?\s*(\d+)/i) || remaining.match(/(\d+)\s*cuotas?/i)
  if (cuotasMatch) { installments = parseInt(cuotasMatch[1]); remaining = remaining.replace(cuotasMatch[0], '').trim() }

  const numberMatches = [...remaining.matchAll(/(\d+[.,]?\d*)/g)]
  if (numberMatches.length === 0) return null
  const lastNumber = numberMatches[numberMatches.length - 1]
  const amount = normalizeAmount(lastNumber[1])
  const beforeAmount = remaining.slice(0, lastNumber.index).trim()
  const afterAmount = remaining.slice(lastNumber.index! + lastNumber[0].length).trim()
  remaining = [beforeAmount, afterAmount].filter(Boolean).join(' ').trim()

  let categoryName: string | null = null
  const catRules = keywordRules.filter(r => r.field === 'category_name')
  const allWords = extractKeywords(text)
  for (const word of allWords) {
    const match = catRules.find(r => r.keyword.toLowerCase() === word)
    if (match) { categoryName = match.value; break }
  }

  const description = remaining || text.split(/\d/)[0]?.trim() || 'Gasto sin descripción'

  return {
    description: description.length > 100 ? description.slice(0, 100) : description,
    amount, currency, type, accountId, accountName, paymentMethod, installments, categoryName,
    subscriptionFrequency: null, householdId: null, isSharing: undefined,
  }
}

async function parseWithAI(
  text: string, openai: OpenAI, accounts: Account[], categories: Category[],
  keywordRules: KeywordRule[], customPrompt?: string
): Promise<ParsedTransaction> {
  const accountList = accounts.map(a => `"${a.name}" (${a.currency})`).join(', ')
  const categoryList = categories.map(c => `"${c.name}"`).join(', ')
  const rulesDesc = keywordRules.length > 0
    ? '\n\nReglas aprendidas:\n' + keywordRules.map(r => `  "${r.keyword}" → ${r.field} = "${r.value}"`).join('\n') : ''
  const extraPrompt = customPrompt ? `\n\nInstrucciones adicionales:\n${customPrompt}` : ''

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `Extraé info de gastos del mensaje. Solo JSON:
{"description":"string","amount":number,"currency":"ARS"|"USD"|"USDT"|"USDC"|"BTC"|"ETH","type":"expense"|"subscription"|"service","accountName":"string|null","paymentMethod":"cash"|"card"|"transfer","installments":number,"categoryName":"string|null"}
Cuentas: ${accountList}
Categorías: ${categoryList}${rulesDesc}
Moneda default ARS. paymentMethod: efectivo/cash→cash, débito/debito→card, crédito/credito→card, transferencia/transfer→transfer.${extraPrompt}`,
    }, { role: 'user', content: text }],
    temperature: 0.1, max_tokens: 300,
  })
  const raw = response.choices[0]?.message?.content || '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}')
  return {
    description: parsed.description || text.slice(0, 100),
    amount: parsed.amount || 0, currency: parsed.currency || 'ARS', type: parsed.type || 'expense',
    accountId: null, accountName: parsed.accountName || null,
    paymentMethod: parsed.paymentMethod || 'cash', installments: parsed.installments || 0,
    categoryName: parsed.categoryName || null,
    subscriptionFrequency: null, householdId: null, isSharing: undefined,
  }
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: currency === 'USD' ? 'USD' : 'ARS', minimumFractionDigits: 2,
  }).format(amount)
}

export class BotProcessor {
  private openai: OpenAI
  private supabase: SupabaseClient
  private userId: string

  constructor(userId: string) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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

  private async getKeywordRules(): Promise<KeywordRule[]> {
    const { data } = await this.supabase.from('bot_rules').select('keyword, field, value').eq('user_id', this.userId)
    return (data || []) as KeywordRule[]
  }

  private async getCustomPrompt(): Promise<string | undefined> {
    const { data } = await this.supabase.from('bot_config').select('custom_prompt').eq('user_id', this.userId).maybeSingle()
    return data?.custom_prompt || undefined
  }

  private async getSmartDefaults(): Promise<{ accountId: string | null; accountName: string | null; paymentMethod: string }> {
    const { data } = await this.supabase.from('transactions')
      .select('account_id, payment_method, accounts!transactions_account_id_fkey(name)').eq('user_id', this.userId)
      .order('created_at', { ascending: false }).limit(10)
    if (!data || data.length === 0) return { accountId: null, accountName: null, paymentMethod: 'cash' }
    const accounts = data.map((t: any) => t.account_id)
    const topAccount = accounts.sort((a, b) => accounts.filter(x => x === b).length - accounts.filter(x => x === a).length)[0]
    const methods = data.map((t: any) => t.payment_method)
    const topMethod = methods.sort((a, b) => methods.filter(x => x === b).length - methods.filter(x => x === a).length)[0] || 'cash'
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

  private async saveKeywordRule(keyword: string, field: 'category_name' | 'account_name' | 'type', value: string) {
    await this.supabase.from('bot_rules').upsert({ user_id: this.userId, keyword: keyword.toLowerCase(), field, value }, { onConflict: 'user_id,keyword,field' })
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

  private isCommand(text: string): boolean { return /^\/(start|help|ayuda|stats|list|balance|config|vincular|desvincular)\b/.test(text.trim()) }

  async handleCommand(text: string, telegramUserId?: number): Promise<string> {
    const cmd = text.trim().split(/\s+/)[0].toLowerCase()
    switch (cmd) {
      case '/start': case '/help': case '/ayuda':
        return `<b>🤖 ¿Cómo usar el bot de Finanzas AR?</b>

<b>Registrar un gasto por texto:</b>
Escribí: [descripción] [monto] [medio de pago]

<b>Medios de pago:</b>
• efectivo
• débito
• crédito
• transferencia

<b>Ejemplos:</b>
• Supermercado 8000 efectivo
• Netflix 12 USD débito suscripción
• Nafta 5000 crédito 3 cuotas
• Zapatillas 25000 crédito

<b>¿Cómo funcionan las tarjetas de crédito?</b>
Cuando pagás con crédito, el bot asigna automáticamente el gasto al mes de facturación correcto usando la regla de cierre de tu tarjeta. Si tu tarjeta cierra el 18 y comprás el 20, el gasto va al mes siguiente (cuando llega el resumen). Podés configurar la regla de cierre (último jueves o día fijo) y cargar ciclos reales desde la app web en la sección Cuentas.

<b>Comandos:</b>
/stats — resumen de gastos del mes
/list — últimos 10 gastos
/balance — saldo de todas tus cuentas
/config — personalizar cómo la IA interpreta tus gastos
/ayuda — esta guía
/desvincular — desvincular tu cuenta

<b>¿Cómo aprende el bot?</b>
Cuando corregís una categoría o cuenta después de confirmar un gasto, el bot aprende de esa corrección. La próxima vez que uses palabras similares, las va a asignar automáticamente.

<b>¿Cómo vinculo mi cuenta?</b>
Andá al Dashboard de la app web, copiá el código de vinculación, y mandalo acá: /vincular TU-CODIGO

<b>Consejos:</b>
• Mencioná el medio de pago para agilizar (efectivo, débito, crédito).
• Si pagás con tarjeta de crédito, el bot calcula automáticamente el mes de facturación correcto.
• Usá /config para enseñarle tus cuentas y preferencias.`
      case '/stats': return await this.getStatsMessage()
      case '/list': return await this.getListMessage()
      case '/balance': return await this.getBalancesMessage()
      case '/vincular': {
        if (!telegramUserId) return '❌ Error: no se pudo identificar tu usuario de Telegram.'
        const token = text.slice('/vincular'.length).trim()
        if (!token || token.length < 30) return '❌ Código inválido. Copialo desde la app (Dashboard → Vinculá tu bot).'

        const { data: cfg } = await this.supabase.from('bot_config').select('user_id, link_token').eq('link_token', token).maybeSingle()
        if (!cfg) return '❌ Código inválido o ya fue usado. Andá al Dashboard para generar uno nuevo.'

        // Check if this supabase account is already linked to a different Telegram
        const { data: existingLink } = await this.supabase.from('bot_users')
          .select('telegram_user_id')
          .eq('supabase_user_id', cfg.user_id)
          .maybeSingle()

        if (existingLink && existingLink.telegram_user_id !== telegramUserId) {
          return '❌ Esta cuenta de FinanzasAR ya está vinculada a otro Telegram.'
        }

        await this.supabase.from('bot_users').upsert(
          { telegram_user_id: telegramUserId, supabase_user_id: cfg.user_id },
          { onConflict: 'telegram_user_id' }
        )

        // Invalidate token (single-use)
        await this.supabase.from('bot_config')
          .update({ link_token: null, updated_at: new Date().toISOString() })
          .eq('user_id', cfg.user_id)

        // Get user name for greeting
        const { data: profile } = await this.supabase.from('profiles')
          .select('full_name')
          .eq('id', cfg.user_id)
          .maybeSingle()

        const name = profile?.full_name?.split(' ')[0] || ''
        const greeting = name ? `¡Vinculado correctamente, ${name}!` : '¡Cuenta vinculada correctamente!'

        return `✅ ${greeting}\n\nYa podés registrar gastos en tu cuenta de FinanzasAR.\nProbá: /help para ver cómo usarme.`
      }
      case '/desvincular': {
        if (!telegramUserId) return '❌ Error: no se pudo identificar tu usuario de Telegram.'

        const { data: link } = await this.supabase.from('bot_users')
          .select('supabase_user_id')
          .eq('telegram_user_id', telegramUserId)
          .maybeSingle()

        if (!link) return '❌ No tenés ninguna cuenta vinculada.'

        // Delete the link
        await this.supabase.from('bot_users').delete().eq('telegram_user_id', telegramUserId)

        // Regenerate a fresh link_token in bot_config (so the dashboard shows a new code)
        const newToken = crypto.randomUUID()
        await this.supabase.from('bot_config')
          .update({ link_token: newToken, updated_at: new Date().toISOString() })
          .eq('user_id', link.supabase_user_id)

        return '🔓 Cuenta desvinculada. Ya no recibiré gastos de este Telegram.\n\nPara volver a vincular, usá el código del Dashboard con /vincular.'
      }
      case '/config': {
        const rest = text.slice('/config'.length).trim()
        if (rest) {
          await this.supabase.from('bot_config').upsert({ user_id: this.userId, custom_prompt: rest, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          return '✅ Prompt personalizado actualizado:\n\n<i>' + rest + '</i>'
        }
        const prompt = await this.getCustomPrompt()
        return prompt ? '📝 <b>Prompt personalizado actual:</b>\n\n' + prompt + '\n\nPara cambiarlo, mandá /config seguido del nuevo texto.'
          : '📝 No tenés un prompt personalizado.\n\nMandá /config seguido de tus instrucciones. Ejemplo:\n/config Mis cuentas son Galicia, MP y Efectivo.'
      }
      default: return ''
    }
  }

  private async getStatsMessage(): Promise<string> {
    const argStr = new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
    const now = new Date(argStr)
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const { data } = await this.supabase.from('transactions').select('amount, currency, type').eq('user_id', this.userId).like('transaction_date', `${monthPrefix}%`)
    let totalArs = 0, totalUsd = 0
    const expenses = (data || []).filter(t => t.type !== 'income')
    expenses.forEach(t => { if (t.currency === 'ARS') totalArs += t.amount; else totalUsd += t.amount })
    const monthName = now.toLocaleString('es-AR', { month: 'long' })
    return `<b>📊 Gastos de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${now.getFullYear()}</b>\n\n• Total ARS: ${formatAmount(totalArs, 'ARS')}\n• Total USD: ${formatAmount(totalUsd, 'USD')}\n• Transacciones: ${expenses.length}`
  }

  private async getListMessage(): Promise<string> {
    const { data } = await this.supabase.from('transactions').select('id, description, amount, currency, type, is_installment, installments_total, installment_number').eq('user_id', this.userId).order('created_at', { ascending: false }).limit(10)
    if (!data || data.length === 0) return '📋 No tenés gastos registrados todavía.'
    const lines = data.map((t: any, i: number) => {
      const inst = t.is_installment ? ` (${t.installment_number}/${t.installments_total})` : ''
      const icon = t.type === 'income' ? '💰' : t.type === 'subscription' ? '🔁' : t.type === 'service' ? '⚡' : '💸'
      return `${i + 1}. ${icon} ${t.description}: ${formatAmount(t.amount, t.currency)}${inst}`
    })
    return `<b>📋 Últimos movimientos</b>\n\n${lines.join('\n')}`
  }

  private async getBalancesMessage(): Promise<string> {
    const { data } = await this.supabase.from('accounts').select('name, balance, currency').eq('user_id', this.userId).order('name')
    if (!data || data.length === 0) return '💰 No tenés cuentas registradas.'
    return `<b>💰 Saldos</b>\n\n${data.map((a: any) => `• ${a.name}: ${formatAmount(a.balance, a.currency)}`).join('\n')}`
  }

  // ──── Transaction CRUD ──────────────────────────────

  private async createTransaction(parsed: ParsedTransaction): Promise<string> {
    const dateStr = getArgentinaISOString()

    let categoryId: string | null = null
    if (parsed.categoryName) {
      const cats = await this.getCategories()
      const cat = cats.find(c => c.name.toLowerCase() === parsed.categoryName!.toLowerCase())
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

    // Update account balance
    if (parsed.accountId) {
      const { data: account } = await this.supabase.from('accounts').select('balance').eq('id', parsed.accountId).single()
      if (account) {
        await this.supabase.from('accounts').update({ balance: account.balance - installmentAmount }).eq('id', parsed.accountId)
      }
    }

    // Split with household if sharing
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
    parts.push(`✅ <b>${parsed.description}</b>`)

    if (parsed.installments > 0) {
      const perCuota = Math.round((parsed.amount / parsed.installments) * 100) / 100
      parts.push(`${formatAmount(perCuota, parsed.currency)} (${parsed.installments} cuotas — ${formatAmount(parsed.amount, parsed.currency)} total)`)
    } else {
      parts.push(`${formatAmount(parsed.amount, parsed.currency)} ${parsed.currency}`)
    }

    if (parsed.accountName) parts.push(`[${parsed.accountName}]`)
    if (parsed.categoryName) parts.push(`#${parsed.categoryName}`)
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
      if (!cat) return { text: `❓ Categoría "${categoryName}" no encontrada.`, keyboard: this.confirmationKeyboard(transactionId) }
      await this.updateTransactionField(transactionId, 'category_id', cat.id)
      const txn = await this.getTransaction(transactionId)
      if (txn) for (const w of extractKeywords(txn.description || '')) await this.saveKeywordRule(w, 'category_name', categoryName)
      return { text: `✅ Categoría actualizada → ${categoryName}`, keyboard: this.confirmationKeyboard(transactionId) }
    }

    if (action === 'setacct') {
      const accountId = rest
      await this.updateTransactionField(transactionId, 'account_id', accountId)
      const accs = await this.getAccounts(); const acc = accs.find(a => a.id === accountId)
      const txn = await this.getTransaction(transactionId)
      if (txn && acc) for (const w of extractKeywords(txn.description || '')) await this.saveKeywordRule(w, 'account_name', acc.name)
      return { text: `✅ Cuenta actualizada → ${acc?.name || accountId}`, keyboard: this.confirmationKeyboard(transactionId) }
    }

    if (action === 'cancel') return { text: 'Operación cancelada.', keyboard: this.confirmationKeyboard(transactionId) }
    return { text: '❓ Acción desconocida.' }
  }

  // ──── MAIN callback router ──────────────────────────

  async handleCallback(data: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    // Route OLD callbacks (editing after confirmation)
    if (!data.startsWith('new:')) {
      const parts = data.split('|')
      const action = parts[0]; const transactionId = parts[1]
      if (action === 'setcat') return this.handleOldCallback(action, transactionId, parts.slice(2).join('|'))
      return this.handleOldCallback(action, transactionId, parts[2] || '')
    }

    // Route NEW interactive flow callbacks
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
        else { pending.installments = 0; nextState = this.computeNext(pending) }
        break
      case 'cuotas_n':
        pending.installments = parseInt(value) || 0
        nextState = this.computeNext(pending)
        break
      case 'subscription':
        if (value === 'si') nextState = 'ask_frequency'
        else { pending.type = 'expense'; pending.subscriptionFrequency = null; nextState = this.computeNext(pending) }
        break
      case 'frequency':
        pending.subscriptionFrequency = value
        nextState = this.computeNext(pending)
        break
      case 'acct':
        pending.accountId = value
        const accs = await this.getAccounts(); const acc = accs.find(a => a.id === value)
        pending.accountName = acc?.name || null
        if (!pending.paymentMethod || pending.paymentMethod === 'cash') {
          if (acc && acc.type === 'bank') pending.paymentMethod = 'card'
        }
        nextState = this.computeNext(pending)
        break
      case 'cat':
        pending.categoryName = decodeURIComponent(value)
        nextState = this.computeNext(pending)
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
          if (pending.categoryName) for (const w of words) await this.saveKeywordRule(w, 'category_name', pending.categoryName)
          if (pending.accountName) for (const w of words) await this.saveKeywordRule(w, 'account_name', pending.accountName)
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
    return this.renderState(nextState, pending)
  }

  // ──── State renderer ────────────────────────────────

  private computeNext(pending: ParsedTransaction): FlowState {
    if (pending.type === 'subscription' && !pending.subscriptionFrequency) return 'ask_subscription'
    if (!pending.accountId) return 'select_account'
    if (!pending.categoryName) return 'select_category'
    if (pending.householdId && typeof pending.isSharing === 'undefined') return 'ask_household_show'
    return 'confirm'
  }

  private async renderState(state: FlowState, pending: ParsedTransaction): Promise<{ text: string; keyboard: { text: string; callback_data: string }[][] }> {
    switch (state) {
      case 'ask_cuotas':
        return {
          text: `💳 Detecté pago con tarjeta. ¿Es en cuotas?\n\n<b>${pending.description}</b> — ${formatAmount(pending.amount, pending.currency)}`,
          keyboard: [[{ text: 'Sí, en cuotas', callback_data: 'new:cuotas:si' }, { text: 'No, pago único', callback_data: 'new:cuotas:no' }],
          [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
        }

      case 'ask_cuotas_count':
        return {
          text: `¿Cuántas cuotas?\n\n<b>${pending.description}</b> — ${formatAmount(pending.amount, pending.currency)}`,
          keyboard: [
            [{ text: '3', callback_data: 'new:cuotas_n:3' }, { text: '6', callback_data: 'new:cuotas_n:6' }],
            [{ text: '9', callback_data: 'new:cuotas_n:9' }, { text: '12', callback_data: 'new:cuotas_n:12' }],
            [{ text: '18', callback_data: 'new:cuotas_n:18' }, { text: '24', callback_data: 'new:cuotas_n:24' }],
            [{ text: 'Cancelar', callback_data: 'new:cancel' }],
          ],
        }

      case 'select_account': {
        const accounts = await this.getAccounts()
        const buttons = accounts.map(a => ([{ text: `${a.name} (${a.currency})`, callback_data: `new:acct:${a.id}` }]))
        buttons.push([{ text: 'Cancelar', callback_data: 'new:cancel' }])
        return { text: `🏦 ¿En qué cuenta?\n\n<b>${pending.description}</b> — ${formatAmount(pending.amount, pending.currency)}`, keyboard: buttons }
      }

      case 'ask_subscription':
        return {
          text: `🔁 ¿Es un gasto recurrente (suscripción)?\n\n<b>${pending.description}</b> — ${formatAmount(pending.amount, pending.currency)}`,
          keyboard: [[{ text: 'Sí, recurrente', callback_data: 'new:subscription:si' }, { text: 'No, único', callback_data: 'new:subscription:no' }],
          [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
        }

      case 'ask_frequency':
        return {
          text: `¿Cada cuánto se repite?\n\n<b>${pending.description}</b> — ${formatAmount(pending.amount, pending.currency)}`,
          keyboard: [
            [{ text: 'Mensual', callback_data: 'new:frequency:monthly' }, { text: 'Trimestral', callback_data: 'new:frequency:quarterly' }],
            [{ text: 'Semestral', callback_data: 'new:frequency:biannual' }, { text: 'Anual', callback_data: 'new:frequency:annual' }],
            [{ text: 'Cancelar', callback_data: 'new:cancel' }],
          ],
        }

      case 'ask_household_show':
        return {
          text: `🏠 ¿Mostrar en el hogar?\n\n<b>${pending.description}</b> — ${formatAmount(pending.amount, pending.currency)}`,
          keyboard: [[{ text: 'Sí, mostrar', callback_data: 'new:household_show:si' }, { text: 'No', callback_data: 'new:household_show:no' }],
          [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
        }

      case 'ask_household_share':
        return {
          text: `🤝 ¿Compartir el gasto con el hogar?\n\n<b>${pending.description}</b> — ${formatAmount(pending.amount, pending.currency)}`,
          keyboard: [[{ text: 'Sí, compartir', callback_data: 'new:household_share:si' }, { text: 'No, solo mostrar', callback_data: 'new:household_share:no' }],
          [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
        }

      case 'select_category': {
        const categories = await this.getCategories()
        const buttons: { text: string; callback_data: string }[][] = []
        for (let i = 0; i < categories.length; i += 2) {
          buttons.push(categories.slice(i, i + 2).map(c => ({ text: c.name, callback_data: `new:cat:${encodeURIComponent(c.name)}` })))
        }
        buttons.push([{ text: 'Cancelar', callback_data: 'new:cancel' }])
        return { text: `🏷️ ¿Categoría?\n\n<b>${pending.description}</b> — ${formatAmount(pending.amount, pending.currency)}`, keyboard: buttons }
      }

      case 'confirm': {
        const perCuota = pending.installments > 0 ? Math.round((pending.amount / pending.installments) * 100) / 100 : pending.amount
        const lines: string[] = [`<b>${pending.description}</b>`]
        if (pending.installments > 0) {
          lines.push(`${formatAmount(perCuota, pending.currency)} c/u × ${pending.installments} cuotas (${formatAmount(pending.amount, pending.currency)} total)`)
        } else {
          lines.push(`${formatAmount(pending.amount, pending.currency)} ${pending.currency}`)
        }
        if (pending.accountName) lines.push(`Cuenta: ${pending.accountName}`)
        if (pending.categoryName) lines.push(`Categoría: ${pending.categoryName}`)
        if (pending.paymentMethod === 'card') lines.push('Pago: Tarjeta')
        else if (pending.paymentMethod === 'transfer') lines.push('Pago: Transferencia')
        else lines.push('Pago: Efectivo')
        if (pending.subscriptionFrequency) {
          const freqLabel: Record<string, string> = { monthly: 'Mensual', quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual' }
          lines.push(`🔁 ${freqLabel[pending.subscriptionFrequency]}`)
        }
        if (pending.householdId && pending.isSharing) lines.push('🏠 Compartido con el hogar')
        else if (pending.householdId) lines.push('🏠 Visible en el hogar')
        return {
          text: `¿Confirmás el gasto?\n\n${lines.join('\n')}`,
          keyboard: [[{ text: '✅ Confirmar', callback_data: 'new:confirm:yes' }, { text: '✏️ Editar', callback_data: 'new:confirm:edit' }],
          [{ text: 'Cancelar', callback_data: 'new:cancel' }]],
        }
      }

      case 'edit': {
        const lines: string[] = []
        if (pending.categoryName) lines.push(`🏷️ <b>Categoría:</b> ${pending.categoryName}`)
        else lines.push(`🏷️ <b>Categoría:</b> sin asignar`)
        if (pending.accountName) lines.push(`🏦 <b>Cuenta:</b> ${pending.accountName}`)
        else lines.push(`🏦 <b>Cuenta:</b> sin asignar`)
        if (pending.installments > 0) lines.push(`💳 <b>Cuotas:</b> ${pending.installments}`)
        else lines.push(`💳 <b>Cuotas:</b> pago único`)
        if (pending.subscriptionFrequency) {
          const freqLabel: Record<string, string> = { monthly: 'Mensual', quarterly: 'Trimestral', biannual: 'Semestral', annual: 'Anual' }
          lines.push(`🔁 <b>Recurrencia:</b> ${freqLabel[pending.subscriptionFrequency]}`)
        } else if (pending.type === 'subscription') {
          lines.push(`🔁 <b>Recurrencia:</b> sin definir`)
        }
        if (pending.householdId) {
          lines.push(pending.isSharing ? '🏠 <b>Hogar:</b> Compartido' : '🏠 <b>Hogar:</b> Visible')
        }
        return {
          text: `¿Qué querés editar?\n\n<b>${pending.description}</b> — ${formatAmount(pending.amount, pending.currency)}\n\n${lines.join('\n')}`,
          keyboard: [
            [{ text: '🏷️ Categoría', callback_data: 'new:edit:cat' }, { text: '🏦 Cuenta', callback_data: 'new:edit:acct' }],
            [{ text: '💳 Cuotas', callback_data: 'new:edit:cuotas' }],
            pending.householdId
              ? [{ text: '🏠 Hogar visible', callback_data: 'new:edit:household_show' }, { text: '🤝 Compartir', callback_data: 'new:edit:household_share' }]
              : [],
            [{ text: '🔙 Volver', callback_data: 'new:edit:back' }],
          ].filter(r => r.length > 0),
        }
      }

      default: return { text: '❓ Estado desconocido.', keyboard: [] }
    }
  }

  // ──── Main entry: process text ──────────────────────

  async processText(text: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    if (this.isCommand(text)) return { text: await this.handleCommand(text) }

    // Clear any existing pending flow
    await this.clearPending()

    const accounts = await this.getAccounts()
    if (accounts.length === 0) return { text: 'No tenés cuentas registradas. Creá una cuenta primero desde la app.' }

    const categories = await this.getCategories()
    const keywordRules = await this.getKeywordRules()
    const defaults = await this.getSmartDefaults()

    let parsed = parseText(text, accounts, categories, keywordRules)
    if (!parsed || parsed.amount === 0) {
      const customPrompt = await this.getCustomPrompt()
      parsed = await parseWithAI(text, this.openai, accounts, categories, keywordRules, customPrompt)
    }

    if (!parsed || parsed.amount === 0) {
      return { text: 'No pude identificar el monto. Probá: "Supermercado 8000 en Efectivo"' }
    }

    // Resolve account from AI match
    if (parsed.accountName && !parsed.accountId) {
      const found = accounts.find(a => a.name.toLowerCase() === parsed.accountName!.toLowerCase())
      if (found) parsed.accountId = found.id
    }

    // Determine starting state (what's missing)
    const hasAccount = !!parsed.accountId
    const hasCategory = !!parsed.categoryName
    const needsCuotasQuestion = isCardPayment(text) && parsed.installments === 0
    const isSubscription = parsed.type === 'subscription'
    const householdId = await this.getUserHousehold()

    // Fallback defaults
    if (!parsed.paymentMethod || parsed.paymentMethod === 'cash') {
      if (parsed.accountId) {
        const acc = accounts.find(a => a.id === parsed.accountId)
        if (acc && acc.type === 'bank') parsed.paymentMethod = 'card'
      }
    }
    if (!parsed.paymentMethod) parsed.paymentMethod = defaults.paymentMethod

    // Preset household-related fields
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
    return this.renderState(firstState, parsed)
  }

}
