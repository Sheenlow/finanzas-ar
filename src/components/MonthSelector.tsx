'use client'
import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CustomSelect } from './ui/CustomSelect'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (month: string) => void
  minMonth?: string
  maxMonth?: string
}

export function MonthSelector({ value, onChange, minMonth, maxMonth }: Props) {
  const now = new Date()
  const currentMaxMonth = maxMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [internalYear, setInternalYear] = useState(() => {
    const [y] = value.split('-')
    return Number(y)
  })

  const [minYear, minMonthNum] = minMonth ? minMonth.split('-').map(Number) : [2020, 1]
  const [maxYear, maxMonthNum] = currentMaxMonth.split('-').map(Number)

  const canGoPrev = internalYear > minYear
  const canGoNext = internalYear < maxYear

  const handlePrevYear = useCallback(() => {
    if (canGoPrev) {
      const newYear = internalYear - 1
      setInternalYear(newYear)
      const monthNum = Number(value.split('-')[1])
      const cappedMonth = Math.min(monthNum, newYear === maxYear ? maxMonthNum : 12)
      onChange(`${newYear}-${String(cappedMonth).padStart(2, '0')}`)
    }
  }, [canGoPrev, internalYear, value, onChange, maxYear, maxMonthNum])

  const handleNextYear = useCallback(() => {
    if (canGoNext) {
      const newYear = internalYear + 1
      setInternalYear(newYear)
      const monthNum = Number(value.split('-')[1])
      const cappedMonth = Math.min(monthNum, newYear === maxYear ? maxMonthNum : 12)
      onChange(`${newYear}-${String(cappedMonth).padStart(2, '0')}`)
    }
  }, [canGoNext, internalYear, value, onChange, maxYear, maxMonthNum])

  const options = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const monthNumber = String(i + 1).padStart(2, '0')
      const val = `${internalYear}-${monthNumber}`
      const label = new Date(internalYear, i, 1).toLocaleString('es-ES', { month: 'long' })
      return {
        value: val,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        disabled:
          (internalYear === minYear && i + 1 < minMonthNum) ||
          (internalYear === maxYear && i + 1 > maxMonthNum),
      }
    })
  }, [internalYear, minYear, minMonthNum, maxYear, maxMonthNum])

  const handleMonthChange = useCallback(
    (month: string) => {
      const [y] = month.split('-')
      setInternalYear(Number(y))
      onChange(month)
    },
    [onChange]
  )

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handlePrevYear}
        disabled={!canGoPrev}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          canGoPrev
            ? 'hover:bg-secondary text-foreground cursor-pointer'
            : 'opacity-25 cursor-not-allowed'
        )}
        aria-label="Año anterior"
      >
        <ChevronLeft size={16} />
      </button>

      <CustomSelect
        value={value}
        onChange={handleMonthChange}
        options={options}
        className="w-40"
      />

      <button
        type="button"
        onClick={handleNextYear}
        disabled={!canGoNext}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          canGoNext
            ? 'hover:bg-secondary text-foreground cursor-pointer'
            : 'opacity-25 cursor-not-allowed'
        )}
        aria-label="Año siguiente"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
