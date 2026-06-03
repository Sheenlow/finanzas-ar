'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="text-lg font-semibold">Error al cargar la página</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          No se pudieron cargar tus datos. Verificá tu conexión e intentá de nuevo.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
