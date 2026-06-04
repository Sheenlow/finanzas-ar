import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TelegramClient } from '@/services/telegramClient'
import { BotProcessor } from '@/services/botProcessor'

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!
const BOT_USER_ID = process.env.BOT_USER_ID!

async function resolveUserId(telegramUserId: number): Promise<string | null> {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await admin.from('bot_users').select('supabase_user_id').eq('telegram_user_id', telegramUserId).maybeSingle()
  return data?.supabase_user_id || null
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== WEBHOOK_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const telegram = new TelegramClient(TELEGRAM_TOKEN)

  const callbackQuery = body.callback_query
  const message = body.message || body.edited_message

  const telegramUserId = (callbackQuery?.from?.id || message?.from?.id) as number | undefined
  const chatId = callbackQuery?.message?.chat?.id || message?.chat?.id
  const text = message?.text
  const voice = message?.voice

  if (!chatId || !telegramUserId) return NextResponse.json({ ok: true })

  // Resolve supabase user
  let supabaseUserId: string | null = null

  // Allow /vincular even without prior linking
  const isVincular = text?.startsWith('/vincular')

  if (!isVincular) {
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

  const effectiveUserId = supabaseUserId || BOT_USER_ID

  // Handle callback queries
  if (callbackQuery) {
    try {
      const messageId = callbackQuery.message?.message_id
      const data = callbackQuery.data
      if (!messageId || !data) { await telegram.answerCallbackQuery(callbackQuery.id); return NextResponse.json({ ok: true }) }

      await telegram.answerCallbackQuery(callbackQuery.id)
      const result = await new BotProcessor(effectiveUserId).handleCallback(data)

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
    const processor = new BotProcessor(effectiveUserId)
    let result: { text: string; keyboard?: { text: string; callback_data: string }[][] }

    if (text) {
      if (isVincular) {
        result = { text: await processor.handleCommand(text, telegramUserId) }
      } else {
        result = await processor.processText(text)
      }
    } else if (voice) {
      await telegram.sendMessage(chatId, '🎤 Procesando tu audio...')
      result = await processor.processVoice(voice.file_id, TELEGRAM_TOKEN)
    } else {
      result = { text: 'Solo acepto mensajes de texto o notas de voz.' }
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
