'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { authService } from '@/services/authService.client'
import { useRouter } from 'next/navigation'
import { LogOut, Clock } from 'lucide-react'

const IDLE_TIMEOUT = 30 * 60 * 1000
const WARNING_BEFORE = 60 * 1000

export function SessionTimeout() {
  const [showWarning, setShowWarning] = useState(false)
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLogout = useCallback(async () => {
    await authService.signOut()
    router.push('/login')
    router.refresh()
  }, [router])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
    setShowWarning(false)
    warningRef.current = setTimeout(() => setShowWarning(true), IDLE_TIMEOUT - WARNING_BEFORE)
    timerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT)
  }, [handleLogout])

  const handleStayLoggedIn = useCallback(() => {
    setShowWarning(false)
    resetTimer()
  }, [resetTimer])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(event => window.addEventListener(event, resetTimer))

    warningRef.current = setTimeout(() => setShowWarning(true), IDLE_TIMEOUT - WARNING_BEFORE)
    timerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT)

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [resetTimer, handleLogout])

  return (
    <AnimatePresence>
      {showWarning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-timeout-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-card border border-border rounded-2xl p-8 shadow-xl max-w-sm w-full text-center space-y-4"
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 id="session-timeout-title" className="text-lg font-semibold">Sesión por vencer</h2>
            <p className="text-sm text-muted-foreground">
              Llevás un tiempo sin actividad. Si no respondés, cerraremos tu sesión por seguridad.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleStayLoggedIn}
                className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Seguir conectado
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 flex-1 border border-border py-2.5 rounded-xl font-medium hover:bg-secondary transition-all"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
