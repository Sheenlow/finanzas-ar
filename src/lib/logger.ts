import pino from 'pino'

const isProd = process.env.NODE_ENV === 'production'

export const logger = pino({
  level: isProd ? 'info' : 'debug',
  ...(isProd
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
  redact: ['req.headers.authorization', 'req.headers.cookie'],
})

export function createContextLogger(context: {
  userId?: string
  path?: string
  operation?: string
  entityId?: string
}) {
  return logger.child(context)
}
