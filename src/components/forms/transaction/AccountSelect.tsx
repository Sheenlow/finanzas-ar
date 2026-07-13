'use client'

import { CustomSelect } from '@/components/ui/CustomSelect'

interface AccountSelectProps {
  value: string
  accounts: { id: string; name: string }[]
  onChange: (accountId: string) => void
}

export function AccountSelect({ value, accounts, onChange }: AccountSelectProps) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={accounts.map(acc => ({ value: acc.id, label: acc.name }))}
    />
  )
}
