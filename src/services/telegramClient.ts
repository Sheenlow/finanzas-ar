const BASE = 'https://api.telegram.org'

interface InlineKeyboardButton {
  text: string
  callback_data: string
}

export class TelegramClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  private async request(method: string, body?: Record<string, any>) {
    const url = `${BASE}/bot${this.token}/${method}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }

  async sendMessage(chatId: number, text: string) {
    return this.request('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    })
  }

  async sendMessageWithKeyboard(
    chatId: number,
    text: string,
    buttons: InlineKeyboardButton[][]
  ) {
    return this.request('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    })
  }

  async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    buttons?: InlineKeyboardButton[][]
  ) {
    const body: Record<string, any> = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    }
    if (buttons) {
      body.reply_markup = { inline_keyboard: buttons }
    }
    return this.request('editMessageText', body)
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    return this.request('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
    })
  }

  async getFile(fileId: string): Promise<{ file_path: string }> {
    const data = await this.request('getFile', { file_id: fileId })
    if (!data.ok) throw new Error(`Telegram getFile error: ${data.description}`)
    return data.result
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const url = `${BASE}/file/bot${this.token}/${filePath}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Telegram download error: ${res.statusText}`)
    return Buffer.from(await res.arrayBuffer())
  }
}
