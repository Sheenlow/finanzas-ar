'use client'

import { useEffect } from 'react'

export default function Error({
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md mx-auto p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
          <span className="text-2xl">!</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">
          Ocurrió un error inesperado. Intentá de nuevo.
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
