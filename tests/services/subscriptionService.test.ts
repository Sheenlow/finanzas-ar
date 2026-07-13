import { describe, it, expect, vi, beforeEach } from 'vitest'
import { subscriptionService } from '@/services/subscriptionService'

vi.mock('@/services/transactionsService', () => ({
  resolveBillingMonth: vi.fn().mockResolvedValue(null),
}))

function mockBuilder(result: { data: any; error: any }) {
  const b: any = { data: result.data, error: result.error }
  const methods = ['select', 'eq', 'order', 'insert', 'update', 'delete', 'single', 'maybeSingle', 'gte', 'lt', 'is', 'in']
  methods.forEach((m) => {
    b[m] = vi.fn(() => b)
  })
  return b
}

function mockSupabase(tableResults: Record<string, { data: any; error: any }>) {
  return {
    from: vi.fn((table: string) => {
      return mockBuilder(tableResults[table] ?? { data: null, error: null })
    }),
  } as any
}

const mockParentSubscription = {
  id: 'sub-1',
  user_id: 'u1',
  account_id: 'acc-1',
  amount: 15.99,
  currency: 'USD',
  type: 'subscription',
  description: 'Netflix',
  transaction_date: '2026-06-01T00:00:00Z',
  payment_method: 'card',
  is_installment: false,
  parent_transaction_id: null,
  subscription_frequency: 'monthly',
}

const mockParentService = { ...mockParentSubscription, id: 'serv-1', type: 'service', description: 'Internet' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('subscriptionService', () => {
  describe('generateMissingSubscriptions', () => {
    it('genera hijos para el mes actual si no existen', async () => {
      const supabase = mockSupabase({
        transactions: { data: null, error: null },
      })
      supabase.from = vi.fn((table: string) => {
        if (table === 'transactions') {
          const isInsert = supabase.from.mock.calls.some((c: string[]) => c[0] === 'transactions')
          return mockBuilder({ data: null, error: null })
        }
        return mockBuilder({ data: null, error: null })
      })

      const supabase2 = mockSupabase({
        transactions: { data: [mockParentSubscription], error: null },
      })
      supabase2.from = vi.fn((table: string) => {
        if (table === 'transactions') {
          const callCount = supabase2.from.mock.calls.filter((c: string[]) => c[0] === 'transactions').length
          if (callCount <= 1) {
            return mockBuilder({ data: [mockParentSubscription], error: null })
          }
          return mockBuilder({ data: null, error: null })
        }
        return mockBuilder({ data: null, error: null })
      })

      await subscriptionService.generateMissingSubscriptions(supabase2, 'u1')
    })

    it('no genera si ya existe hijo para este mes', async () => {
      const supabase = mockSupabase({
        transactions: { data: null, error: null },
      })

      let firstCall = true
      supabase.from = vi.fn((table: string) => {
        if (table === 'transactions') {
          if (firstCall) {
            firstCall = false
            return mockBuilder({ data: [mockParentSubscription], error: null })
          }
          return mockBuilder({ data: { id: 'existing-child' }, error: null })
        }
        return mockBuilder({ data: null, error: null })
      })

      await subscriptionService.generateMissingSubscriptions(supabase, 'u1')
    })

    it('solo procesa type subscription y service', async () => {
      const supabase = mockSupabase({
        transactions: { data: [mockParentSubscription, mockParentService], error: null },
      })

      await subscriptionService.generateMissingSubscriptions(supabase, 'u1')
    })

    it('copia datos del padre (amount, currency, account_id)', async () => {
      let insertedData: any = null
      const builder = mockBuilder({ data: null, error: null })
      builder.insert = vi.fn((data: any) => {
        insertedData = data
        return builder
      })

      const supabase: any = {
        from: vi.fn((table: string) => {
          if (table === 'transactions') {
            const callCount = supabase.from.mock.calls.length
            if (callCount === 1) {
              return mockBuilder({ data: [mockParentSubscription], error: null })
            }
            if (callCount === 2) {
              return mockBuilder({ data: null, error: null })
            }
            return builder
          }
          return mockBuilder({ data: null, error: null })
        }),
      }

      await subscriptionService.generateMissingSubscriptions(supabase, 'u1')

      expect(insertedData).not.toBeNull()
      expect(insertedData[0].amount).toBe(mockParentSubscription.amount)
      expect(insertedData[0].currency).toBe(mockParentSubscription.currency)
      expect(insertedData[0].account_id).toBe(mockParentSubscription.account_id)
    })
  })
})
