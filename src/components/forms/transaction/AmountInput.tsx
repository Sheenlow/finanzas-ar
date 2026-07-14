'use client'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  id?: string
  label?: string
}

export function AmountInput({ value, onChange, required = true, id, label }: AmountInputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="text-xs text-muted-foreground mb-1 block">
          {label}
        </label>
      )}
      <input
        id={id}
        type="number"
        placeholder="Monto"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-xl text-sm"
        required={required}
        aria-label={!label ? 'Monto' : undefined}
      />
    </div>
  )
}
