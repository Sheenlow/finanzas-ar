'use client'

import { MonthSelector } from '@/components/MonthSelector'

interface Props {
  greetingName: string
  selectedMonth: string
  minMonth: string | undefined
  onMonthChange: (month: string) => void
}

export function DashboardHeader({ greetingName, selectedMonth, minMonth, onMonthChange }: Props) {
  return (
    <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bienvenido{greetingName ? ` ${greetingName.split(' ')[0]}` : ''} de nuevo a tu gestión financiera.
        </p>
      </div>
      <MonthSelector value={selectedMonth} onChange={onMonthChange} minMonth={minMonth} />
    </header>
  )
}
