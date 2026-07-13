import type { NextRequest } from 'next/server'

export function getClientIp(request: Request | NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

function getAllowedOrigins(): string[] {
  const origins: string[] = []
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    origins.push(process.env.NEXT_PUBLIC_SITE_URL)
  }
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000')
  }
  return origins
}

export function requireOrigin(request: Request | NextRequest): boolean {
  const allowedOrigins = getAllowedOrigins()
  if (allowedOrigins.length === 0) return true

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  if (origin) {
    return allowedOrigins.some((allowed) => {
      try {
        return new URL(origin).host === new URL(allowed).host
      } catch {
        return origin === allowed
      }
    })
  }

  const referer = request.headers.get('referer')
  if (host && referer) {
    try {
      return new URL(referer).host === host
    } catch {
      return false
    }
  }

  return false
}
