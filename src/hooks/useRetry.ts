'use client'

import { useRef, useCallback, useState } from 'react'

export function useRetry<T>(
  fn: () => Promise<T>,
  deps: unknown[] = []
) {
  const [state, setState] = useState<{
    loading: boolean
    error: string | null
    data: T | null
  }>({ loading: false, error: null, data: null })

  const fnRef = useRef(fn)
  fnRef.current = fn

  const execute = useCallback(async () => {
    setState({ loading: true, error: null, data: null })
    try {
      const result = await fnRef.current()
      setState({ loading: false, error: null, data: result })
      return result
    } catch (err: any) {
      const message = err?.message || 'Ocurrió un error inesperado'
      setState({ loading: false, error: message, data: null })
      return null
    }
  }, deps)

  const retry = useCallback(() => {
    execute()
  }, [execute])

  return {
    execute,
    loading: state.loading,
    error: state.error,
    data: state.data,
    retry,
  }
}
