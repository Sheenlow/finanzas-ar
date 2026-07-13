'use client'

import { DollarSign, Percent, RotateCcw, UserCog, UserMinus, Wand2 } from 'lucide-react'
import { IncomeEditor } from './IncomeEditor'
import { SplitEditor } from './SplitEditor'

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

interface MemberListProps {
  members: Member[]
  incomes: HouseholdIncome[]
  incomeMap: Map<string, number>
  totalIncome: number
  autoSplitMap: Map<string, number>
  userId: string
  isAdmin: boolean
  editingSplit: string | null
  splitValue: string
  editingIncome: boolean
  incomeValue: string
  totalSplit: number
  splitValid: boolean
  membersWithoutIncome: Member[]
  onEditSplit: (memberId: string, currentValue: number) => void
  onSplitValueChange: (value: string) => void
  onSaveSplit: (memberId: string) => void
  onCancelSplit: () => void
  onEditIncome: (currentValue: number) => void
  onIncomeValueChange: (value: string) => void
  onSaveIncome: () => void
  onCancelIncome: () => void
  onTransferAdmin: (memberId: string) => void
  onRemoveMember: (memberId: string) => void
  onApplyAutoSplit: () => void
  onLeave: () => void
  loading: boolean
}

export function MemberList({
  members,
  incomeMap,
  totalIncome,
  autoSplitMap,
  userId,
  isAdmin,
  editingSplit,
  splitValue,
  editingIncome,
  incomeValue,
  totalSplit,
  splitValid,
  membersWithoutIncome,
  onEditSplit,
  onSplitValueChange,
  onSaveSplit,
  onCancelSplit,
  onEditIncome,
  onIncomeValueChange,
  onSaveIncome,
  onCancelIncome,
  onTransferAdmin,
  onRemoveMember,
  onApplyAutoSplit,
  onLeave,
  loading,
}: MemberListProps) {
  return (
    <>
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
            const income = incomeMap.get(member.user_id) || 0
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
                      {member.role === 'admin' && <span className="text-[10px] ml-1.5 text-muted-foreground">(admin)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isMe && editingIncome ? (
                    <IncomeEditor
                      value={incomeValue}
                      onChange={onIncomeValueChange}
                      onSave={onSaveIncome}
                      onCancel={onCancelIncome}
                      loading={loading}
                    />
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
                          onClick={() => onEditIncome(income)}
                          className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded"
                          aria-label="Editar ingreso"
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
          <Percent className="w-4 h-4" />
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
            const isEditing = editingSplit === member.id

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
                  {isEditing ? (
                    <SplitEditor
                      value={splitValue}
                      onChange={onSplitValueChange}
                      onSave={() => onSaveSplit(member.id)}
                      onCancel={onCancelSplit}
                      loading={loading}
                    />
                  ) : (
                    <>
                      <span className="text-sm font-semibold tabular-nums">{manualSplit}%</span>
                      {isAdmin && (
                        <button
                          onClick={() => onEditSplit(member.id, manualSplit)}
                          className="p-1 text-xs text-muted-foreground hover:bg-secondary rounded"
                          aria-label="Editar porcentaje"
                        >
                          <Percent className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isAdmin && !isMe && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onTransferAdmin(member.id)}
                            className="p-1 text-xs text-blue-500 hover:bg-blue-50 rounded"
                            title="Transferir admin"
                            aria-label="Transferir administración"
                          >
                            <UserCog className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onRemoveMember(member.id)}
                            className="p-1 text-xs text-rose-500 hover:bg-rose-50 rounded"
                            title="Expulsar"
                            aria-label="Expulsar miembro"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {totalIncome > 0 && isAdmin && membersWithoutIncome.length === 0 && (
          <button
            onClick={onApplyAutoSplit}
            disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4" />
            Aplicar split automático a todos
          </button>
        )}
        {totalIncome > 0 && isAdmin && membersWithoutIncome.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <p className="font-medium mb-1">Faltan ingresos por declarar</p>
            <p className="text-xs text-amber-700">
              {membersWithoutIncome.length === 1
                ? 'Hay 1 miembro sin ingresos declarados.'
                : `Hay ${membersWithoutIncome.length} miembros sin ingresos declarados.`}{' '}
              Todos los miembros deben declarar sus ingresos mensuales para usar el split automático.
            </p>
          </div>
        )}
        {!isAdmin && (
          <button
            onClick={onLeave}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
          >
            Salirse del hogar
          </button>
        )}
      </div>
    </>
  )
}
