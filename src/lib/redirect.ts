import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function safeRedirect(path: string): Promise<never> {
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  redirect(`${protocol}://${host}${path}`)
}
