'use client'

import { useState } from 'react'
import { GoalForm } from './forms/GoalForm'
import GoalItem from './GoalItem'
import { Database } from '@/types/database.types'
import { savingsGoalsService } from '@/services/savingsGoalsService'
import { createClient } from '@/lib/supabase/client'

type SavingsGoal = Database['public']['Tables']['savings_goals']['Row']

export function GoalsContainer({ userId, initialGoals, householdId, householdName, householdGoals, profileMap }: {
  userId: string
  initialGoals: SavingsGoal[]
  householdId?: string | null
  householdName?: string
  householdGoals?: SavingsGoal[]
  profileMap?: Map<string, string>
}) {
  const [showPersonalForm, setShowPersonalForm] = useState(false)
  const [showHouseholdForm, setShowHouseholdForm] = useState(false)
  const [personalGoals, setPersonalGoals] = useState(initialGoals)
  const [hhGoals, setHhGoals] = useState(householdGoals || [])
  const supabase = createClient()

  const refreshPersonal = async () => {
    const updated = await savingsGoalsService.getAll(supabase, userId)
    setPersonalGoals(updated)
  }

  const refreshHousehold = async () => {
    if (!householdId) return
    const updated = await savingsGoalsService.getForHousehold(supabase, householdId)
    setHhGoals(updated)
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Mis Metas</h2>
          <button
            onClick={() => { setShowPersonalForm(!showPersonalForm); setShowHouseholdForm(false) }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
          >
            {showPersonalForm ? 'Cancelar' : 'Crear meta personal'}
          </button>
        </div>
        {showPersonalForm && (
          <section className="max-w-md mb-6">
            <GoalForm userId={userId} onSuccess={() => { setShowPersonalForm(false); refreshPersonal() }} />
          </section>
        )}
        {personalGoals.length === 0 ? (
          <div className="p-6 border border-dashed border-border rounded-2xl text-center text-muted-foreground text-sm">
            Aún no tenés metas personales. Creá tu primera meta.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {personalGoals.map((goal) => (
              <GoalItem key={goal.id} goal={goal} userId={userId} onUpdate={refreshPersonal} />
            ))}
          </div>
        )}
      </section>

      {householdId && householdName && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Metas del Hogar — {householdName}</h2>
            <button
              onClick={() => { setShowHouseholdForm(!showHouseholdForm); setShowPersonalForm(false) }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
            >
              {showHouseholdForm ? 'Cancelar' : 'Crear meta del hogar'}
            </button>
          </div>
          {showHouseholdForm && (
            <section className="max-w-md mb-6">
              <GoalForm userId={userId} householdId={householdId} onSuccess={() => { setShowHouseholdForm(false); refreshHousehold() }} />
            </section>
          )}
          {hhGoals.length === 0 ? (
            <div className="p-6 border border-dashed border-border rounded-2xl text-center text-muted-foreground text-sm">
              Aún no hay metas compartidas en este hogar.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {hhGoals.map((goal) => (
                <GoalItem
                  key={goal.id}
                  goal={goal}
                  userId={userId}
                  onUpdate={refreshHousehold}
                  isHousehold
                  creatorName={goal.user_id === userId ? 'Vos' : profileMap?.get(goal.user_id) || 'Miembro'}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
