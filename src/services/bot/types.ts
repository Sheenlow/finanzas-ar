export interface Account {
  id: string
  name: string
  currency: string
  type: string
}

export interface Category {
  id: string
  name: string
}

export interface KeywordRule {
  keyword: string
  field: 'category_name' | 'account_name' | 'type'
  value: string
}

export interface ParsedTransaction {
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

export interface TransactionRow {
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

export type FlowState = 'ask_cuotas' | 'ask_cuotas_count' | 'ask_subscription' | 'ask_frequency' | 'select_account' | 'select_category' | 'ask_household_show' | 'ask_household_share' | 'confirm' | 'edit'
