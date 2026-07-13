import { XCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'error' | 'success' | 'warning' | 'info'

interface AlertProps {
  variant: AlertVariant
  children: React.ReactNode
  className?: string
}

const variantConfig: Record<AlertVariant, {
  icon: typeof XCircle
  containerClass: string
  iconClass: string
}> = {
  error: {
    icon: XCircle,
    containerClass: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400',
    iconClass: 'text-rose-500 dark:text-rose-400',
  },
  success: {
    icon: CheckCircle2,
    containerClass: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    iconClass: 'text-emerald-500 dark:text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    iconClass: 'text-amber-500 dark:text-amber-400',
  },
  info: {
    icon: Info,
    containerClass: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    iconClass: 'text-blue-500 dark:text-blue-400',
  },
}

export function Alert({ variant, children, className }: AlertProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 px-4 py-3 border rounded-xl text-sm',
        config.containerClass,
        className
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', config.iconClass)} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
