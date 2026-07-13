import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockAuthGetUser, mockLimitFn } = vi.hoisted(() => ({
  mockAuthGetUser: vi.fn(),
  mockLimitFn: vi.fn(),
}))

const mockAdminFrom = vi.fn()

function adminChain(response: any = { data: null, error: null }) {
  const resolve = () => Promise.resolve(response)
  const chain: any = {
    then: (onFulfilled: any, onRejected: any) => resolve().then(onFulfilled, onRejected),
    catch: (onRejected: any) => resolve().catch(onRejected),
  }
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order']
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain.single = vi.fn().mockResolvedValue(response)
  chain.maybeSingle = vi.fn().mockResolvedValue(response)
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockAuthGetUser },
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}))

vi.mock('@/lib/security', () => ({
  requireOrigin: vi.fn(() => true),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/lib/rateLimit', () => ({
  generalLimiter: { limit: mockLimitFn },
}))

import { POST } from '@/app/api/goals/deposit/route'

function makeRequest(body: any) {
  return new Request('http://localhost:3000/api/goals/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/goals/deposit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role')
    mockLimitFn.mockResolvedValue({ success: true })
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'test@test.com' } }, error: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('POST valido actualiza current_amount', async () => {
    const goalChain = adminChain({
      data: {
        id: 'goal-1',
        user_id: 'user-1',
        household_id: null,
        current_amount: 5000,
        target_amount: 20000,
      },
      error: null,
    })
    const depositChain = adminChain()
    const updateChain = adminChain()
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'savings_goals') return goalChain
      if (table === 'goal_deposits') return depositChain
      return updateChain
    })

    const req = makeRequest({ goalId: 'goal-1', amount: 5000 })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.newAmount).toBe(10000)
  })

  it('POST a meta ajena retorna 403', async () => {
    const goalChain = adminChain({
      data: {
        id: 'goal-1',
        user_id: 'other-user',
        household_id: null,
        current_amount: 5000,
        target_amount: 20000,
      },
      error: null,
    })
    const memberChain = adminChain({ data: null, error: null })
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'savings_goals') return goalChain
      if (table === 'household_members') return memberChain
      return adminChain()
    })

    const req = makeRequest({ goalId: 'goal-1', amount: 5000 })
    const res = await POST(req)

    expect(res.status).toBe(403)
  })

  it('POST con monto negativo retorna 400', async () => {
    const req = makeRequest({ goalId: 'goal-1', amount: -100 })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('POST sin sesion retorna 401', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const req = makeRequest({ goalId: 'goal-1', amount: 5000 })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })
})
