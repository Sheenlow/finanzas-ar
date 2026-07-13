'use client'

interface IncomeEditorProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  loading: boolean
}

export function IncomeEditor({ value, onChange, onSave, onCancel, loading }: IncomeEditorProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">$</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-28 px-2 py-1 border border-border rounded-lg text-sm text-center"
        placeholder="0.00"
        autoFocus
      />
      <button
        onClick={onSave}
        disabled={loading}
        className="p-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded"
      >
        OK
      </button>
      <button
        onClick={onCancel}
        className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded"
      >
        ✕
      </button>
    </div>
  )
}
