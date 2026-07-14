'use client'

import { CustomSelect } from '../ui/CustomSelect'
import { Alert } from '@/components/ui/Alert'

interface Props {
  closingRule: 'fixed' | 'last_thursday'
  setClosingRule: (v: 'fixed' | 'last_thursday') => void
  closingDay: string
  setClosingDay: (v: string) => void
  dueDay: string
  setDueDay: (v: string) => void
  bankName: string
  setBankName: (v: string) => void
  last4Digits: string
  setLast4Digits: (v: string) => void
  creditLimit: string
  setCreditLimit: (v: string) => void
  nextClosingEstimate: string
  children?: React.ReactNode
}

const dayOptions = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

export function CreditCardConfig({
  closingRule, setClosingRule, closingDay, setClosingDay,
  dueDay, setDueDay, bankName, setBankName,
  last4Digits, setLast4Digits, creditLimit, setCreditLimit,
  nextClosingEstimate, children,
}: Props) {
  return (
    <div className="space-y-3 p-4 bg-secondary/20 rounded-xl border border-border/50">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Datos de la tarjeta</p>

      <CustomSelect
        value={closingRule}
        onChange={(val) => setClosingRule(val as 'fixed' | 'last_thursday')}
        options={[
          { value: 'last_thursday', label: 'Último jueves (autoestimar cierre)' },
          { value: 'fixed', label: 'Día fijo (indicar abajo)' },
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {closingRule === 'fixed' ? 'Día de cierre' : 'Día de cierre (fallback)'}
          </label>
          <CustomSelect value={closingDay} onChange={setClosingDay} options={dayOptions} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Día de vencimiento</label>
          <CustomSelect value={dueDay} onChange={setDueDay} options={[{ value: '', label: '—' }, ...dayOptions]} />
        </div>
      </div>

      {closingRule === 'last_thursday' && (
        <Alert variant="info">
          Próximo cierre estimado: <strong>{nextClosingEstimate}</strong>
        </Alert>
      )}

      <input
        type="text"
        placeholder="Banco / Nombre de la tarjeta (ej: Visa Galicia)"
        value={bankName}
        onChange={(e) => setBankName(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-xl text-sm"
      />

      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Últimos 4 dígitos"
          value={last4Digits}
          onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, '').slice(0, 4))}
          maxLength={4}
          className="w-full px-4 py-2 border border-border rounded-xl text-sm"
        />
        <input
          type="number"
          placeholder="Límite de crédito"
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-xl text-sm"
        />
      </div>

      {children}
    </div>
  )
}
