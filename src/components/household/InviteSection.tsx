'use client'

import { Loader2, Mail, Copy, Check } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'

interface Props {
  inviteEmail: string
  onEmailChange: (v: string) => void
  onInvite: () => void
  loading: boolean
  disabled: boolean
  inviteLink: string | null
  copied: boolean
  onCopy: () => void
  error: string | null
}

export function InviteSection({
  inviteEmail, onEmailChange, onInvite, loading, disabled,
  inviteLink, copied, onCopy, error,
}: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Mail className="w-4 h-4" />Invitar miembro</h3>
      <div className="flex gap-3">
        <input type="email" placeholder="Email de la persona" value={inviteEmail} onChange={e => onEmailChange(e.target.value)} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm" />
        <button onClick={onInvite} disabled={loading || disabled}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invitar'}
        </button>
      </div>
      {error && <Alert variant="error" className="mt-2">{error}</Alert>}
      {inviteLink && (
        <div className="mt-3 flex items-center gap-2 bg-secondary/50 p-3 rounded-xl">
          <code className="flex-1 text-xs break-all">{inviteLink}</code>
          <button onClick={onCopy} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors" aria-label="Copiar enlace">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  )
}
