'use client'

import { useState, useEffect } from 'react'
import { processQueue, getQueueSize } from '@/lib/offlineQueue'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, RefreshCw } from 'lucide-react'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (isOnline) {
      getQueueSize().then(setPendingCount)
    }
  }, [isOnline])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await processQueue()
      setPendingCount(pendingCount - result.processed)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <AnimatePresence>
      {(!isOnline || pendingCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between text-sm"
        >
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <WifiOff className="w-4 h-4" />
            {!isOnline ? (
              <span>Sin conexión. Los cambios se sincronizarán al reconectar.</span>
            ) : (
              <span>{pendingCount} transacción{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronización</span>
            )}
          </div>
          {isOnline && pendingCount > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1 px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
