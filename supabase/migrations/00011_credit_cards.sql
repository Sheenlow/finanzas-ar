-- ====================================================================
-- SUPABASE MIGRATION: 00011_credit_cards.sql
-- Description: Credit card management with billing cycle awareness.
-- Adds credit_card account type, credit_cards table with closing/due
-- dates, and billing_month column on transactions for accurate
-- monthly budget assignment.
-- ====================================================================

-- 1. Add credit_card to accounts.type CHECK constraint
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('cash', 'bank', 'crypto', 'credit_card'));

-- 2. Create credit_cards table
CREATE TABLE public.credit_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL UNIQUE,
    closing_day INTEGER NOT NULL CHECK (closing_day >= 1 AND closing_day <= 31),
    due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
    credit_limit NUMERIC(20, 2),
    bank_name TEXT,
    last_4_digits TEXT CHECK (last_4_digits IS NULL OR char_length(last_4_digits) = 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Add billing_month to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS billing_month TEXT;

-- 4. Index for billing_month queries
CREATE INDEX IF NOT EXISTS idx_transactions_billing_month
  ON public.transactions(user_id, billing_month);

-- 5. Enable RLS on credit_cards
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit cards"
    ON public.credit_cards FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = credit_cards.account_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own credit cards"
    ON public.credit_cards FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = credit_cards.account_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own credit cards"
    ON public.credit_cards FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = credit_cards.account_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own credit cards"
    ON public.credit_cards FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = credit_cards.account_id
            AND accounts.user_id = auth.uid()
        )
    );

-- 6. Trigger for updated_at on credit_cards
CREATE OR REPLACE TRIGGER update_credit_cards_modtime
    BEFORE UPDATE ON public.credit_cards
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
