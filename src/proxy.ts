import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PAGE_PATHS = ['/login', '/signup', '/join', '/auth/callback']
const PUBLIC_API_PATHS = [
  '/api/auth/register',
  '/api/bot/telegram',
  '/api/cron/',
  '/api/webhooks/',
]

function isPublicPath(pathname: string) {
  return PUBLIC_PAGE_PATHS.some((path) => pathname.startsWith(path)) ||
    PUBLIC_API_PATHS.some((path) => pathname.startsWith(path))
}

function isApiPath(pathname: string) {
  return pathname.startsWith('/api')
}

export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      if (isApiPath(request.nextUrl.pathname)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch {
    if (isApiPath(request.nextUrl.pathname)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
