import type { Account, Category, KeywordRule, ParsedTransaction } from './types'

export function normalizeAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
}

export function getArgentinaISOString(): string {
  const argStr = new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  const d = new Date(argStr)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.000-03:00`
}

export function extractKeywords(text: string): string[] {
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

export function detectPaymentMethod(text: string): string | null {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [kw, method] of Object.entries(PAYMENT_KEYWORDS)) {
    if (lower.includes(kw)) return method
  }
  return null
}

export function isCardPayment(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return /\b(cr[eé]dito|credito|t(c|arjeta))\b/i.test(lower)
}

export function parseText(
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

export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: currency === 'USD' ? 'USD' : 'ARS', minimumFractionDigits: 2,
  }).format(amount)
}
