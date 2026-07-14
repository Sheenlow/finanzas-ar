'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ArrowRightLeft, Home, Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { accountsService } from '@/services/accountsService'
import { transactionsService } from '@/services/transactionsService'
import { extractKeywords } from '@/services/bot/parser'
import { saveKeywordRule } from '@/services/bot/keywords'

const TOTAL_STEPS = 3

interface OnboardingWizardProps {
  userId: string
  onComplete: () => void
}

export function OnboardingWizard({ userId, onComplete }: OnboardingWizardProps) {
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [direction, setDirection] = useState(1)

  const [accountName, setAccountName] = useState('Efectivo')
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null)

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([])

  const [householdName, setHouseholdName] = useState('Mi Hogar')
  const [showCreateHousehold, setShowCreateHousehold] = useState(false)

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase
        .from('categories')
        .select('id, name, color')
        .eq('type', 'expense')
        .order('name')
      if (data) setCategories(data)
    }
    loadCategories()
  }, [supabase])

  const nextStep = () => { setDirection(1); setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)) }
  const prevStep = () => { setDirection(-1); setStep(s => Math.max(s - 1, 0)) }

  const handleSkip = async () => {
    setLoading(true)
    try {
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', userId)
    } catch {}
    setLoading(false)
    onComplete()
  }

  const handleCreateAccount = async () => {
    setLoading(true)
    try {
      const account = await accountsService.create(supabase, {
        user_id: userId,
        name: accountName.trim() || 'Efectivo',
        type: 'cash',
        currency: 'ARS',
        balance: 0,
        color: 'var(--color-peso)',
      })
      setCreatedAccountId(account.id)
      nextStep()
    } catch (err: any) {
      alert(err.message || 'Error al crear la cuenta')
    }
    setLoading(false)
  }

  const handleCreateTransaction = async () => {
    if (!createdAccountId || !amount || !categoryId) return
    setLoading(true)
    try {
      const selectedCategory = categories.find(c => c.id === categoryId)
      await transactionsService.create(supabase, {
        user_id: userId,
        account_id: createdAccountId,
        description: description || 'Primer gasto',
        amount: parseFloat(amount),
        currency: 'ARS',
        type: 'expense',
        category_id: categoryId,
        payment_method: 'cash',
        transaction_date: new Date().toISOString(),
        is_installment: false,
      })

      if (description && selectedCategory) {
        const keywords = extractKeywords(description)
        for (const kw of keywords) {
          await saveKeywordRule(supabase, userId, kw, 'category_name', selectedCategory.name).catch(() => {})
        }
      }

      nextStep()
    } catch (err: any) {
      alert(err.message || 'Error al registrar el gasto')
    }
    setLoading(false)
  }

  const handleCreateHousehold = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/households/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: householdName.trim() || 'Mi Hogar' }),
      })
      if (!res.ok) throw new Error('Error al crear el hogar')
    } catch (err: any) {
      alert(err.message || 'Error al crear el hogar')
    }
    setLoading(false)
    await handleSkip()
  }

  const canAdvanceStep = () => {
    if (step === 0) return accountName.trim().length > 0
    if (step === 1) return amount && categoryId && createdAccountId
    return true
  }

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -200 : 200, opacity: 0 }),
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-16 sm:pt-24 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Paso {step + 1} de {TOTAL_STEPS}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {step === 0 ? 'Cuenta' : step === 1 ? 'Primer gasto' : 'Hogar'}
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm"
          >
            {step === 0 && (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Creá tu primera cuenta</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Empezá con una cuenta de efectivo en pesos
                    </p>
                  </div>
                </div>
                <label className="block mb-1.5 text-sm font-medium text-foreground">
                  Nombre de la cuenta
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-border outline-none transition-all"
                  placeholder="Efectivo"
                  autoFocus
                />
                <div className="flex items-center gap-2 mt-4 p-3 bg-secondary/50 rounded-xl">
                  <span className="text-xs text-muted-foreground">Tipo:</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Efectivo</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">ARS</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Saldo $0</span>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Registrá tu primer gasto</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Anotá un consumo para empezar a trackear
                    </p>
                  </div>
                </div>

                <label className="block mb-1.5 text-sm font-medium text-foreground">Descripción</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-border outline-none transition-all mb-4"
                  placeholder="Ej: Café con medialunas"
                  autoFocus
                />

                <label className="block mb-1.5 text-sm font-medium text-foreground">Monto (ARS)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-border outline-none transition-all mb-4"
                  placeholder="2500"
                  step="0.01"
                  min="0"
                />

                <label className="block mb-1.5 text-sm font-medium text-foreground">Categoría</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-border outline-none transition-all mb-4 cursor-pointer"
                >
                  <option value="">Seleccionar categoría...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl">
                  <span className="text-xs text-muted-foreground">Cuenta:</span>
                  <span className="text-xs font-medium text-foreground">{accountName || 'Efectivo'}</span>
                  <span className="text-xs text-muted-foreground">· ARS · Pago en efectivo</span>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">¿Vivís con alguien?</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Podés compartir gastos con tu familia o compañeros
                    </p>
                  </div>
                </div>

                {showCreateHousehold ? (
                  <>
                    <label className="block mb-1.5 text-sm font-medium text-foreground">
                      Nombre del hogar
                    </label>
                    <input
                      type="text"
                      value={householdName}
                      onChange={e => setHouseholdName(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-border outline-none transition-all mb-4"
                      placeholder="Mi Hogar"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateHousehold}
                      disabled={loading || !householdName.trim()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? 'Creando...' : (
                        <>
                          <Check className="w-4 h-4" />
                          Crear hogar y finalizar
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-5">
                      Crear un hogar te permite dividir gastos automáticamente con los miembros de tu casa.
                      Podés invitar a otros usuarios más tarde.
                    </p>
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowCreateHousehold(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                      >
                        <Home className="w-4 h-4" />
                        Crear hogar
                      </button>
                      <button
                        type="button"
                        onClick={handleSkip}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        {loading ? 'Finalizando...' : 'Lo haré después'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-4 gap-3">
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 cursor-pointer disabled:opacity-50"
          >
            Saltar onboarding
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prevStep}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
            )}

            {step < TOTAL_STEPS - 1 && (
              <button
                type="button"
                onClick={nextStep}
                disabled={loading || (step === 1 && (!amount || !categoryId))}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {step < TOTAL_STEPS - 1 && (
          <div className="mt-8">
            <button
              type="button"
              onClick={step === 0 ? handleCreateAccount : handleCreateTransaction}
              disabled={loading || !canAdvanceStep()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? (
                <motion.div
                  className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {step === 0 ? 'Crear cuenta' : 'Registrar gasto'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
