export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-10 w-40 rounded-xl bg-muted animate-pulse" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-3xl bg-muted animate-pulse" />
        ))}
      </div>

      <div className="h-64 rounded-2xl bg-muted animate-pulse" />
    </div>
  )
}
