'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  transactions: any[]
  categories: { id: string; name: string; color: string }[]
}

export function MonthlyTransactions({ transactions, categories }: Props) {
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>()
    categories.forEach(c => map.set(c.id, { name: c.name, color: c.color }))
    return map
  }, [categories])

  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize])

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return transactions.slice(start, start + pageSize)
  }, [transactions, safePage, pageSize])

  return (
    <section className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-8">
      <h2 className="text-lg font-semibold mb-6">Últimos consumos del mes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b border-border/50">
              <th className="text-left py-3 px-4 font-medium">Descripción</th>
              <th className="text-left py-3 px-4 font-medium">Fecha</th>
              <th className="text-center py-3 px-4 font-medium">Cuotas</th>
              <th className="text-right py-3 px-4 font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((t: any) => (
              <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors">
                <td className="py-4 px-4 font-medium text-foreground">
                  {t.description}
                  {t.household_id && (
                    <span className="ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      Hogar
                    </span>
                  )}
                  {t.category_id && categoryMap.has(t.category_id) && (
                    <span
                      className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: categoryMap.get(t.category_id)!.color + '18',
                        color: categoryMap.get(t.category_id)!.color,
                      }}
                    >
                      {categoryMap.get(t.category_id)!.name}
                    </span>
                  )}
                  {t.is_installment && (
                    <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      Cuota {t.installment_number}/{t.installments_total}
                    </span>
                  )}
                </td>
                <td className="py-4 px-4 text-muted-foreground">
                  {new Date(t.transaction_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-4 px-4 text-center text-muted-foreground">
                  {t.is_installment ? `${t.installment_number}/${t.installments_total}` : '-'}
                </td>
                <td className={`py-4 px-4 font-semibold text-right ${t.type === 'income' ? 'text-emerald-700' : 'text-foreground'}`}>
                  {t.type === 'income' ? '+' : '-'}{' '}
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: t.currency }).format(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end items-center gap-3 mt-4">
        <span className="text-xs text-muted-foreground">
          {transactions.length === 0 ? 'Sin resultados' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, transactions.length)} de ${transactions.length}`}
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
    </section>
  )
}
