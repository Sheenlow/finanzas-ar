'use client'

import { Suspense, useState } from 'react'
import { authService } from '@/services/authService'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const { error: loginError } = await authService.signInWithEmail(email, password)

    if (loginError) {
      setError('Credenciales incorrectas. Por favor, intente nuevamente.')
      setLoading(false)
    } else {
      router.push(redirectTo)
      router.refresh()
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error: googleError } = await authService.signInWithGoogle()
    if (googleError) {
      setError('No pudimos iniciar sesión con Google. Intente de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Iniciar Sesión</h1>
            <p className="text-muted-foreground text-sm mt-1">Bienvenido de nuevo a Finanzas AR</p>
        </div>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all"
            required
          />
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
          </div>
        </div>

        <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 border border-border py-2 rounded-xl text-sm font-medium hover:bg-secondary transition-all disabled:opacity-50"
        >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
            Google
        </button>

        <p className="text-center text-sm text-muted-foreground">
          ¿Aún no tienes cuenta? <Link href="/signup" className="text-primary font-semibold hover:underline">Registrarse</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
