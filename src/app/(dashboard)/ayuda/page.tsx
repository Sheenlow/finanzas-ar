import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AyudaContent } from '@/components/AyudaContent'

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
