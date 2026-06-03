-- Bot pending: stores in-progress conversation state for interactive expense entry
CREATE TABLE IF NOT EXISTS bot_pending (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  pending JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bot_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bot pending"
  ON bot_pending
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
