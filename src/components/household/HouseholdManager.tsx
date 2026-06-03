'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, Mail, Percent, Copy, Check, UserMinus, Home, Loader2, DollarSign, RotateCcw, LogOut, Trash2, UserCog, AlertTriangle, Pencil, Wand2, ReceiptText, Clock, Download, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Household {
  id: string
  name: string
  created_at: string
}

interface Member {
  id: string
  household_id: string
  user_id: string
  role: 'admin' | 'member'
  split_percentage: number
  joined_at: string
  profiles?: { full_name?: string }
}

interface HouseholdIncome {
  id: string
  user_id: string
  monthly_income_ars: number
  updated_at: string
}

interface Props {
  initialHousehold: Household | null
  initialMembers: Member[]
  myRole: string | null
  userId: string
  userEmail: string
  initialTransactions?: any[]
  initialSettlements?: any[]
  profileMap?: Map<string, any>
  initialHouseholdGoals?: any[]
}

export function HouseholdManager({ initialHousehold, initialMembers, myRole, userId, userEmail, initialTransactions = [], initialSettlements = [], profileMap = new Map(), initialHouseholdGoals = [] }: Props) {
  const [household, setHousehold] = useState<Household | null>(initialHousehold)
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [householdIncomes, setHouseholdIncomes] = useState<HouseholdIncome[]>([])
  const [role, setRole] = useState(myRole)
  const [householdName, setHouseholdName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingSplit, setEditingSplit] = useState<string | null>(null)
  const [splitValue, setSplitValue] = useState('')
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeValue, setIncomeValue] = useState('')
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmDeleteText, setConfirmDeleteText] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editHouseholdName, setEditHouseholdName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const isAdmin = role === 'admin'

  const incomeMap = new Map(householdIncomes.map(i => [i.user_id, i.monthly_income_ars]))
  const totalIncome = Array.from(incomeMap.values()).reduce((sum, v) => sum + v, 0)

  const autoSplitMap = new Map<string, number>()
  if (totalIncome > 0) {
    for (const m of members) {
      const income = incomeMap.get(m.user_id) || 0
      autoSplitMap.set(m.user_id, (income / totalIncome) * 100)
    }
  }

  const handleCreate = async () => {
    if (!householdName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/households/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: householdName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setHousehold(data.household)
      setHouseholdName('')
      setRole('admin')
      setMembers([{
        id: '',
        household_id: data.household.id,
        user_id: userId,
        role: 'admin',
        split_percentage: 100,
        joined_at: new Date().toISOString(),
      }])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !household) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/households/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: household.id, email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInviteLink(data.inviteLink)
      setInviteEmail('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUpdateSplit = async (memberId: string) => {
    if (!splitValue) return
    setLoading(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('household_members')
        .update({ split_percentage: parseFloat(splitValue) })
        .eq('id', memberId)
      if (updateError) throw updateError
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, split_percentage: parseFloat(splitValue) } : m))
      setEditingSplit(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateIncome = async () => {
    if (!household) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/households/incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household_id: household.id,
          monthly_income_ars: parseFloat(incomeValue) || 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setEditingIncome(false)
      loadIncomes()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadIncomes = async () => {
    if (!household) return
    const { data } = await supabase
      .from('household_incomes')
      .select('*')
      .eq('household_id', household.id)
    setHouseholdIncomes(data || [])
  }

  const handleRemoveMember = async (memberId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/households/remove-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLeave = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/households/leave', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.householdDeleted) {
        window.location.href = '/hogar'
      } else {
        window.location.reload()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (household) {
      loadIncomes()
    }
  }, [household])

  const handleRename = async () => {
    if (!household || !editHouseholdName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/households/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: household.id, name: editHouseholdName.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setHousehold(prev => prev ? { ...prev, name: editHouseholdName.trim() } : null)
      setEditingName(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTransferAdmin = async (memberId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/households/transfer-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setRole('member')
      setMembers(prev => prev.map(m =>
        m.id === memberId
          ? { ...m, role: 'admin' }
          : m.user_id === userId
            ? { ...m, role: 'member' }
            : m
      ))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyAutoSplit = async () => {
    if (!household) return
    setLoading(true)
    setError(null)
    try {
      const updates = members.map(m => ({
        id: m.id,
        split_percentage: Math.round((autoSplitMap.get(m.user_id) || m.split_percentage) * 100) / 100,
      }))
      for (const update of updates) {
        await supabase
          .from('household_members')
          .update({ split_percentage: update.split_percentage })
          .eq('id', update.id)
      }
      setMembers(prev => prev.map(m => {
        const newSplit = updates.find(u => u.id === m.id)
        return newSplit ? { ...m, split_percentage: newSplit.split_percentage } : m
      }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const totalSplit = members.reduce((sum, m) => sum + m.split_percentage, 0)
  const splitValid = Math.abs(totalSplit - 100) < 0.01

  if (!household) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Home className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Todavía no tenés un hogar</h2>
          <p className="text-sm text-muted-foreground">
            Creá un hogar para gestionar gastos compartidos con otra persona.
          </p>
          <div className="flex gap-3 max-w-xs mx-auto">
            <input
              type="text"
              placeholder="Nombre del hogar (ej: Casa)"
              value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              className="flex-1 px-4 py-2 border border-border rounded-xl text-sm"
            />
            <button
              onClick={handleCreate}
              disabled={loading || !householdName.trim()}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10">
            <Home className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editHouseholdName}
                  onChange={e => setEditHouseholdName(e.target.value)}
                  className="px-3 py-1 border border-border rounded-lg text-sm font-semibold w-48"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false) }}
                />
                <button onClick={handleRename} disabled={loading} className="p-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded">OK</button>
                <button onClick={() => setEditingName(false)} className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{household.name}</h2>
                {isAdmin && (
                  <button
                    onClick={() => { setEditingName(true); setEditHouseholdName(household.name) }}
                    className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded"
                    title="Renombrar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {members.length} miembro{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Ingresos mensuales (opcional)
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Si declarás tus ingresos, el split se calcula automáticamente según la proporción.
        </p>
        <div className="space-y-3">
          {members.map(member => {
            const income = incomeMap.get(member.user_id) || 0;
            const isMe = member.user_id === userId;
            return (
              <div key={member.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                    {member.role === 'admin' ? 'A' : 'M'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {isMe ? 'Vos' : member.profiles?.full_name || 'Miembro'}
                      {member.role === 'admin' && <span className="text-[10px] ml-1.5 text-muted-foreground">(admin)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isMe && editingIncome ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={incomeValue}
                        onChange={e => setIncomeValue(e.target.value)}
                        className="w-28 px-2 py-1 border border-border rounded-lg text-sm text-center"
                        placeholder="0.00"
                        autoFocus
                      />
                      <button
                        onClick={handleUpdateIncome}
                        disabled={loading}
                        className="p-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingIncome(false)}
                        className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {income > 0
                          ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(income)
                          : 'Sin datos'
                        }
                      </span>
                      {isMe && (
                        <button
                          onClick={() => {
                            setEditingIncome(true)
                            setIncomeValue(income > 0 ? income.toString() : '')
                          }}
                          className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded"
                        >
                          <Percent className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  {totalIncome > 0 && income > 0 && !isMe && (
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      ~{Math.round((income / totalIncome) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {totalIncome > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-xs text-green-700">
              <span className="font-medium">Split automático activo</span> - Los gastos se dividen según ingresos.
            </p>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Miembros y reparto
        </h3>
        {!splitValid && (
          <p className="text-xs text-amber-600 mb-3 bg-amber-50 px-3 py-2 rounded-lg">
            Los porcentajes de reparto no suman 100% (actual: {totalSplit}%)
          </p>
        )}
        <div className="space-y-3">
          {members.map(member => {
            const autoSplit = autoSplitMap.get(member.user_id)
            const manualSplit = member.split_percentage
            const isAutoDifferent = autoSplit && Math.abs(autoSplit - manualSplit) > 1
            const isMe = member.user_id === userId
            return (
              <div key={member.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                    {member.role === 'admin' ? 'A' : 'M'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {isMe ? 'Vos' : member.profiles?.full_name || 'Miembro'}
                      {member.role === 'admin' && <span className="text-[10px] ml-1 text-muted-foreground">(admin)</span>}
                    </p>
                    {isAutoDifferent && totalIncome > 0 && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <RotateCcw className="w-2.5 h-2.5" />
                        auto: {Math.round(autoSplit)}%
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{manualSplit}%</span>
                  {isAdmin && (
                    <button
                      onClick={() => { setEditingSplit(member.id); setSplitValue(manualSplit.toString()) }}
                      className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded"
                    >
                      <Percent className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isAdmin && !isMe && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTransferAdmin(member.id)}
                        className="p-1 text-xs text-blue-500 hover:bg-blue-50 rounded"
                        title="Transferir admin"
                      >
                        <UserCog className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 text-xs text-rose-500 hover:bg-rose-50 rounded"
                        title="Expulsar"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {totalIncome > 0 && isAdmin && (
          <button
            onClick={handleApplyAutoSplit}
            disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4" />
            Aplicar split automático a todos
          </button>
        )}
        {!isAdmin && (
          <button
            onClick={() => setShowLeaveModal(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
          >
            <LogOut className="w-4 h-4" />
            Salirse del hogar
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Invitar miembro
          </h3>
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="Email de la persona"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 px-4 py-2 border border-border rounded-xl text-sm"
            />
            <button
              onClick={handleInvite}
              disabled={loading || !inviteEmail.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invitar'}
            </button>
          </div>
          {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}

          {inviteLink && (
            <div className="mt-3 flex items-center gap-2 bg-secondary/50 p-3 rounded-xl">
              <code className="flex-1 text-xs break-all">{inviteLink}</code>
              <button
                onClick={handleCopyLink}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      {initialTransactions.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <ReceiptText className="w-4 h-4" />
            Últimos gastos del hogar
            <a
              href="/api/households/export"
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Exportar CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </a>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border/50">
                  <th className="text-left py-2 px-3 font-medium">Descripción</th>
                  <th className="text-left py-2 px-3 font-medium">Quién pagó</th>
                  <th className="text-center py-2 px-3 font-medium">Cuota</th>
                  <th className="text-right py-2 px-3 font-medium">Monto</th>
                  <th className="text-right py-2 px-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {initialTransactions.map((t: any) => {
                  const payerName = t.user_id === userId ? 'Vos' : profileMap.get(t.user_id)?.full_name || 'Miembro'
                  return (
                    <tr key={t.id} className="border-b border-border/30 last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-3 font-medium">{t.description}</td>
                      <td className="py-2 px-3 text-muted-foreground">{payerName}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground text-xs">
                        {t.is_installment ? `${t.installment_number}/${t.installments_total}` : '—'}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${t.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: t.currency || 'ARS' }).format(t.amount)}
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground text-xs">
                        {new Date(t.transaction_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {initialSettlements.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Historial de liquidaciones
          </h3>
          <div className="space-y-2">
            {initialSettlements.map((s: any) => {
              const fromName = s.from_user_id === userId ? 'Vos' : profileMap.get(s.from_user_id)?.full_name || 'Miembro'
              const toName = s.to_user_id === userId ? 'Vos' : profileMap.get(s.to_user_id)?.full_name || 'Miembro'
              return (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-secondary/30 rounded-xl">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{fromName}</span>
                    <span className="text-muted-foreground">pagó a</span>
                    <span className="font-medium">{toName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-emerald-600">
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(s.amount)}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {initialHouseholdGoals.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Metas del hogar
          </h3>
          <div className="space-y-3">
            {initialHouseholdGoals.slice(0, 4).map((goal: any) => {
              const progress = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100)
              const isCompleted = progress >= 100
              return (
                <div key={goal.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{goal.name}</p>
                      <span className="text-xs text-muted-foreground">{progress}%</span>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: goal.currency }).format(goal.current_amount)}{' '}
                      /{' '}
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: goal.currency }).format(goal.target_amount)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-secondary/50 border border-border rounded-2xl p-4 text-xs">
        <p className="font-medium mb-1">¿Cómo funciona el split automático?</p>
        <p className="text-muted-foreground">
          Declarando ingresos mensuales, el sistema calcula automáticamente el % de cada miembro
          según su proporción sobre el ingreso total. Si preferís, podés editar el split manualmente.
          Los gastos del hogar se dividen al momento de registrarlos.
        </p>
      </div>

      {isAdmin && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Zona de peligro
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar hogar
          </button>
        </div>
      )}

      <AnimatePresence>
        {showLeaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <LogOut className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-semibold">Salirse del hogar</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                ¿Estás seguro de salir del hogar "{household?.name}"? Perderás acceso a todos los gastos compartidos.
              </p>
              {isAdmin && members.length > 1 && (
                <p className="text-xs text-amber-600 mb-4 bg-amber-50 p-2 rounded-lg">
                  Siendo admin, primero transferí el rol a otro miembro.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLeave}
                  disabled={loading || (isAdmin && members.length > 1)}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saliendo...' : 'Salirse'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Trash2 className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold">Eliminar hogar</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                ¿Estás seguro de eliminar "{household?.name}"? Se perderán TODOS los datos de gastos compartidos.
              </p>
              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1 block">Escribí "ELIMINAR" para confirmar</label>
                <input
                  type="text"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-xl"
                  placeholder="ELIMINAR"
                />
              </div>
              {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteModal(false); setConfirmDeleteText('') }}
                  className="flex-1 px-4 py-2 border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (confirmDeleteText !== 'ELIMINAR') {
                      setError('Escribí ELIMINAR para confirmar')
                      return
                    }
                    setLoading(true)
                    setError(null)
                    try {
                      const res = await fetch('/api/households/delete', { method: 'DELETE' })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error)
                      window.location.href = '/hogar'
                    } catch (err: any) {
                      setError(err.message)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading || confirmDeleteText !== 'ELIMINAR'}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
