import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} />
}

export function CardSkeleton() {
  return <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="h-8 w-36" />
    <Skeleton className="h-4 w-20 rounded-full" />
  </div>
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-border/50">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="text-right space-y-1.5">
        <Skeleton className="h-4 w-20 ml-auto" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-48 w-full" />
  </div>
}

export function FormSkeleton() {
  return <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-40" />
  </div>
}
