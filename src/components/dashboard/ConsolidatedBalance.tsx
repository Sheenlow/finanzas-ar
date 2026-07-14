'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Landmark, ArrowRightLeft, TrendingUp, Wallet } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface Props {
  totalArs: number
  totalUsd: number
  rate: number
  hasAccounts?: boolean
  onCreateAccount?: () => void
}

export function ConsolidatedBalance({ totalArs, totalUsd, rate, hasAccounts = true, onCreateAccount }: Props) {
  const [preferredCurrency, setPreferredCurrency] = useState<'ARS' | 'USD'>('ARS')

  const consolidatedTotal = preferredCurrency === 'ARS' 
    ? totalArs + (totalUsd * rate)
    : totalUsd + (totalArs / rate)

  const formatCurrency = (val: number, currency: 'ARS' | 'USD') => {
    return new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'USD' ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(val)
  }

  if (!hasAccounts && onCreateAccount) {
    return (
      <motion.div className="animate-slide-up">
        <EmptyState
          icon={Wallet}
          title="Creá tu primera cuenta"
          description="Todavía no registraste ninguna cuenta. Agregá una cuenta para empezar a ver tu patrimonio consolidado."
          action={{ label: 'Crear cuenta', onClick: onCreateAccount }}
        />
      </motion.div>
    )
  }

  return (
    <motion.div className="p-6 bg-card border border-border/50 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-slide-up">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Landmark className="w-4 h-4" />
          <span>Patrimonio Neto Consolidado</span>
        </div>
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            {formatCurrency(consolidatedTotal, preferredCurrency)}
          </h2>
          <button 
            onClick={() => setPreferredCurrency(prev => prev === 'ARS' ? 'USD' : 'ARS')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold bg-secondary px-2.5 py-1 rounded-full border border-border transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-3 h-3" />
            <span>Ver en {preferredCurrency === 'ARS' ? 'USD' : 'ARS'}</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          <span>Tipo de cambio de referencia: 1 USD = {rate.toLocaleString('es-AR')} ARS</span>
        </p>
      </div>

      <div className="flex gap-4 w-full md:w-auto border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-6">
        <div className="flex-1 md:flex-initial">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">Total en Pesos</span>
          <span className="text-lg font-bold text-foreground">{formatCurrency(totalArs, 'ARS')}</span>
        </div>
        <div className="flex-1 md:flex-initial">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">Total en Dólares</span>
          <span className="text-lg font-bold text-foreground">{formatCurrency(totalUsd, 'USD')}</span>
        </div>
      </div>
    </motion.div>
  )
}
