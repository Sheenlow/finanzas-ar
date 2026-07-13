'use client'

import { useState } from 'react'
import type { Database } from '@/types/database.types'

type Transaction = Database['public']['Tables']['transactions']['Row']

export function useTransactionForm(defaults?: Transaction | null) {
  const [description, setDescription] = useState(defaults?.description || '')
  const [amount, setAmount] = useState(defaults?.amount?.toString() || '')
  const [type, setType] = useState<'expense' | 'income'>(defaults?.type === 'income' ? 'income' : 'expense')
  const [accountId, setAccountId] = useState(defaults?.account_id || '')
  const [categoryId, setCategoryId] = useState(defaults?.category_id || '')
  const [transactionDate, setTransactionDate] = useState(() => {
    if (defaults?.transaction_date) return new Date(defaults.transaction_date).toLocaleDateString('sv-SE')
    return new Date().toLocaleDateString('sv-SE')
  })
  const [currency, setCurrency] = useState<'ARS' | 'USD'>((defaults?.currency as 'ARS' | 'USD') || 'ARS')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>(
    (defaults?.payment_method as 'cash' | 'card' | 'transfer') || 'cash'
  )
  const [isInstallment, setIsInstallment] = useState(defaults?.is_installment || false)
  const [installmentsTotal, setInstallmentsTotal] = useState(defaults?.installments_total?.toString() || '')
  const [customInstallments, setCustomInstallments] = useState('')
  const [isRecurring, setIsRecurring] = useState(!!defaults?.subscription_frequency)
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'biannual' | 'annual'>(
    (defaults?.subscription_frequency as 'monthly' | 'quarterly' | 'biannual' | 'annual') || 'monthly'
  )
  const [isHouseholdVisible, setIsHouseholdVisible] = useState(false)
  const [isHouseholdExpense, setIsHouseholdExpense] = useState(!!defaults?.household_id)
  const [loading, setLoading] = useState(false)

  const resetForm = () => {
    setDescription('')
    setAmount('')
    setCategoryId('')
    setIsInstallment(false)
    setInstallmentsTotal('')
    setCustomInstallments('')
    setIsHouseholdVisible(false)
    setIsHouseholdExpense(false)
  }

  const getFinalInstallments = () => {
    if (!isInstallment) return 0
    return parseInt(installmentsTotal) || parseInt(customInstallments) || 3
  }

  return {
    description, setDescription,
    amount, setAmount,
    type, setType,
    accountId, setAccountId,
    categoryId, setCategoryId,
    transactionDate, setTransactionDate,
    currency, setCurrency,
    paymentMethod, setPaymentMethod,
    isInstallment, setIsInstallment,
    installmentsTotal, setInstallmentsTotal,
    customInstallments, setCustomInstallments,
    isRecurring, setIsRecurring,
    frequency, setFrequency,
    isHouseholdVisible, setIsHouseholdVisible,
    isHouseholdExpense, setIsHouseholdExpense,
    loading, setLoading,
    resetForm,
    getFinalInstallments,
  }
}
