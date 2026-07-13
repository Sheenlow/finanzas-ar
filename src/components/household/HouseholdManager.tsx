'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Home, Mail, Copy, Check, Pencil, AlertTriangle, Trash2 } from 'lucide-react'
import { HouseholdMonthlyReport } from './HouseholdMonthlyReport'
import { CreateHouseholdForm } from './CreateHouseholdForm'
import { MemberList } from './MemberList'
import { TransactionList } from './TransactionList'
import { SettlementHistory } from './SettlementHistory'
import { GoalPreview } from './GoalPreview'
import { LeaveModal } from './LeaveModal'
import { DeleteModal } from './DeleteModal'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useHouseholdIncomes } from '@/hooks/useHouseholdIncomes'
import { useInviteLink } from '@/hooks/useInviteLink'
import { useSettlements } from '@/hooks/useSettlements'

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
  sharedTransactionIds?: string[]
  initialMonthlyReport?: { name: string; value: number; color: string; percentage: string }[]
}

export function HouseholdManager({
  initialHousehold, initialMembers, myRole, userId, userEmail,
  initialTransactions = [], initialSettlements = [], profileMap = new Map(),
  initialHouseholdGoals = [], sharedTransactionIds = [], initialMonthlyReport = []
}: Props) {
  const router = useRouter()
  const [household, setHousehold] = useState<Household | null>(initialHousehold)
  const [role, setRole] = useState(myRole)
  const [householdName, setHouseholdName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editHouseholdName, setEditHouseholdName] = useState('')
  const [editingSplit, setEditingSplit] = useState<string | null>(null)
  const [splitValue, setSplitValue] = useState('')
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeValue, setIncomeValue] = useState('')

  const householdId = household?.id ?? null
  const isAdmin = role === 'admin'

  const { members, setMembers, updateSplit, removeMember, transferAdmin, applyAutoSplit } =
    useHouseholdMembers(householdId, initialMembers, userId)
  const { incomes, updateIncome, incomeMap, totalIncome } = useHouseholdIncomes(householdId)
  const invite = useInviteLink(householdId)
  const { settlements } = useSettlements(householdId, initialSettlements)

  const autoSplitMap = useMemo(() => {
    const map = new Map<string, number>()
    if (totalIncome > 0) for (const m of members) {
      const income = incomeMap.get(m.user_id) || 0
      map.set(m.user_id, (income / totalIncome) * 100)
    }
    return map
  }, [totalIncome, members, incomeMap])

  const membersWithoutIncome = useMemo(() => members.filter(m => !incomeMap.has(m.user_id)), [members, incomeMap])
  const totalSplit = members.reduce((sum, m) => sum + m.split_percentage, 0)
  const splitValid = Math.abs(totalSplit - 100) < 0.01

  const wrap = async (fn: () => Promise<void>) => { setLoading(true); setError(null); try { await fn() } catch (err: any) { setError(err.message) } finally { setLoading(false) } }

  const handleCreate = async () => {
    if (!householdName.trim()) return
    await wrap(async () => {
      const res = await fetch('/api/households/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: householdName.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setHousehold(data.household); setHouseholdName(''); setRole('admin')
      setMembers([{ id: '', household_id: data.household.id, user_id: userId, role: 'admin' as const, split_percentage: 100, joined_at: new Date().toISOString() }])
    })
  }

  const handleRename = async () => {
    if (!household || !editHouseholdName.trim()) return
    await wrap(async () => {
      const res = await fetch('/api/households/rename', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: household.id, name: editHouseholdName.trim() }) })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
      setHousehold(prev => prev ? { ...prev, name: editHouseholdName.trim() } : null); setEditingName(false)
    })
  }

  const handleLeave = () => wrap(async () => {
    const res = await fetch('/api/households/leave', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    if (data.householdDeleted) window.location.href = '/hogar'
    else router.refresh()
  })

  const handleDelete = () => wrap(async () => {
    const res = await fetch('/api/households/delete', { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    window.location.href = '/hogar'
  })

  const handleTransferAdmin = (memberId: string) => wrap(async () => { const newRole = await transferAdmin(memberId); setRole(newRole) })
  const handleRemoveMember = (memberId: string) => wrap(async () => { await removeMember(memberId) })

  const handleApplyAutoSplit = () => {
    if (membersWithoutIncome.length > 0) {
      const names = membersWithoutIncome.map(m => `• ${m.profiles?.full_name || m.user_id}`).join('\n')
      setError(`Los siguientes miembros no tienen ingresos declarados:\n${names}\n\nDeclará sus ingresos mensuales antes de aplicar el split.`)
      return
    }
    wrap(async () => { await applyAutoSplit(autoSplitMap) })
  }

  const handleSaveSplit = (memberId: string) => { if (!splitValue) return; wrap(async () => { await updateSplit(memberId, parseFloat(splitValue)); setEditingSplit(null) }) }
  const handleSaveIncome = () => wrap(async () => { await updateIncome(parseFloat(incomeValue) || 0); setEditingIncome(false) })

  if (!household) return (
    <CreateHouseholdForm householdName={householdName} onNameChange={setHouseholdName} onCreate={handleCreate} loading={loading} error={error} />
  )

  const displayError = error || invite.error

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Home className="w-5 h-5 text-primary" /></div>
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input type="text" value={editHouseholdName} onChange={e => setEditHouseholdName(e.target.value)} className="px-3 py-1 border border-border rounded-lg text-sm font-semibold w-48" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false) }} />
                <button onClick={handleRename} disabled={loading} className="p-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded">OK</button>
                <button onClick={() => setEditingName(false)} className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{household.name}</h2>
                {isAdmin && <button onClick={() => { setEditingName(true); setEditHouseholdName(household.name) }} className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded" title="Renombrar"><Pencil className="w-3.5 h-3.5" /></button>}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{members.length} miembro{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <MemberList
        members={members} incomes={incomes} incomeMap={incomeMap} totalIncome={totalIncome}
        autoSplitMap={autoSplitMap} userId={userId} isAdmin={isAdmin}
        editingSplit={editingSplit} splitValue={splitValue} editingIncome={editingIncome} incomeValue={incomeValue}
        totalSplit={totalSplit} splitValid={splitValid} membersWithoutIncome={membersWithoutIncome}
        onEditSplit={(id, val) => { setEditingSplit(id); setSplitValue(val.toString()) }}
        onSplitValueChange={setSplitValue} onSaveSplit={handleSaveSplit} onCancelSplit={() => setEditingSplit(null)}
        onEditIncome={(val) => { setEditingIncome(true); setIncomeValue(val > 0 ? val.toString() : '') }}
        onIncomeValueChange={setIncomeValue} onSaveIncome={handleSaveIncome} onCancelIncome={() => setEditingIncome(false)}
        onTransferAdmin={handleTransferAdmin} onRemoveMember={handleRemoveMember}
        onApplyAutoSplit={handleApplyAutoSplit} onLeave={() => setShowLeaveModal(true)} loading={loading}
      />

      {isAdmin && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Mail className="w-4 h-4" />Invitar miembro</h3>
          <div className="flex gap-3">
            <input type="email" placeholder="Email de la persona" value={invite.inviteEmail} onChange={e => invite.setInviteEmail(e.target.value)} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm" />
            <button onClick={invite.handleInvite} disabled={invite.loading || !invite.inviteEmail.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {invite.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invitar'}
            </button>
          </div>
          {displayError && <p className="text-xs text-rose-600 mt-2">{displayError}</p>}
          {invite.inviteLink && (
            <div className="mt-3 flex items-center gap-2 bg-secondary/50 p-3 rounded-xl">
              <code className="flex-1 text-xs break-all">{invite.inviteLink}</code>
              <button onClick={invite.handleCopyLink} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                {invite.copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      <HouseholdMonthlyReport data={initialMonthlyReport} />

      <TransactionList transactions={initialTransactions} sharedTransactionIds={sharedTransactionIds} userId={userId} profileMap={profileMap} />
      <SettlementHistory settlements={settlements} userId={userId} profileMap={profileMap} />
      <GoalPreview goals={initialHouseholdGoals} />

      <div className="bg-secondary/50 border border-border rounded-2xl p-4 text-xs">
        <p className="font-medium mb-1">¿Cómo funciona el split automático?</p>
        <p className="text-muted-foreground">Declarando ingresos mensuales, el sistema calcula automáticamente el % de cada miembro según su proporción sobre el ingreso total. Si preferís, podés editar el split manualmente. Los gastos del hogar se dividen al momento de registrarlos.</p>
      </div>

      {isAdmin && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Zona de peligro</p>
          <button onClick={() => setShowDeleteModal(true)} className="w-full px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" />Eliminar hogar
          </button>
        </div>
      )}

      <LeaveModal open={showLeaveModal} householdName={household?.name} isAdmin={isAdmin} otherMembersCount={members.length - 1}
        loading={loading} onConfirm={handleLeave} onClose={() => setShowLeaveModal(false)} />

      <DeleteModal open={showDeleteModal} householdName={household?.name} error={error}
        loading={loading} onConfirm={handleDelete} onClose={() => setShowDeleteModal(false)} />
    </div>
  )
}
