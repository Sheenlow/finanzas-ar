import type { Account, Category, ParsedTransaction } from './types'

const ALLOWED_CURRENCIES = ['ARS', 'USD', 'USDT', 'USDC', 'BTC', 'ETH']
const ALLOWED_TYPES = ['expense', 'subscription', 'service']
const MAX_AMOUNT = 100_000_000

export function validateParsedTransaction(
  parsed: ParsedTransaction,
  accounts: Account[],
  categories: Category[]
): { valid: false; reason: string } | { valid: true } {
  if (!parsed || parsed.amount === 0) {
    return { valid: false, reason: 'Monto inválido o cero' }
  }

  if (parsed.amount <= 0) {
    return { valid: false, reason: 'Monto debe ser positivo' }
  }

  if (parsed.amount > MAX_AMOUNT) {
    return { valid: false, reason: `Monto excede el máximo permitido (${MAX_AMOUNT})` }
  }

  if (!ALLOWED_CURRENCIES.includes(parsed.currency)) {
    return { valid: false, reason: `Moneda no permitida: ${parsed.currency}` }
  }

  if (!ALLOWED_TYPES.includes(parsed.type)) {
    return { valid: false, reason: `Tipo no permitido desde AI: ${parsed.type}` }
  }

  if (parsed.type === 'income') {
    return { valid: false, reason: 'Transacciones de tipo income no pueden originarse desde AI' }
  }

  if (parsed.accountName) {
    const found = accounts.find(
      a => a.name.toLowerCase() === parsed.accountName!.toLowerCase()
    )
    if (!found) {
      return { valid: false, reason: `Cuenta no encontrada: ${parsed.accountName}` }
    }
  }

  if (parsed.categoryName) {
    const found = categories.find(
      c => c.name.toLowerCase() === parsed.categoryName!.toLowerCase()
    )
    if (!found) {
      return { valid: false, reason: `Categoría no encontrada: ${parsed.categoryName}` }
    }
  }

  return { valid: true }
}
