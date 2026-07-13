'use client'

import { ReceiptText, Download } from 'lucide-react'

interface TransactionListProps {
  transactions: any[]
  sharedTransactionIds: string[]
  userId: string
  profileMap: Map<string, any>
}

export function TransactionList({ transactions, sharedTransactionIds, userId, profileMap }: TransactionListProps) {
  if (transactions.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <ReceiptText className="w-4 h-4" />
        Últimos gastos del hogar
        <a
          href="/api/households/export"
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Exportar CSV"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </a>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b border-border/50">
              <th className="text-left py-2 px-3 font-medium">Descripción</th>
              <th className="text-left py-2 px-3 font-medium">Quién pagó</th>
              <th className="text-center py-2 px-3 font-medium">Cuota</th>
              <th className="text-right py-2 px-3 font-medium">Monto</th>
              <th className="text-center py-2 px-3 font-medium">Compartido</th>
              <th className="text-right py-2 px-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t: any) => {
              const payerName = t.user_id === userId ? 'Vos' : profileMap.get(t.user_id)?.full_name || 'Miembro'
              return (
                <tr key={t.id} className="border-b border-border/30 last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="py-2 px-3 font-medium">{t.description}</td>
                  <td className="py-2 px-3 text-muted-foreground">{payerName}</td>
                  <td className="py-2 px-3 text-center text-muted-foreground text-xs">
                    {t.is_installment ? `${t.installment_number}/${t.installments_total}` : '—'}
                  </td>
                  <td className={`py-2 px-3 text-right font-semibold ${t.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: t.currency || 'ARS' }).format(t.amount)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sharedTransactionIds.includes(t.id) ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      {sharedTransactionIds.includes(t.id) ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-muted-foreground text-xs">
                    {new Date(t.transaction_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
