import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TransactionItem from '@/components/TransactionItem'

vi.mock('@/services/transactionsService', () => ({
  transactionsService: {
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({})),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/components/forms/TransactionForm', () => ({
  TransactionForm: () => <div>TransactionForm Mock</div>,
}))

describe('TransactionItem', () => {
  const baseTransaction = {
    id: '1',
    description: 'Compra supermercado',
    amount: 5000,
    currency: 'ARS',
    type: 'expense',
    transaction_date: '2026-07-10T10:00:00Z',
    is_installment: false,
    accounts: { name: 'Cuenta Principal' },
  }

  it('renderiza descripcion, monto y categoria', () => {
    render(
      <TransactionItem
        transaction={{ ...baseTransaction, categories: { name: 'Alimentos' } }}
        userId="user-1"
      />
    )

    expect(screen.getByText('Compra supermercado')).toBeInTheDocument()
    expect(screen.getByText('Pago único')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('5') && content.includes('000'))).toBeInTheDocument()
  })

  it('muestra badge para cuotas y para suscripciones', () => {
    const { rerender } = render(
      <TransactionItem
        transaction={{
          ...baseTransaction,
          description: 'TV LED',
          is_installment: true,
          installments_total: 12,
        }}
        userId="user-1"
      />
    )

    expect(screen.getByText('12 cuotas')).toBeInTheDocument()

    rerender(
      <TransactionItem
        transaction={{
          ...baseTransaction,
          description: 'Netflix',
          type: 'subscription',
          subscription_frequency: 'monthly',
        }}
        userId="user-1"
      />
    )

    expect(screen.getByText('FIJO MENSUAL')).toBeInTheDocument()
  })
})
