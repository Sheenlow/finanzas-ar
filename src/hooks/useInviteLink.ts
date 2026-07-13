'use client'

import { useState, useCallback } from 'react'

export function useInviteLink(householdId: string | null) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim() || !householdId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/households/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId, email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInviteLink(data.inviteLink)
      setInviteEmail('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [inviteEmail, householdId])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [inviteLink])

  return { inviteEmail, setInviteEmail, inviteLink, copied, loading, error, handleInvite, handleCopyLink }
}
