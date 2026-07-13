'use client'
import { useMemo } from 'react'
import { CustomSelect } from './ui/CustomSelect'

interface Props {
  value: string
  onChange: (month: string) => void
}

export function MonthSelector({ value, onChange }: Props) {
  const currentYear = new Date().getFullYear()

  const options = useMemo(() => Array.from({ length: 12 }).map((_, i) => {
    const monthNumber = String(i + 1).padStart(2, '0')
    const val = `${currentYear}-${monthNumber}`
    const label = new Date(currentYear, i, 1).toLocaleString('es-ES', { month: 'long' })
    return { value: val, label: label.charAt(0).toUpperCase() + label.slice(1) }
  }), [currentYear])

  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={options}
      className="w-48"
    />
  )
}
