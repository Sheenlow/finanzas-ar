'use client'

import { useState } from 'react'
import { savingsGoalsService } from '@/services/savingsGoalsService'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { CustomSelect } from '../ui/CustomSelect'
import { Users } from 'lucide-react'

type SavingsGoal = Database['public']['Tables']['savings_goals']['Row']

export function GoalForm({ userId, householdId, initialGoal, onSuccess }: { 
  userId: string,
  householdId?: string | null,
  initialGoal?: SavingsGoal,
  onSuccess?: () => void 
}) {
  const router = useRouter()
  const supabase = createClient()
  const isEditing = !!initialGoal
  const isHouseholdGoal = !!initialGoal?.household_id
  const [name, setName] = useState(initialGoal?.name || '')
  const [targetAmount, setTargetAmount] = useState(initialGoal?.target_amount.toString() || '')
  const [currentAmount, setCurrentAmount] = useState(initialGoal?.current_amount?.toString() || '0')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(initialGoal?.currency as 'ARS' | 'USD' || 'ARS')
  const [targetDate, setTargetDate] = useState(initialGoal?.target_date ? initialGoal.target_date.split('T')[0] : '')
  const [isShared, setIsShared] = useState(isHouseholdGoal)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const goalData: any = {
        user_id: userId,
        name,
        target_amount: parseFloat(targetAmount),
        current_amount: parseFloat(currentAmount),
        currency,
        target_date: targetDate ? new Date(targetDate).toISOString() : null
      }

      if (!isEditing && isShared && householdId) {
        goalData.household_id = householdId
      }

      if (initialGoal) {
        await savingsGoalsService.update(supabase, initialGoal.id, goalData)
      } else {
        await savingsGoalsService.create(supabase, goalData)
      }
      
      router.refresh()
      if (onSuccess) onSuccess()
      if (!initialGoal) {
        setName('')
        setTargetAmount('')
        setCurrentAmount('0')
        setTargetDate('')
        setIsShared(false)
      }
    } catch (error) {
      console.error('Error saving goal:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-2xl bg-card shadow-sm">
      <h2 className="text-lg font-semibold">{initialGoal ? 'Editar Meta' : 'Nueva Meta de Ahorro'}</h2>
      <input
        type="text"
        placeholder="Nombre de la meta (ej. Auto, Vacaciones)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all"
        required
      />
      <input
        type="number"
        placeholder="Monto objetivo"
        value={targetAmount}
        onChange={(e) => setTargetAmount(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all"
        required
      />
      <input
        type="number"
        placeholder="Monto ya ahorrado"
        value={currentAmount}
        onChange={(e) => setCurrentAmount(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all"
        required
      />
      <CustomSelect 
        value={currency} 
        onChange={(val) => setCurrency(val as 'ARS' | 'USD')}
        options={[
            { value: 'ARS', label: 'ARS' },
            { value: 'USD', label: 'USD' }
        ]}
      />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground ml-1">Fecha objetivo (Opcional)</label>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border transition-all text-sm"
        />
      </div>
      {!isEditing && householdId && (
        <label className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
          <input
            type="checkbox"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            className="rounded"
          />
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Meta compartida con el hogar</span>
        </label>
      )}
      <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2 rounded-xl font-medium hover:opacity-90 transition-opacity">
        {loading ? 'Guardando...' : initialGoal ? 'Actualizar Meta' : 'Crear Meta'}
      </button>
    </form>
  )
}
