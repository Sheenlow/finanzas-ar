'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Home, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useUser } from '@/components/UserProvider'
import { Alert } from '@/components/ui/Alert'

function splitFullName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' }
  const firstName = parts.slice(0, -1).join(' ')
  const lastName = parts[parts.length - 1]
  return { firstName, lastName }
}

function getInitials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserMenu() {
  const { user, profile, household, loading, refresh } = useUser()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const [editName, setEditName] = useState('')
  const [editCurrency, setEditCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)

  const userData = useMemo(() => {
    if (!user) return null
    const fullName = profile?.full_name || user.fullName
    const { firstName, lastName } = splitFullName(fullName)
    return { email: user.email, fullName, firstName, lastName }
  }, [user, profile])

  useEffect(() => {
    if (userData) {
      setEditName(userData.fullName)
    }
    if (profile) {
      setEditCurrency(profile.preferred_currency)
    }
  }, [userData, profile])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaveMessage('')
    try {
      const supabase = createClient()
      if (!user?.id) throw new Error('No autenticado')

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: editName.trim(),
          preferred_currency: editCurrency,
        }, { onConflict: 'id' })

      if (error) throw error

      refresh()
      setSaveMessage('Guardado correctamente')
      setTimeout(() => setModalOpen(false), 800)
    } catch (err: any) {
      setSaveMessage('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !userData) return null

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
            {getInitials(userData.fullName)}
          </div>
          <span className="text-sm font-medium truncate">{userData.fullName || userData.email}</span>
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-slide-down">
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-sm font-semibold truncate">{userData.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{userData.email}</p>
              </div>
              {household && (
                <Link
                  href="/hogar"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary transition-colors"
                >
                  <Home className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{household.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto uppercase">
                    {household.role === 'admin' ? 'Admin' : 'Miembro'}
                  </span>
                </Link>
              )}
              <button
                onClick={() => { setDropdownOpen(false); setModalOpen(true) }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
              >
                Ver mis datos
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-5 animate-scale-in"
            >
              <div className="flex items-center justify-between">
                <h2 id="profile-modal-title" className="text-lg font-semibold">Mis datos</h2>
                <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col items-center gap-3 pb-2">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                  {getInitials(userData.fullName)}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1 block">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm"
                    placeholder="Tu nombre"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1 block">
                    Moneda preferida
                  </label>
                  <select
                    value={editCurrency}
                    onChange={e => setEditCurrency(e.target.value as 'ARS' | 'USD')}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-card"
                  >
                    <option value="ARS">ARS - Peso argentino</option>
                    <option value="USD">USD - Dólar estadounidense</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Email</label>
                  <p className="text-sm font-medium mt-0.5">{userData.email}</p>
                </div>

                {household && (
                  <div>
                    <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Hogar</label>
                    <p className="text-sm font-medium mt-0.5">{household.name} ({household.role === 'admin' ? 'Admin' : 'Miembro'})</p>
                  </div>
                )}
              </div>

              {saveMessage && (
                <Alert variant={saveMessage.startsWith('Error') ? 'error' : 'success'}>
                  {saveMessage}
                </Alert>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving || !editName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
