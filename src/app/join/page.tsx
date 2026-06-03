'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, Users } from 'lucide-react'

function JoinContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'logged_out' | 'invalid' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }

    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setStatus('logged_out')
        return
      }

      const res = await fetch('/api/households/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setTimeout(() => router.push('/hogar'), 2000)
      } else {
        setStatus('error')
        setErrorMsg(data.error || 'Error al aceptar invitación')
      }
    }

    checkAuth()
  }, [token, router])

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Users className="w-8 h-8 text-primary" />
      </div>

      {status === 'loading' && (
        <div className="space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verificando invitación...</p>
        </div>
      )}

      {status === 'logged_out' && (
        <div className="space-y-4">
          <XCircle className="w-12 h-12 mx-auto text-amber-500" />
          <h1 className="text-xl font-bold">Inicia sesión para continuar</h1>
          <p className="text-sm text-muted-foreground">
            Necesitás iniciar sesión con el email al que se envió la invitación.
          </p>
          <Link
            href={`/login?redirect=/join?token=${token}`}
            className="block w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Iniciar sesión
          </Link>
        </div>
      )}

      {status === 'invalid' && (
        <div className="space-y-4">
          <XCircle className="w-12 h-12 mx-auto text-rose-500" />
          <h1 className="text-xl font-bold">Invitación no válida</h1>
          <p className="text-sm text-muted-foreground">
            El enlace que usaste no tiene un token de invitación válido.
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
          <h1 className="text-xl font-bold">¡Ya sos parte del hogar!</h1>
          <p className="text-sm text-muted-foreground">Redirigiendo a la gestión del hogar...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <XCircle className="w-12 h-12 mx-auto text-rose-500" />
          <h1 className="text-xl font-bold">Error al unirse</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <button
            onClick={() => router.push('/hogar')}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Ir a mi hogar
          </button>
        </div>
      )}
    </div>
  )
}

export default function JoinPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Suspense fallback={
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      }>
        <JoinContent />
      </Suspense>
    </div>
  )
}
