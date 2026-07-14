'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: EmptyStateAction
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-14 px-4 text-center',
        'border border-dashed border-border rounded-2xl',
        className
      )}
    >
      {Icon && <Icon className="w-12 h-12 text-muted-foreground/30 mb-4" strokeWidth={1.5} />}
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-5">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
