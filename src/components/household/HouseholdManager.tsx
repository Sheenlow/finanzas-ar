'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, Percent, Users } from 'lucide-react'
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
import { HouseholdHeader } from './HouseholdHeader'
import { InviteSection } from './InviteSection'
import { DangerZone } from './DangerZone'
import type { Database } from '@/types/database.types'

type Transaction = Database['public']['Tables']['transactions']['Row']
type Settlement = Database['public']['Tables']['household_settlements']['Row']
type SavingsGoal = Database['public']['Tables']['savings_goals']['Row']

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
  initialTransactions?: Transaction[]
  initialSettlements?: Settlement[]
  profileMap?: Map<string, { full_name?: string }>
  initialHouseholdGoals?: SavingsGoal[]
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
  const totalSplit = useMemo(() => members.reduce((sum, m) => sum + m.split_percentage, 0), [members])
  const splitValid = useMemo(() => Math.abs(totalSplit - 100) < 0.01, [totalSplit])
  const mySplit = useMemo(() => members.find(m => m.user_id === userId)?.split_percentage || 0, [members, userId])

  const wrap = useCallback(async (fn: () => Promise<void>) => { setLoading(true); setError(null); try { await fn() } catch (err: any) { setError(err.message) } finally { setLoading(false) } }, [])

  const handleCreate = useCallback(async () => {
    if (!householdName.trim()) return
    await wrap(async () => {
      const res = await fetch('/api/households/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: householdName.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setHousehold(data.household); setHouseholdName(''); setRole('admin')
      setMembers([{ id: '', household_id: data.household.id, user_id: userId, role: 'admin' as const, split_percentage: 100, joined_at: new Date().toISOString() }])
    })
  }, [householdName, wrap, userId])

  const handleRename = useCallback(async () => {
    if (!household || !editHouseholdName.trim()) return
    await wrap(async () => {
      const res = await fetch('/api/households/rename', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: household.id, name: editHouseholdName.trim() }) })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
      setHousehold(prev => prev ? { ...prev, name: editHouseholdName.trim() } : null); setEditingName(false)
    })
  }, [household, editHouseholdName, wrap])

  const handleLeave = useCallback(() => wrap(async () => {
    const res = await fetch('/api/households/leave', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    if (data.householdDeleted) window.location.href = '/hogar'
    else router.refresh()
  }), [wrap, router])

  const handleDelete = useCallback(() => wrap(async () => {
    const res = await fetch('/api/households/delete', { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    window.location.href = '/hogar'
  }), [wrap])

  const handleTransferAdmin = useCallback((memberId: string) => wrap(async () => { const newRole = await transferAdmin(memberId); setRole(newRole) }), [wrap, transferAdmin])
  const handleRemoveMember = useCallback((memberId: string) => wrap(async () => { await removeMember(memberId) }), [wrap, removeMember])

  const handleApplyAutoSplit = useCallback(() => {
    if (membersWithoutIncome.length > 0) {
      const names = membersWithoutIncome.map(m => `• ${m.profiles?.full_name || m.user_id}`).join('\n')
      setError(`Los siguientes miembros no tienen ingresos declarados:\n${names}\n\nDeclará sus ingresos mensuales antes de aplicar el split.`)
      return
    }
    wrap(async () => { await applyAutoSplit(autoSplitMap) })
  }, [membersWithoutIncome, wrap, applyAutoSplit, autoSplitMap])

  const handleSaveSplit = useCallback((memberId: string) => { if (!splitValue) return; wrap(async () => { await updateSplit(memberId, parseFloat(splitValue)); setEditingSplit(null) }) }, [splitValue, wrap, updateSplit])
  const handleSaveIncome = useCallback(() => wrap(async () => { await updateIncome(parseFloat(incomeValue) || 0); setEditingIncome(false) }), [incomeValue, wrap, updateIncome])

  const handleOpenLeave = useCallback(() => setShowLeaveModal(true), [])

  if (!household) return (
    <CreateHouseholdForm householdName={householdName} onNameChange={setHouseholdName} onCreate={handleCreate} loading={loading} error={error} />
  )

  const displayError = error || invite.error

  return (
    <div className="space-y-6">
      <HouseholdHeader
        name={household.name}
        memberCount={members.length}
        isAdmin={isAdmin}
        editing={editingName}
        editValue={editHouseholdName}
        onEditValueChange={setEditHouseholdName}
        onStartEdit={() => { setEditingName(true); setEditHouseholdName(household.name) }}
        onSaveEdit={handleRename}
        onCancelEdit={() => setEditingName(false)}
        loading={loading}
      />

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
        onApplyAutoSplit={handleApplyAutoSplit} onLeave={handleOpenLeave} loading={loading}
      />

      {isAdmin && (
        <InviteSection
          inviteEmail={invite.inviteEmail}
          onEmailChange={invite.setInviteEmail}
          onInvite={invite.handleInvite}
          loading={invite.loading}
          disabled={!invite.inviteEmail.trim()}
          inviteLink={invite.inviteLink}
          copied={invite.copied}
          onCopy={invite.handleCopyLink}
          error={displayError}
        />
      )}

      <HouseholdMonthlyReport data={initialMonthlyReport} />

      <TransactionList transactions={initialTransactions} sharedTransactionIds={sharedTransactionIds} userId={userId} profileMap={profileMap} mySplitPercentage={mySplit} />
      <SettlementHistory settlements={settlements} userId={userId} profileMap={profileMap} />
      <GoalPreview goals={initialHouseholdGoals} />

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold mb-4">¿Cómo funciona el split?</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex flex-col items-center text-center gap-2 p-3 bg-secondary/50 rounded-xl">
            <Banknote className="w-5 h-5 text-emerald-500" />
            <p className="text-xs font-medium">Declará tus ingresos</p>
            <p className="text-[10px] text-muted-foreground">Cada miembro registra su ingreso mensual en ARS</p>
          </div>
          <div className="flex flex-col items-center text-center gap-2 p-3 bg-secondary/50 rounded-xl">
            <div className="flex items-center gap-0.5">
              <div className="w-6 h-2 rounded-full bg-indigo-300" />
              <div className="w-10 h-2 rounded-full bg-indigo-400" />
              <div className="w-4 h-2 rounded-full bg-indigo-500" />
            </div>
            <p className="text-xs font-medium">Se calcula el %</p>
            <p className="text-[10px] text-muted-foreground">El sistema asigna automáticamente la proporción según ingresos</p>
          </div>
          <div className="flex flex-col items-center text-center gap-2 p-3 bg-secondary/50 rounded-xl">
            <Users className="w-5 h-5 text-indigo-500" />
            <p className="text-xs font-medium">División al registrar</p>
            <p className="text-[10px] text-muted-foreground">Cada gasto se reparte entre los miembros al crearlo</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 justify-center">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            {totalIncome > 0 ? 'Auto-split (por ingresos)' : 'Split manual (por % fijo)'}
          </span>
        </div>
      </div>

      {isAdmin && <DangerZone onDelete={() => setShowDeleteModal(true)} />}

      <LeaveModal open={showLeaveModal} householdName={household?.name} isAdmin={isAdmin} otherMembersCount={members.length - 1}
        loading={loading} onConfirm={handleLeave} onClose={() => setShowLeaveModal(false)} />

      <DeleteModal open={showDeleteModal} householdName={household?.name} error={error}
        loading={loading} onConfirm={handleDelete} onClose={() => setShowDeleteModal(false)} />
    </div>
  )
}
