'use client'

interface SplitEditorProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  loading: boolean
}

export function SplitEditor({ value, onChange, onSave, onCancel, loading }: SplitEditorProps) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-16 px-2 py-1 border border-border rounded-lg text-sm text-center"
        placeholder="%"
        aria-label="Porcentaje de reparto"
        autoFocus
      />
      <span className="text-xs text-muted-foreground">%</span>
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
