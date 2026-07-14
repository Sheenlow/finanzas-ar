import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { ConversationFlow } from './conversationFlow'

export class BotProcessor {
  private flow: ConversationFlow

  constructor(userId: string) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const supabase = createAdminClient()
    this.flow = new ConversationFlow(supabase, userId, openai)
  }

  async handleCommand(text: string, telegramUserId?: number): Promise<string> {
    return this.flow.handleCommand(text, telegramUserId)
  }

  async handleCallback(data: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    return this.flow.handleCallback(data)
  }

  async processText(text: string): Promise<{ text: string; keyboard?: { text: string; callback_data: string }[][] }> {
    return this.flow.processText(text)
  }
}
