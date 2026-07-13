'use client'

import { useState } from 'react'
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { savingsGoalsService } from '@/services/savingsGoalsService'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { GoalForm } from './forms/GoalForm'
import { Target, Plus, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

type SavingsGoal = Database['public']['Tables']['savings_goals']['Row']

async function triggerConfetti() {
  const confetti = (await import('canvas-confetti')).default
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
}

function GoalItemInner({ goal, userId, onUpdate, isHousehold, creatorName }: {
  goal: SavingsGoal
  userId: string
  onUpdate: () => void
  isHousehold?: boolean
  creatorName?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const isOwner = goal.user_id === userId
  const isCompleted = goal.current_amount >= goal.target_amount

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return
    setLoading(true)
    
    try {
      if (isOwner && !isHousehold) {
        const newAmount = Math.min(goal.current_amount + parseFloat(depositAmount), goal.target_amount)
        await savingsGoalsService.update(supabase, goal.id, { current_amount: newAmount })
        if (newAmount >= goal.target_amount) {
          await triggerConfetti()
        }
      } else {
        const res = await fetch('/api/goals/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goalId: goal.id, amount: parseFloat(depositAmount) }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        if (data.newAmount >= goal.target_amount) {
          await triggerConfetti()
        }
      }
      
      setIsDepositModalOpen(false)
      setDepositAmount('')
      onUpdate()
    } catch (error) {
      console.error('Error depositing:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de que deseas borrar esta meta de ahorro?')) {
      try {
        await savingsGoalsService.delete(supabase, goal.id)
        onUpdate()
      } catch (error) {
        console.error('Error deleting goal:', error)
      }
    }
  }

  if (isEditing) {
    return (
      <GoalForm 
        userId={userId} 
        initialGoal={goal} 
        onSuccess={() => {setIsEditing(false); onUpdate()}} 
      />
    )
  }

  const progress = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100)
  const formattedTarget = new Intl.NumberFormat('es-AR', { style: 'currency', currency: goal.currency }).format(goal.target_amount)
  const formattedCurrent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: goal.currency }).format(goal.current_amount)

  return (
    <motion.div 
      animate={isCompleted ? { scale: 1.02, borderColor: '#22c55e' } : { scale: 1, borderColor: 'rgba(229, 231, 235, 0.5)' }}
      className={cn("group p-5 bg-card border rounded-2xl flex flex-col gap-4 shadow-sm animate-scale-in", isCompleted ? "border-emerald-500" : "border-border")}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("p-2 rounded-full", isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-primary")}>
              <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm">{goal.name}</h3>
              {isHousehold && (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  <Home className="w-2.5 h-2.5 inline mr-0.5" />
                  Hogar
                </span>
              )}
            </div>
            {isHousehold && creatorName && (
              <p className="text-[10px] text-muted-foreground">Creada por {creatorName}</p>
            )}
            <p className="text-xs text-muted-foreground">{formattedCurrent} / {formattedTarget}</p>
          </div>
        </div>
        {isOwner && (
          <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="p-2 text-xs hover:bg-secondary rounded-lg font-medium">Editar</button>
            <button onClick={handleDelete} className="p-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium">Borrar</button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-muted-foreground">{progress}% completado</span>
          {!isCompleted && (
            <button onClick={() => setIsDepositModalOpen(true)} className="flex items-center gap-1 text-primary hover:text-primary/80">
                <Plus size={14} /> Agregar
            </button>
          )}
        </div>
        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all duration-500 ease-out", isCompleted ? "bg-emerald-500" : "bg-primary")} 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <AnimatePresence>
        {isDepositModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="deposit-modal-title">
            <motion.div className="bg-card p-6 rounded-2xl shadow-xl w-full max-w-sm space-y-4 animate-scale-in">
                <h3 id="deposit-modal-title" className="text-lg font-semibold">Agregar ahorro</h3>
                <input 
                    type="number" 
                    value={depositAmount} 
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="Monto a depositar"
                    aria-label="Monto a depositar"
                    className="w-full p-2 border border-border rounded-xl"
                />
                <div className="flex gap-2">
                    <button onClick={handleDeposit} disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-bold">Confirmar</button>
                    <button onClick={() => setIsDepositModalOpen(false)} className="flex-1 bg-secondary py-2 rounded-xl text-sm font-medium">Cancelar</button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export const GoalItem = React.memo(GoalItemInner)
