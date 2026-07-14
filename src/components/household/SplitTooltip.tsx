'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users } from 'lucide-react'

interface SplitTooltipProps {
  transactionId: string
  children: React.ReactNode
}

interface ShareRecord {
  id: string
  household_id: string
  transaction_id: string
  user_id: string
  share_percentage: number
  share_amount: number
  profiles?: { full_name: string } | null
}

export function SplitTooltip({ transactionId, children }: SplitTooltipProps) {
  const [show, setShow] = useState(false)
  const [records, setRecords] = useState<ShareRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!show || records.length > 0) return
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('household_share_records')
      .select('*, profiles:profiles(full_name)')
      .eq('transaction_id', transactionId)
      .then(({ data, error }) => {
        if (!error) setRecords((data || []) as ShareRecord[])
        setLoading(false)
      })
  }, [show, transactionId, records.length])

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}

      {show && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-card border border-border rounded-xl shadow-lg p-3 text-xs"
        >
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
            <Users className="w-3 h-3" />
            <span className="font-medium">División del gasto</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-muted-foreground">No hay registros de división.</p>
          ) : (
            <div className="space-y-1.5">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-foreground font-medium truncate max-w-[100px]">
                    {r.profiles?.full_name || r.user_id.slice(0, 8)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.share_percentage}% — ${r.share_amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-2 w-2 h-2 rotate-45 bg-card border-r border-b border-border" />
        </div>
      )}
    </div>
  )
}
