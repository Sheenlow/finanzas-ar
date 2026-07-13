import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/components/ThemeProvider'

function TestChild() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button data-testid="toggle" onClick={toggleTheme}>Toggle</button>
    </div>
  )
}

function mockMatchMedia(matches = false) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
  })

  it('renderiza children correctamente', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    mockMatchMedia(false)

    render(
      <ThemeProvider>
        <div data-testid="child">Hello</div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('toggle cambia entre light y dark', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    mockMatchMedia(false)

    render(
      <ThemeProvider>
        <TestChild />
      </ThemeProvider>
    )

    await act(async () => {
      screen.getByTestId('toggle').click()
    })

    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('detecta preferencia del sistema con matchMedia mock', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    mockMatchMedia(true)

    render(
      <ThemeProvider>
        <TestChild />
      </ThemeProvider>
    )

    await vi.waitFor(() => {
      expect(screen.getByTestId('theme').textContent).toBe('dark')
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
