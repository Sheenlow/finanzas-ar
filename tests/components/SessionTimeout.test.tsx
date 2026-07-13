import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { SessionTimeout } from '@/components/SessionTimeout'

const mockSignOut = vi.fn().mockResolvedValue(undefined)
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/services/authService.client', () => ({
  authService: {
    signOut: (...args: any[]) => mockSignOut(...args),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

const IDLE_TIMEOUT = 30 * 60 * 1000
const WARNING_BEFORE = 60 * 1000

describe('SessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra warning modal despues del tiempo de inactividad', async () => {
    render(<SessionTimeout />)

    expect(screen.queryByText('Sesión por vencer')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT - WARNING_BEFORE)
    })

    expect(screen.getByText('Sesión por vencer')).toBeInTheDocument()
  })

  it('click en boton de permanecer oculta modal y reinicia timer', async () => {
    render(<SessionTimeout />)

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT - WARNING_BEFORE)
    })

    expect(screen.getByText('Sesión por vencer')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('Seguir conectado'))
    })

    expect(screen.queryByText('Sesión por vencer')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT - WARNING_BEFORE)
    })

    expect(screen.getByText('Sesión por vencer')).toBeInTheDocument()
  })

  it('inactividad total llama a signOut', async () => {
    render(<SessionTimeout />)

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT)
    })

    expect(mockSignOut).toHaveBeenCalled()
  })
})
