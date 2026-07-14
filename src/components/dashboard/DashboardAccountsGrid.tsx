'use client'

import { Wallet } from 'lucide-react'
import { AnimatedCard } from '@/components/AnimatedCard'
import { EmptyState } from '@/components/ui/EmptyState'

interface AccountData {
  id: string
  name: string
  balance: number
  currency: string
  type: string
}

interface Props {
  accounts: AccountData[]
  onCreateAccount: () => void
}

export function DashboardAccountsGrid({ accounts, onCreateAccount }: Props) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Agregá una cuenta"
        description="No tenés cuentas registradas. Agregá tu primera cuenta para empezar a gestionar tus finanzas."
        action={{ label: 'Crear cuenta', onClick: onCreateAccount }}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {accounts.map((account, index) => (
        <AnimatedCard
          key={account.id}
          title={account.name}
          amount={account.balance}
          currency={account.currency as "ARS" | "USD"}
          type={account.type as "bank" | "cash" | "crypto"}
          delay={index * 0.05}
        />
      ))}
    </div>
  )
}
