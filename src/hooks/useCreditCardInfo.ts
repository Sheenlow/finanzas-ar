'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { accountsService } from '@/services/accountsService'

interface CreditCardData {
  closing_day: number
  closing_rule: 'fixed' | 'last_thursday'
  due_day: number | null
  bank_name: string | null
}

export function useCreditCardInfo(accountId?: string) {
  const [creditCardData, setCreditCardData] = useState<CreditCardData | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!accountId) {
      setCreditCardData(null)
      return
    }
    accountsService.getCreditCard(supabase, accountId).then(card => {
      if (card) {
        setCreditCardData({
          closing_day: card.closing_day,
          closing_rule: card.closing_rule,
          due_day: card.due_day,
          bank_name: card.bank_name,
        })
      } else {
        setCreditCardData(null)
      }
    })
  }, [supabase, accountId])

  return { creditCardData }
}
