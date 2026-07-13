import OpenAI from 'openai'
import type { Account, Category, KeywordRule, ParsedTransaction } from './types'

export async function parseWithAI(
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
