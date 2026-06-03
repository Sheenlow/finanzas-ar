'use client'

import { useState, useMemo, useEffect } from 'react'
import { Filter, ChevronLeft, ChevronRight, ArrowRightLeft, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  transactions: any[]
  selectedMonth: string
  exchangeRate: number
  cryptoPrices: { btc: number; eth: number }
}

function getTypeBadge(type: string, isInstallment: boolean, categoryName?: string) {
  if (isInstallment) return { label: 'Cuota', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' }
  if (type === 'subscription') return { label: 'Suscripción', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' }
  if (type === 'service' || categoryName === 'Servicios') return { label: 'Servicio', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' }
  return { label: 'Gasto', className: 'bg-muted text-muted-foreground' }
}

const formatCurrency = (val: number, currency: 'ARS' | 'USD') => {
  return new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(val)
}

export function MonthlyFixedExpensesReport({ transactions, selectedMonth, exchangeRate, cryptoPrices }: Props) {
  const [preferredCurrency, setPreferredCurrency] = useState<'ARS' | 'USD'>('ARS')

  const fixedExpenses = useMemo(() => {
    return transactions.filter(t => {
      const isCurrentMonth = t.transaction_date.startsWith(selectedMonth)
      const isFixed =
        t.type === 'subscription' || t.type === 'service' || t.is_installment === true ||
        (t as any).categories?.name === 'Servicios'
      const isParent = !t.parent_transaction_id || t.id === t.parent_transaction_id
      return isCurrentMonth && isFixed && isParent
    })
  }, [transactions, selectedMonth])

  const { totalArs, totalUsd } = useMemo(() => {
    let ars = 0
    let usd = 0

    fixedExpenses.forEach(t => {
      if (t.currency === 'ARS') {
        ars += t.amount
      } else if (t.currency === 'USD' || t.currency === 'USDT' || t.currency === 'USDC') {
        usd += t.amount
      } else if (t.currency === 'BTC') {
        usd += t.amount * cryptoPrices.btc
      } else if (t.currency === 'ETH') {
        usd += t.amount * cryptoPrices.eth
      }
    })

    return { totalArs: ars, totalUsd: usd }
  }, [fixedExpenses, cryptoPrices])

  const consolidatedTotal = preferredCurrency === 'ARS'
    ? totalArs + (totalUsd * exchangeRate)
    : totalUsd + (totalArs / exchangeRate)

  const [filters, setFilters] = useState({
    description: '',
    minAmount: '',
    maxAmount: '',
    type: '',
    account: ''
  })
  const [tempFilters, setTempFilters] = useState(filters)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const openFilter = (key: string) => {
    setTempFilters(filters)
    setActiveFilter(key)
  }

  const applyFilters = () => {
    setFilters(tempFilters)
    setActiveFilter(null)
  }

  const cancelFilters = () => {
    setTempFilters(filters)
    setActiveFilter(null)
  }

  const clearFilters = () => {
    const initial = { description: '', minAmount: '', maxAmount: '', type: '', account: '' }
    setFilters(initial)
    setTempFilters(initial)
  }

  const filteredItems = useMemo(() => {
    return fixedExpenses.filter(item => {
      const matchesDescription = item.description?.toLowerCase().includes(filters.description.toLowerCase())
      const matchesMin = filters.minAmount === '' || item.amount >= parseFloat(filters.minAmount)
      const matchesMax = filters.maxAmount === '' || item.amount <= parseFloat(filters.maxAmount)
      const matchesType = filters.type === '' || item.type === filters.type
      const matchesAccount = filters.account === '' || item.accounts?.name === filters.account
      return matchesDescription && matchesMin && matchesMax && matchesType && matchesAccount
    })
  }, [fixedExpenses, filters])

  useEffect(() => {
    setCurrentPage(1)
  }, [filters, pageSize])

  const uniqueAccounts = useMemo(() => {
    const names = new Set(fixedExpenses.map(item => item.accounts?.name).filter(Boolean))
    return Array.from(names).sort()
  }, [fixedExpenses])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, safePage, pageSize])

  return (
    <div className="space-y-6 bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Informe de Gastos Fijos Mensual</h2>
        <button
          onClick={clearFilters}
          className="text-xs px-3 py-1.5 rounded-lg border border-border/60 bg-background/50 text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-border transition-colors"
        >
          Limpiar filtros
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-secondary/40 rounded-xl p-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">Total en Pesos</span>
          <span className="text-xl font-bold text-foreground">{formatCurrency(totalArs, 'ARS')}</span>
        </div>
        <div className="bg-secondary/40 rounded-xl p-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">Total en Dólares</span>
          <span className="text-xl font-bold text-foreground">{formatCurrency(totalUsd, 'USD')}</span>
        </div>
        <div className="bg-secondary/40 rounded-xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">Gasto Neto Consolidado</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">{formatCurrency(consolidatedTotal, preferredCurrency)}</span>
            <button
              onClick={() => setPreferredCurrency(prev => prev === 'ARS' ? 'USD' : 'ARS')}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-semibold bg-secondary/80 px-2 py-0.5 rounded-full border border-border transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>Ver en {preferredCurrency === 'ARS' ? 'USD' : 'ARS'}</span>
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            <span>1 USD = {exchangeRate.toLocaleString('es-AR')} ARS</span>
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed border-collapse">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground">
              {[
                { label: 'Descripción', key: 'description', width: 'w-[30%]', align: 'text-left' },
                { label: 'Importe', key: 'minAmount', width: 'w-[15%]', align: 'text-right' },
                { label: 'Imputado a', key: 'account', width: 'w-[20%]', align: 'text-left' },
                { label: 'Cuotas', key: 'installments', width: 'w-[15%]', align: 'text-center' },
                { label: 'Tipo', key: 'type', width: 'w-[20%]', align: 'text-left' }
              ].map((header) => (
                <th key={header.label} className={cn("py-3 px-4 font-medium relative", header.width, header.align)}>
                  <div className={cn("flex items-center gap-1", header.align === 'text-right' ? 'justify-end' : header.align === 'text-center' ? 'justify-center' : 'justify-start')}>
                    {header.label}
                    {header.key !== 'installments' && (
                      <button onClick={() => openFilter(header.key)} className="p-1 hover:bg-secondary rounded">
                        <Filter size={14} />
                      </button>
                    )}
                  </div>
                  {activeFilter === header.key && (
                    <div className="absolute top-full left-0 mt-2 p-4 bg-card border border-border rounded-xl shadow-xl w-48 z-20 space-y-3 text-left">
                      {header.key === 'minAmount' && (
                        <>
                          <input type="number" placeholder="Min" value={tempFilters.minAmount} onChange={e => setTempFilters({...tempFilters, minAmount: e.target.value})} className="w-full p-2 border border-border rounded-lg text-xs bg-background" />
                          <input type="number" placeholder="Max" value={tempFilters.maxAmount} onChange={e => setTempFilters({...tempFilters, maxAmount: e.target.value})} className="w-full p-2 border border-border rounded-lg text-xs bg-background" />
                        </>
                      )}
                      {header.key === 'description' && (
                        <input type="text" placeholder="Buscar..." value={tempFilters.description} onChange={e => setTempFilters({...tempFilters, description: e.target.value})} className="w-full p-2 border border-border rounded-lg text-xs bg-background" />
                      )}
                      {header.key === 'type' && (
                        <select value={tempFilters.type} onChange={e => setTempFilters({...tempFilters, type: e.target.value})} className="w-full p-2 border border-border rounded-lg text-xs bg-card">
                          <option value="">Todos</option>
                          <option value="subscription">Suscripción</option>
                          <option value="service">Servicio</option>
                          <option value="expense">Otro Gasto</option>
                        </select>
                      )}
                      {header.key === 'account' && (
                        <select value={tempFilters.account} onChange={e => setTempFilters({...tempFilters, account: e.target.value})} className="w-full p-2 border border-border rounded-lg text-xs bg-card">
                          <option value="">Todas</option>
                          {uniqueAccounts.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      )}
                      <div className="flex gap-2">
                        <button onClick={applyFilters} className="flex-1 bg-primary text-primary-foreground py-1 rounded-lg text-xs">Aplicar</button>
                        <button onClick={cancelFilters} className="flex-1 bg-secondary text-secondary-foreground py-1 rounded-lg text-xs">Cancelar</button>
                      </div>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paginatedItems.map(t => {
              const badge = getTypeBadge(t.type, t.is_installment, t.categories?.name)
              return (
                <tr key={t.id} className="hover:bg-secondary/50">
                  <td className="py-3 px-4 truncate w-[30%] text-left">{t.description}</td>
                  <td className="py-3 px-4 text-right w-[15%]">{t.amount.toLocaleString('es-AR', { style: 'currency', currency: t.currency || 'ARS' })}</td>
                  <td className="py-3 px-4 text-left w-[20%] text-muted-foreground">{t.accounts?.name || '—'}</td>
                  <td className="py-3 px-4 text-center w-[15%]">{t.is_installment ? `${t.installment_number}/${t.installments_total}` : '-'}</td>
                  <td className="py-3 px-4 text-left w-[20%]">
                    <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap", badge.className)}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {filteredItems.length === 0 ? 'Sin resultados' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredItems.length)} de ${filteredItems.length}`}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                "w-8 h-8 text-xs rounded-lg font-medium transition-colors",
                page === safePage
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary text-muted-foreground"
              )}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <select
          value={pageSize}
          onChange={e => setPageSize(Number(e.target.value))}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card text-muted-foreground cursor-pointer"
        >
          {[10, 25, 50, 100].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
