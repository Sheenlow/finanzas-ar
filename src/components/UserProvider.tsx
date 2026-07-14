'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserContextValue {
  user: { id: string; email: string; fullName: string } | null
  profile: { full_name: string | null; preferred_currency: 'ARS' | 'USD'; onboarding_completed: boolean } | null
  household: { id: string; name: string; role: 'admin' | 'member' } | null
  loading: boolean
  refresh: () => void
}

const UserContext = createContext<UserContextValue>({
  user: null,
  profile: null,
  household: null,
  loading: true,
  refresh: () => {},
})

export function useUser() {
  return useContext(UserContext)
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserContextValue['user']>(null)
  const [profile, setProfile] = useState<UserContextValue['profile']>(null)
  const [household, setHousehold] = useState<UserContextValue['household']>(null)
  const [loading, setLoading] = useState(true)
  const hasUser = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        hasUser.current = true
        const fullName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || ''
        setUser({ id: authUser.id, email: authUser.email || '', fullName })

        const [{ data: profileData }, { data: membership }] = await Promise.all([
          supabase.from('profiles').select('preferred_currency, full_name, onboarding_completed').eq('id', authUser.id).maybeSingle(),
          supabase.from('household_members').select('households(id, name), role').eq('user_id', authUser.id).maybeSingle(),
        ])

        setProfile({
          full_name: profileData?.full_name || null,
          preferred_currency: profileData?.preferred_currency || 'ARS',
          onboarding_completed: profileData?.onboarding_completed ?? false,
        })

        if (membership) {
          const hh = membership as unknown as { households: { id: string; name: string } | null; role: string }
          setHousehold({
            id: hh.households?.id || '',
            name: hh.households?.name || '',
            role: hh.role as 'admin' | 'member',
          })
        } else {
          setHousehold(null)
        }
      } else {
        setUser(null)
        setProfile(null)
        setHousehold(null)
      }
    } catch {
      if (!hasUser.current) {
        setUser(null)
        setProfile(null)
        setHousehold(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <UserContext.Provider value={{ user, profile, household, loading, refresh: load }}>
      {children}
    </UserContext.Provider>
  )
}
