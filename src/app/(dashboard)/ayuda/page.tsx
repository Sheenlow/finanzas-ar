import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
const AyudaContent = dynamic(() => import('@/components/AyudaContent').then(mod => mod.AyudaContent), {
  loading: () => <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-pulse"><div className="h-8 w-48 bg-muted rounded mb-4" /><div className="h-4 w-full bg-muted rounded mb-2" /><div className="h-4 w-3/4 bg-muted rounded" /></div>
})

export default async function AyudaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <AyudaContent />
    </div>
  )
}
