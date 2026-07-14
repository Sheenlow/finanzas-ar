'use client'

import { CustomSelect } from '../ui/CustomSelect'

interface Props {
  name: string
  setName: (v: string) => void
  balance: string
  setBalance: (v: string) => void
  currency: 'ARS' | 'USD'
  setCurrency: (v: 'ARS' | 'USD') => void
  type: 'bank' | 'cash' | 'crypto' | 'credit_card'
  setType: (v: 'bank' | 'cash' | 'crypto' | 'credit_card') => void
}

export function AccountBasicFields({ name, setName, balance, setBalance, currency, setCurrency, type, setType }: Props) {
  return (
    <>
      <div>
        <label htmlFor="acct-name" className="text-xs text-muted-foreground mb-1 block">Nombre de la cuenta</label>
        <input
          id="acct-name"
          type="text"
          placeholder="Nombre de la cuenta"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all"
          required
        />
      </div>
      <div>
        <label htmlFor="acct-balance" className="text-xs text-muted-foreground mb-1 block">Balance inicial</label>
        <input
          id="acct-balance"
          type="number"
          placeholder="Balance inicial"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all"
          required
        />
      </div>
      <CustomSelect
        value={currency}
        onChange={(val) => setCurrency(val as 'ARS' | 'USD')}
        options={[
          { value: 'ARS', label: 'ARS' },
          { value: 'USD', label: 'USD' }
        ]}
      />
      <CustomSelect
        value={type}
        onChange={(val) => setType(val as 'bank' | 'cash' | 'crypto' | 'credit_card')}
        options={[
          { value: 'bank', label: 'Banco' },
          { value: 'cash', label: 'Efectivo' },
          { value: 'crypto', label: 'Crypto' },
          { value: 'credit_card', label: 'Tarjeta de Crédito' }
        ]}
      />
    </>
  )
}
