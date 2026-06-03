import { Database } from '@/types/database.types';
import { Target, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

type SavingsGoal = Database['public']['Tables']['savings_goals']['Row'];

export function DashboardGoals({ goals, householdGoals }: { goals: SavingsGoal[], householdGoals?: SavingsGoal[] }) {
  if (goals.length === 0 && (!householdGoals || householdGoals.length === 0)) return null;

  return (
    <section className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-8">
      <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        Metas de ahorro
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.slice(0, 4).map(goal => {
          const progress = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
          const formattedCurrent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: goal.currency }).format(goal.current_amount);
          const formattedTarget = new Intl.NumberFormat('es-AR', { style: 'currency', currency: goal.currency }).format(goal.target_amount);
          
          return (
            <div key={goal.id} className="p-4 bg-secondary/50 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold truncate">{goal.name}</span>
                <span className="text-muted-foreground font-medium">{progress}%</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? "bg-emerald-500" : "bg-primary")} 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground font-medium">
                {formattedCurrent} / {formattedTarget}
              </div>
            </div>
          )
        })}
        {(householdGoals || []).slice(0, 4).map(goal => {
          const progress = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
          const formattedCurrent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: goal.currency }).format(goal.current_amount);
          const formattedTarget = new Intl.NumberFormat('es-AR', { style: 'currency', currency: goal.currency }).format(goal.target_amount);
          
          return (
            <div key={goal.id} className="p-4 bg-secondary/50 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold truncate flex items-center gap-1">
                  {goal.name}
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    <Home className="w-2 h-2 inline" /> Hogar
                  </span>
                </span>
                <span className="text-muted-foreground font-medium">{progress}%</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? "bg-emerald-500" : "bg-primary")} 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground font-medium">
                {formattedCurrent} / {formattedTarget}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
