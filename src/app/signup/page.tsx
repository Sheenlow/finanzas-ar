'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { motion, AnimatePresence } from 'framer-motion'
import zxcvbn from 'zxcvbn'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  
  const { executeRecaptcha } = useGoogleReCaptcha()
  const router = useRouter()

  const passwordStrength = zxcvbn(password)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!executeRecaptcha) {
      setError('El sistema de seguridad aún está cargando. Por favor, espera un segundo.')
      return
    }
    
    if (!acceptTerms) return setError('Debes aceptar los términos y condiciones.')
    if (passwordStrength.score < 3) return setError('La contraseña no es suficientemente fuerte.')

    setLoading(true)
    setError(null)

    try {
      let token = null;
      if (executeRecaptcha) {
          token = await executeRecaptcha('signup')
      } else if (process.env.NODE_ENV === 'development') {
          console.warn('reCAPTCHA saltado en desarrollo')
          token = 'dev-token' // Token ficticio para desarrollo
      }

      const apiUrl = `${window.location.origin}/api/auth/register`

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName, captchaToken: token })
      })

      const text = await res.text()

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Respuesta del servidor no es JSON válido (puede ser un error 500/404)');
      }

      if (!res.ok) throw new Error(data.error || 'Error al registrar')
      
      setShowSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <form onSubmit={handleSignUp} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input type="text" placeholder="Nombre" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl" required />
        <input type="text" placeholder="Apellido" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl" required />
      </div>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl" required />
      <div className="relative">
        <input 
          type={showPassword ? 'text' : 'password'} 
          placeholder="Contraseña" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" 
          required
          autoComplete="new-password"
        />
        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      
      {/* Password Strength Meter */}
      {password && (
        <div className="space-y-1">
          <div className="flex gap-1 h-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={cn("h-full flex-1 rounded", i <= passwordStrength.score + 1 ? "bg-primary" : "bg-secondary")} />
            ))}
          </div>
          <p className={cn("text-[10px] font-medium", passwordStrength.score < 3 ? "text-rose-600" : "text-emerald-600")}>
            Fuerza: {['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'][passwordStrength.score]}
            {passwordStrength.score < 3 && " (Se requiere nivel 'Fuerte' o superior)"}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="rounded" required />
        <label>Acepto los términos y condiciones</label>
      </div>

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      <button 
        type="submit" 
        disabled={loading || passwordStrength.score < 3} 
        className={cn(
          "w-full py-2 rounded-xl font-bold transition-all",
          (loading || passwordStrength.score < 3)
            ? "bg-secondary text-muted-foreground cursor-not-allowed" 
            : "bg-primary text-primary-foreground hover:opacity-90"
        )}
      >
        {loading ? 'Registrando...' : 'Registrarse'}
      </button>
    </form>

    <AnimatePresence>
      {showSuccess && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
              className="mx-auto w-14 h-14 rounded-full bg-income/10 flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-income" />
            </motion.div>
            <h2 className="text-lg font-semibold">Cuenta creada</h2>
            <p className="text-sm text-muted-foreground">
              Registro exitoso. Por favor revisa tu correo para confirmar tu cuenta.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Ir al inicio de sesión
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}

export default function SignUpPage() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}>
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <h1 className="text-2xl font-bold text-center">Crear cuenta</h1>
          <SignUpForm />
        </div>
      </div>
    </GoogleReCaptchaProvider>
  )
}
