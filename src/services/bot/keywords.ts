import { SupabaseClient } from '@supabase/supabase-js'
import type { KeywordRule } from './types'

export async function saveKeywordRule(
  supabase: SupabaseClient,
  userId: string,
  keyword: string,
  field: 'category_name' | 'account_name' | 'type',
  value: string
) {
  await supabase.from('bot_rules').upsert(
    { user_id: userId, keyword: keyword.toLowerCase(), field, value },
    { onConflict: 'user_id,keyword,field' }
  )
}

export async function getKeywordRules(supabase: SupabaseClient, userId: string): Promise<KeywordRule[]> {
  const { data } = await supabase.from('bot_rules').select('keyword, field, value').eq('user_id', userId)
  return (data || []) as KeywordRule[]
}

export async function getCustomPrompt(supabase: SupabaseClient, userId: string): Promise<string | undefined> {
  const { data } = await supabase.from('bot_config').select('custom_prompt').eq('user_id', userId).maybeSingle()
  return data?.custom_prompt || undefined
}
