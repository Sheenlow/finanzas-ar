import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockAuthSignUp, mockLimitFn } = vi.hoisted(() => ({
  mockAuthSignUp: vi.fn(),
  mockLimitFn: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { signUp: mockAuthSignUp },
  })),
}))

vi.mock('@/lib/security', () => ({
  requireOrigin: vi.fn(() => true),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/lib/rateLimit', () => ({
  registerLimiter: { limit: mockLimitFn },
}))

vi.mock('zxcvbn', () => ({
  default: vi.fn(() => ({ score: 3 })),
}))

import { POST } from '@/app/api/auth/register/route'
import zxcvbn from 'zxcvbn'

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
    vi.stubEnv('RECAPTCHA_SECRET_KEY', 'test-recaptcha-secret')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    vi.stubEnv('NODE_ENV', 'development')
    mockLimitFn.mockResolvedValue({ success: true, remaining: 4 })
    mockAuthSignUp.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@test.com' } },
      error: null,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('POST valido retorna success con user', async () => {
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'StrongP@ssw0rd!',
        firstName: 'Test',
        lastName: 'User',
        captchaToken: 'dev-token',
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.user).toBeDefined()
  })

  it('POST sin captchaToken ni dev-token retorna 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    }))

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'StrongP@ssw0rd!',
        firstName: 'Test',
        lastName: 'User',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('POST con password debil retorna 400', async () => {
    const mockedZxcvbn = vi.mocked(zxcvbn)
    mockedZxcvbn.mockReturnValue({ score: 1 } as any)

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User',
        captchaToken: 'dev-token',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST sin origin header retorna 403', async () => {
    const { requireOrigin } = await import('@/lib/security')
    const mockedRequireOrigin = vi.mocked(requireOrigin)
    mockedRequireOrigin.mockReturnValue(false)

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'StrongP@ssw0rd!',
        firstName: 'Test',
        lastName: 'User',
        captchaToken: 'dev-token',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)

    mockedRequireOrigin.mockReturnValue(true)
  })

  it('POST con rate limit excedido retorna 429', async () => {
    mockLimitFn.mockResolvedValue({ success: false, remaining: 0 })

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'StrongP@ssw0rd!',
        firstName: 'Test',
        lastName: 'User',
        captchaToken: 'dev-token',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(429)
  })
})
