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

import { POST as createHousehold } from '@/app/api/households/create/route'
import { POST as inviteMember } from '@/app/api/households/invite/route'
import { POST as acceptInvite } from '@/app/api/households/accept/route'
import { DELETE as deleteHousehold } from '@/app/api/households/delete/route'

function makeRequest(path: string, body: any, method = 'POST') {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  })
}

describe('Households API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    mockLimitFn.mockResolvedValue({ success: true })
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'test@test.com' } }, error: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('POST /create', () => {
    it('retorna household', async () => {
      const hhChain = adminChain({ data: { id: 'hh-1', name: 'Mi Hogar' }, error: null })
      const memberChain = adminChain()
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'households') return hhChain
        if (table === 'household_members') return memberChain
        return adminChain()
      })

      const req = makeRequest('/api/households/create', { name: 'Mi Hogar' })
      const res = await createHousehold(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.household).toBeDefined()
      expect(body.household.name).toBe('Mi Hogar')
    })

    it('sin auth retorna 401', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null }, error: null })

      const req = makeRequest('/api/households/create', { name: 'Mi Hogar' })
      const res = await createHousehold(req)

      expect(res.status).toBe(401)
    })
  })

  describe('POST /invite', () => {
    it('genera invitacion', async () => {
      const inviteChain = adminChain()
      mockAdminFrom.mockReturnValue(inviteChain)

      const req = makeRequest('/api/households/invite', { householdId: '00000000-0000-4000-8000-000000000001', email: 'invited@test.com' })
      const res = await inviteMember(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.inviteLink).toBeDefined()
      expect(body.token).toBeDefined()
    })
  })

  describe('POST /accept', () => {
    it('con token valido retorna success', async () => {
      const inviteChain = adminChain({
        data: {
          id: 'inv-1',
          household_id: 'hh-1',
          invited_email: 'test@test.com',
          token: 'valid-token',
          status: 'pending',
        },
        error: null,
      })
      const memberChain = adminChain()
      const updateChain = adminChain()
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'invitations') return inviteChain
        if (table === 'household_members') return memberChain
        return updateChain
      })

      const req = makeRequest('/api/households/accept', { token: 'valid-token' })
      const res = await acceptInvite(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('con token invalido retorna error', async () => {
      const inviteChain = adminChain({ data: null, error: { message: 'not found' } })
      mockAdminFrom.mockReturnValue(inviteChain)

      const req = makeRequest('/api/households/accept', { token: 'bad-token' })
      const res = await acceptInvite(req)

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /delete', () => {
    it('como admin funciona, como member retorna 403', async () => {
      const adminMemberChain = adminChain({
        data: { household_id: 'hh-1', role: 'admin' },
        error: null,
      })
      const deleteChain = adminChain()
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'household_members') return adminMemberChain
        if (table === 'households') return deleteChain
        return adminChain()
      })

      const req = makeRequest('/api/households/delete', {}, 'DELETE')
      const res = await deleteHousehold(req)

      expect(res.status).toBe(200)

      vi.clearAllMocks()
      mockLimitFn.mockResolvedValue({ success: true })
      mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })

      const memberChain = adminChain({ data: null, error: null })
      mockAdminFrom.mockReturnValue(memberChain)

      const req2 = makeRequest('/api/households/delete', {}, 'DELETE')
      const res2 = await deleteHousehold(req2)

      expect(res2.status).toBe(403)
    })
  })
})
