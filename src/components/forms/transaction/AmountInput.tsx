'use client'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export function AmountInput({ value, onChange, required = true }: AmountInputProps) {
  return (
    <input
      type="number"
      placeholder="Monto"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-2 border border-border rounded-xl text-sm"
      required={required}
      aria-label="Monto"
    />
  )
}
