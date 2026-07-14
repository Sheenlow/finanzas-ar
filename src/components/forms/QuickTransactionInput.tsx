'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Check, Pencil, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { parseText, extractKeywords } from '@/services/bot/parser'
import { saveKeywordRule, getKeywordRules } from '@/services/bot/keywords'
import { transactionsService } from '@/services/transactionsService'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import type { ParsedTransaction, KeywordRule } from '@/services/bot/types'

function formatMoney(amount: number, currency: string) {
  if (currency === 'ARS') {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, minimumFractionDigits: 2 }).format(amount)
}

function resolveCategoryId(categories: { id: string; name: string }[], categoryName: string | null) {
  if (!categoryName) return null
  const match = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
  return match?.id || null
}

interface QuickTransactionInputProps {
  userId: string
  onSuccess?: () => void
  className?: string
}

export function QuickTransactionInput({ userId, onSuccess, className }: QuickTransactionInputProps) {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [showFallback, setShowFallback] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const [accounts, setAccounts] = useState<{ id: string; name: string; currency: string; type: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [keywordRules, setKeywordRules] = useState<KeywordRule[]>([])

  const debouncedText = useDebounce(text, 250)

  const [editCategory, setEditCategory] = useState(false)
  const [editAccount, setEditAccount] = useState(false)

  const [fallbackDescription, setFallbackDescription] = useState('')
  const [fallbackAmount, setFallbackAmount] = useState('')
  const [fallbackCategoryId, setFallbackCategoryId] = useState('')
  const [fallbackAccountId, setFallbackAccountId] = useState('')
  const [fallbackType, setFallbackType] = useState<'expense' | 'income'>('expense')
  const [fallbackPaymentMethod, setFallbackPaymentMethod] = useState('cash')

  useEffect(() => {
    async function load() {
      try {
        const [{ data: accData }, { data: catData }, rules] = await Promise.all([
          supabase.from('accounts').select('id, name, currency, type').eq('user_id', userId).order('created_at'),
          supabase.from('categories').select('id, name').eq('type', 'expense').order('name'),
          getKeywordRules(supabase, userId),
        ])
        setAccounts((accData || []) as any[])
        setCategories(catData || [])
        setKeywordRules(rules)
        if (accData?.[0]) setFallbackAccountId(accData[0].id)
        if (catData?.[0]) setFallbackCategoryId(catData[0].id)
      } catch {}
    }
    load()
  }, [userId, supabase])

  const parsed = useMemo(() => {
    if (!debouncedText.trim()) return null
    const accs = accounts.map(a => ({ id: a.id, name: a.name, currency: a.currency, type: a.type }))
    return parseText(debouncedText, accs, categories, keywordRules)
  }, [debouncedText, accounts, categories, keywordRules])

  const parsedCategoryId = useMemo(
    () => resolveCategoryId(categories, parsed?.categoryName || null),
    [categories, parsed?.categoryName]
  )

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedCategoryId(parsedCategoryId)
  }, [parsedCategoryId])

  useEffect(() => {
    setSelectedAccountId(parsed?.accountId || accounts[0]?.id || null)
  }, [parsed?.accountId, accounts])

  const handleChangeCategory = useCallback(async (newCategoryId: string) => {
    setSelectedCategoryId(newCategoryId)
    setEditCategory(false)
    if (parsed?.description) {
      const keywords = extractKeywords(parsed.description)
      const newCat = categories.find(c => c.id === newCategoryId)
      if (newCat) {
        for (const kw of keywords) {
          await saveKeywordRule(supabase, userId, kw, 'category_name', newCat.name).catch(() => {})
        }
      }
    }
  }, [parsed, categories, supabase, userId])

  const handleChangeAccount = useCallback(async (newAccountId: string) => {
    setSelectedAccountId(newAccountId)
    setEditAccount(false)
    if (parsed?.description) {
      const keywords = extractKeywords(parsed.description)
      const newAcc = accounts.find(a => a.id === newAccountId)
      if (newAcc) {
        for (const kw of keywords) {
          await saveKeywordRule(supabase, userId, kw, 'account_name', newAcc.name).catch(() => {})
        }
      }
    }
  }, [parsed, accounts, supabase, userId])

  const handleConfirm = useCallback(async () => {
    const accountId = selectedAccountId || parsed?.accountId
    if (!accountId) return

    setLoading(true)
    try {
      await transactionsService.create(supabase, {
        user_id: userId,
        account_id: accountId,
        description: parsed?.description || 'Gasto',
        amount: parsed?.amount || 0,
        currency: parsed?.currency || 'ARS',
        type: parsed?.type || 'expense',
        category_id: selectedCategoryId || parsedCategoryId || null,
        payment_method: parsed?.paymentMethod || 'cash',
        transaction_date: new Date().toISOString(),
        is_installment: false,
      } as any)

      if (parsed?.description) {
        const keywords = extractKeywords(parsed.description)
        const cat = categories.find(c => c.id === (selectedCategoryId || parsedCategoryId))
        for (const kw of keywords) {
          if (cat) await saveKeywordRule(supabase, userId, kw, 'category_name', cat.name).catch(() => {})
        }
      }

      setText('')
      setShowFallback(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
      onSuccess?.()
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'Error al crear la transacción')
    }
    setLoading(false)
  }, [parsed, selectedAccountId, selectedCategoryId, parsedCategoryId, categories, supabase, userId, onSuccess, router])

  const handleFallbackSubmit = useCallback(async () => {
    if (!fallbackAccountId || !fallbackAmount || !fallbackCategoryId) return
    setLoading(true)
    try {
      await transactionsService.create(supabase, {
        user_id: userId,
        account_id: fallbackAccountId,
        description: fallbackDescription || 'Gasto manual',
        amount: parseFloat(fallbackAmount),
        currency: 'ARS',
        type: fallbackType,
        category_id: fallbackCategoryId,
        payment_method: fallbackPaymentMethod,
        transaction_date: new Date().toISOString(),
        is_installment: false,
      } as any)

      if (fallbackDescription) {
        const keywords = extractKeywords(fallbackDescription)
        const cat = categories.find(c => c.id === fallbackCategoryId)
        for (const kw of keywords) {
          if (cat) await saveKeywordRule(supabase, userId, kw, 'category_name', cat.name).catch(() => {})
        }
      }

      setText('')
      setFallbackDescription('')
      setFallbackAmount('')
      setShowFallback(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
      onSuccess?.()
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'Error al crear la transacción')
    }
    setLoading(false)
  }, [fallbackAccountId, fallbackAmount, fallbackCategoryId, fallbackDescription, fallbackType, fallbackPaymentMethod, categories, supabase, userId, onSuccess, router])

  const selectedCat = categories.find(c => c.id === selectedCategoryId)
  const selectedAcc = accounts.find(a => a.id === selectedAccountId)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-border transition-all shadow-sm">
          <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            id="quick-txn-input"
            type="text"
            value={text}
            onChange={e => { setText(e.target.value); setShowFallback(false) }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            placeholder="Registrar gasto o ingreso (ej: cafe 2500 efectivo)"
            aria-label="Registrar gasto o ingreso. Ejemplo: cafe 2500 efectivo"
            disabled={loading}
          />
          {text && (
            <button
              type="button"
              onClick={() => { setText(''); setShowFallback(false) }}
              className="p-0.5 rounded-full hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 text-xs text-emerald-600 px-1"
          >
            <Check className="w-3.5 h-3.5" />
            Gasto registrado correctamente
          </motion.div>
        )}

        {!success && parsed && parsed.amount > 0 && !showFallback && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {parsed.description}
                </p>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {parsed.type === 'income' ? '+' : '-'}{formatMoney(parsed.amount, parsed.currency)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {editCategory ? (
                  <select
                    autoFocus
                    value={selectedCategoryId || ''}
                    onChange={e => handleChangeCategory(e.target.value)}
                    onBlur={() => setEditCategory(false)}
                    className="text-[10px] font-medium px-2 py-1 rounded-full bg-secondary border border-border cursor-pointer"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditCategory(true)}
                    className="flex items-center gap-0.5 text-[10px] font-medium px-2 py-1 rounded-full bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
                  >
                    {selectedCat?.name || 'Sin categoría'}
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                )}

                {editAccount ? (
                  <select
                    autoFocus
                    value={selectedAccountId || ''}
                    onChange={e => handleChangeAccount(e.target.value)}
                    onBlur={() => setEditAccount(false)}
                    className="text-[10px] font-medium px-2 py-1 rounded-full bg-secondary border border-border cursor-pointer"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditAccount(true)}
                    className="flex items-center gap-0.5 text-[10px] font-medium px-2 py-1 rounded-full bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
                  >
                    {selectedAcc?.name || 'Efectivo'}
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                {parsed.paymentMethod === 'cash' ? 'Efectivo' : parsed.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}
              </span>
              {parsed.installments > 1 && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {parsed.installments} cuotas
                </span>
              )}
              {parsed.type === 'income' && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Ingreso
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !selectedAccountId}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Registrando...' : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Registrar
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowFallback(true)
                if (parsed.description) setFallbackDescription(parsed.description)
                if (parsed.amount) setFallbackAmount(String(parsed.amount))
                if (selectedCategoryId) setFallbackCategoryId(selectedCategoryId)
                if (selectedAccountId) setFallbackAccountId(selectedAccountId)
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
            >
              No es lo que esperaba — completar manualmente
            </button>
          </motion.div>
        )}

        {!success && text && (!parsed || parsed.amount === 0 || showFallback) && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <Pencil className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Completar manualmente</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFallbackType('expense')}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer',
                  fallbackType === 'expense' ? 'bg-rose-100 text-rose-700' : 'bg-secondary text-muted-foreground'
                )}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setFallbackType('income')}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer',
                  fallbackType === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-secondary text-muted-foreground'
                )}
              >
                Ingreso
              </button>
            </div>

            <input
              type="text"
              value={fallbackDescription}
              onChange={e => setFallbackDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-border transition-all"
              placeholder="Descripción"
            />
            <input
              type="number"
              value={fallbackAmount}
              onChange={e => setFallbackAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-border transition-all"
              placeholder="Monto (ARS)"
              step="0.01"
              min="0"
            />
            <select
              value={fallbackCategoryId}
              onChange={e => setFallbackCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-border transition-all cursor-pointer"
            >
              <option value="">Seleccionar categoría...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={fallbackAccountId}
              onChange={e => setFallbackAccountId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-border transition-all cursor-pointer"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleFallbackSubmit}
              disabled={loading || !fallbackAccountId || !fallbackAmount || !fallbackCategoryId}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Registrando...' : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Registrar
                </>
              )}
            </button>

            {parsed && (
              <button
                type="button"
                onClick={() => setShowFallback(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
              >
                Volver al modo rápido
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
