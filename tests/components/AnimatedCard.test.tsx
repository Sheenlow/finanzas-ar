import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnimatedCard } from '@/components/AnimatedCard'

describe('AnimatedCard', () => {
  it('renderiza nombre de cuenta y balance', () => {
    render(
      <AnimatedCard
        title="Cuenta Principal"
        amount={150000}
        currency="ARS"
        type="bank"
      />
    )

    expect(screen.getByText('Cuenta Principal')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('150') && content.includes('000'))).toBeInTheDocument()
    expect(screen.getByText('ARS')).toBeInTheDocument()
  })

  it('muestra badge de tipo (bank/cash/crypto)', () => {
    const { rerender } = render(
      <AnimatedCard
        title="Test"
        amount={100}
        currency="ARS"
        type="bank"
      />
    )

    expect(screen.getByText('Banco')).toBeInTheDocument()

    rerender(
      <AnimatedCard
        title="Test"
        amount={100}
        currency="ARS"
        type="cash"
      />
    )

    expect(screen.getByText('Efectivo')).toBeInTheDocument()

    rerender(
      <AnimatedCard
        title="Test"
        amount={100}
        currency="USD"
        type="crypto"
      />
    )

    expect(screen.getByText('Crypto')).toBeInTheDocument()
  })
})
