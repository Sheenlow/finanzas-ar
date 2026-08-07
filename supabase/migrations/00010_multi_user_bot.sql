-- Add link_token for multi-user bot linking
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS link_token UUID DEFAULT gen_random_uuid();

-- Update existing row to have a token if null
UPDATE bot_config SET link_token = gen_random_uuid() WHERE link_token IS NULL;

-- Map telegram users to supabase users
CREATE TABLE IF NOT EXISTS bot_users (
  telegram_user_id BIGINT PRIMARY KEY,
  supabase_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages bot_users"
  ON bot_users
  FOR ALL
  USING (true)
  WITH CHECK (true);
