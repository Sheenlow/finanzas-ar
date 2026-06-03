import { NextRequest, NextResponse } from 'next/server'
import { TelegramClient } from '@/services/telegramClient'
import { BotProcessor } from '@/services/botProcessor'

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!
const BOT_USER_ID = process.env.BOT_USER_ID!

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== WEBHOOK_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const telegram = new TelegramClient(TELEGRAM_TOKEN)

  // Handle callback queries (inline button presses)
  const callbackQuery = body.callback_query
  if (callbackQuery) {
    try {
      const chatId = callbackQuery.message?.chat?.id
      const messageId = callbackQuery.message?.message_id
      const data = callbackQuery.data

      if (!chatId || !messageId || !data) {
        await telegram.answerCallbackQuery(callbackQuery.id)
        return NextResponse.json({ ok: true })
      }

      await telegram.answerCallbackQuery(callbackQuery.id)

      const result = await new BotProcessor(BOT_USER_ID).handleCallback(data)
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
  const message = body.message || body.edited_message
  if (!message) return NextResponse.json({ ok: true })

  const chatId = message.chat?.id
  const text = message.text
  const voice = message.voice

  if (!chatId) return NextResponse.json({ ok: true })

  try {
    const processor = new BotProcessor(BOT_USER_ID)
    let result: { text: string; keyboard?: { text: string; callback_data: string }[][] }

    if (text) {
      result = await processor.processText(text)
    } else if (voice) {
      await telegram.sendMessage(chatId, '🎤 Procesando tu audio...')
      result = await processor.processVoice(voice.file_id, TELEGRAM_TOKEN)
    } else {
      result = {
        text: 'Solo acepto mensajes de texto o notas de voz. Probá:\n\nSupermercado 8000 en Efectivo\nNetflix 12 USD débito suscripción',
      }
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
