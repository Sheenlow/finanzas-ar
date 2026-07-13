import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TelegramClient } from '@/services/telegramClient'
import { BotProcessor } from '@/services/bot'
import { getClientIp } from '@/lib/security'
import { telegramLimiter } from '@/lib/rateLimit'

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!

async function resolveUserId(telegramUserId: number): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('bot_users').select('supabase_user_id').eq('telegram_user_id', telegramUserId).maybeSingle()
  return (data as unknown as { supabase_user_id: string } | null)?.supabase_user_id || null
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== WEBHOOK_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Rate limiting: 60 requests per minute per IP
  const ip = getClientIp(req)
  const { success } = await telegramLimiter.limit(ip)
  if (!success) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  const body = await req.json()
  const telegram = new TelegramClient(TELEGRAM_TOKEN)

  const callbackQuery = body.callback_query
  const message = body.message || body.edited_message

  const telegramUserId = (callbackQuery?.from?.id || message?.from?.id) as number | undefined
  const chatId = callbackQuery?.message?.chat?.id || message?.chat?.id
  const text = message?.text

  if (!chatId || !telegramUserId) return NextResponse.json({ ok: true })

  // Resolve supabase user
  let supabaseUserId: string | null = null

  // Allow /vincular and /desvincular even without prior linking
  const isVincularCmd = text?.startsWith('/vincular')
  const isDesvincularCmd = text?.startsWith('/desvincular')
  const needsTelegramId = isVincularCmd || isDesvincularCmd

  if (!isVincularCmd && !isDesvincularCmd) {
    supabaseUserId = await resolveUserId(telegramUserId)
    if (!supabaseUserId) {
      await telegram.sendMessage(chatId,
        '🤖 Todavía no vinculaste tu cuenta.\n\n' +
        '1. Andá al Dashboard de la app\n' +
        '2. Copiá el código de vinculación\n' +
        '3. Enviame: /vincular TU-CÓDIGO\n\n' +
        'Ejemplo: /vincular a1b2c3d4-e5f6-...'
      ).catch(() => {})
      return NextResponse.json({ ok: true })
    }
  }

  // At this point supabaseUserId is guaranteed for normal messages (non-/vincular,/desvincular).
  // For /vincular and /desvincular supabaseUserId may be null, but handleCommand for those
  // does NOT use this.userId for queries — it resolves the target user from the link token.
  const processorUserId = supabaseUserId || '00000000-0000-0000-0000-000000000000'

  // Handle callback queries
  if (callbackQuery) {
    if (!supabaseUserId) {
      return NextResponse.json({ ok: true })
    }
    try {
      const messageId = callbackQuery.message?.message_id
      const data = callbackQuery.data
      if (!messageId || !data) { await telegram.answerCallbackQuery(callbackQuery.id); return NextResponse.json({ ok: true }) }

      await telegram.answerCallbackQuery(callbackQuery.id)
      const result = await new BotProcessor(supabaseUserId).handleCallback(data)

      if (result.keyboard && result.keyboard.length > 0) {
        await telegram.editMessageText(chatId, messageId, result.text, result.keyboard)
      } else {
        await telegram.editMessageText(chatId, messageId, result.text)
      }
    } catch (error) {
      console.error('Callback error:', error)
      try { await telegram.answerCallbackQuery(callbackQuery.id, 'Error') } catch {}
    }
    return NextResponse.json({ ok: true })
  }

  // Handle messages
  if (!message) return NextResponse.json({ ok: true })

  try {
    const processor = new BotProcessor(processorUserId)
    let result: { text: string; keyboard?: { text: string; callback_data: string }[][] }

    if (text) {
      if (needsTelegramId) {
        result = { text: await processor.handleCommand(text, telegramUserId) }
      } else {
        result = await processor.processText(text)
      }
    } else {
      result = { text: 'Solo acepto mensajes de texto.' }
    }

    if (result.keyboard && result.keyboard.length > 0) {
      await telegram.sendMessageWithKeyboard(chatId, result.text, result.keyboard)
    } else {
      await telegram.sendMessage(chatId, result.text)
    }
  } catch (error) {
    console.error('Bot error:', error)
    await telegram.sendMessage(chatId, 'Ocurrió un error. Intentá de nuevo.').catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
