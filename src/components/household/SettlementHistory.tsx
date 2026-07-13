'use client'

import { Clock } from 'lucide-react'

interface SettlementHistoryProps {
  settlements: any[]
  userId: string
  profileMap: Map<string, any>
}

export function SettlementHistory({ settlements, userId, profileMap }: SettlementHistoryProps) {
  if (settlements.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Historial de liquidaciones
      </h3>
      <div className="space-y-2">
        {settlements.map((s: any) => {
          const fromName = s.from_user_id === userId ? 'Vos' : profileMap.get(s.from_user_id)?.full_name || 'Miembro'
          const toName = s.to_user_id === userId ? 'Vos' : profileMap.get(s.to_user_id)?.full_name || 'Miembro'
          return (
            <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-secondary/30 rounded-xl">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{fromName}</span>
                <span className="text-muted-foreground">pagó a</span>
                <span className="font-medium">{toName}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-emerald-600">
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(s.amount)}
                </span>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
