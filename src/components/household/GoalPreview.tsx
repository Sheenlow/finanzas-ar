'use client'

import { Target } from 'lucide-react'

interface GoalPreviewProps {
  goals: any[]
}

export function GoalPreview({ goals }: GoalPreviewProps) {
  if (goals.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Metas del hogar
      </h3>
      <div className="space-y-3">
        {goals.slice(0, 4).map((goal: any) => {
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
  )
}
