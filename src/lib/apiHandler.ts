import { NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body)
}

export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: (body: T, req: Request) => Promise<NextResponse>
) {
  return async (req: Request) => {
    try {
      const body = schema.parse(await req.json())
      return handler(body, req)
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: 'Datos inválidos', details: err.issues },
          { status: 400 }
        )
      }
      throw err
    }
  }
}
