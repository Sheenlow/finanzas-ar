import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GoalItem from '@/components/GoalItem'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({})),
}))

vi.mock('@/services/savingsGoalsService', () => ({
  savingsGoalsService: {
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

vi.mock('@/components/forms/GoalForm', () => ({
  GoalForm: () => <div>GoalForm Mock</div>,
}))

describe('GoalItem', () => {
  const goal = {
    id: '1',
    user_id: 'user-1',
    household_id: null,
    name: 'Vacaciones',
    target_amount: 500000,
    current_amount: 250000,
    currency: 'ARS' as const,
    target_date: null,
    created_at: '2026-01-01',
    updated_at: '2026-07-01',
  }

  it('renderiza nombre de meta, target y current amount', () => {
    const { container } = render(
      <GoalItem
        goal={goal}
        userId="user-1"
        onUpdate={vi.fn()}
      />
    )

    expect(screen.getByText('Vacaciones')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('250') && content.includes('000'))).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('500') && content.includes('000'))).toBeInTheDocument()
  })

  it('barra de progreso muestra porcentaje correcto', () => {
    const { container } = render(
      <GoalItem
        goal={goal}
        userId="user-1"
        onUpdate={vi.fn()}
      />
    )

    expect(screen.getByText('50% completado')).toBeInTheDocument()

    const progressFill = container.querySelector('[style*="width"]') as HTMLElement
    expect(progressFill).not.toBeNull()
    expect(progressFill.style.width).toBe('50%')
  })
})
