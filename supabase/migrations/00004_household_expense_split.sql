-- ====================================================================
-- SUPABASE MIGRATION: 00004_household_expense_split.sql
-- Sistema de split automático de gastos del hogar
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. HOUSEHOLD INCOMES TABLE
-- Stores monthly income for each household member (optional, for auto-split)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_incomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    monthly_income_ars NUMERIC(14,2) DEFAULT 0 NOT NULL CHECK (monthly_income_ars >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(household_id, user_id)
);

ALTER TABLE public.household_incomes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 2. HOUSEHOLD SHARE RECORDS TABLE
-- Tracks how each household expense was split among members
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_share_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    paying_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    owed_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    share_amount NUMERIC(14,2) NOT NULL CHECK (share_amount >= 0),
    split_percentage NUMERIC(5,2) NOT NULL CHECK (split_percentage >= 0 AND split_percentage <= 100),
    is_settled BOOLEAN DEFAULT FALSE NOT NULL,
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.household_share_records ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 3. HOUSEHOLD BALANCES TABLE
-- Current open balances between household member pairs
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    open_amount NUMERIC(14,2) DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(household_id, from_user_id, to_user_id)
);

ALTER TABLE public.household_balances ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 4. HOUSEHOLD SETTLEMENTS TABLE
-- History of settlements between members
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.household_settlements ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 5. RLS POLICIES FOR NEW TABLES
-- --------------------------------------------------------------------

-- --- household_incomes policies ---
DROP POLICY IF EXISTS "Members can view household incomes" ON public.household_incomes;
CREATE POLICY "Members can view household incomes"
    ON public.household_incomes FOR SELECT
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can insert own household income" ON public.household_incomes;
CREATE POLICY "Members can insert own household income"
    ON public.household_incomes FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can update own household income" ON public.household_incomes;
CREATE POLICY "Members can update own household income"
    ON public.household_incomes FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- --- household_share_records policies ---
DROP POLICY IF EXISTS "Members can view household share records" ON public.household_share_records;
CREATE POLICY "Members can view household share records"
    ON public.household_share_records FOR SELECT
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can insert household share records" ON public.household_share_records;
CREATE POLICY "Members can insert household share records"
    ON public.household_share_records FOR INSERT
    WITH CHECK (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can update household share records" ON public.household_share_records;
CREATE POLICY "Members can update household share records"
    ON public.household_share_records FOR UPDATE
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

-- --- household_balances policies ---
DROP POLICY IF EXISTS "Members can view household balances" ON public.household_balances;
CREATE POLICY "Members can view household balances"
    ON public.household_balances FOR SELECT
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can update household balances" ON public.household_balances;
CREATE POLICY "Members can update household balances"
    ON public.household_balances FOR UPDATE
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can insert household balances" ON public.household_balances;
CREATE POLICY "Members can insert household balances"
    ON public.household_balances FOR INSERT
    WITH CHECK (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

-- --- household_settlements policies ---
DROP POLICY IF EXISTS "Members can view household settlements" ON public.household_settlements;
CREATE POLICY "Members can view household settlements"
    ON public.household_settlements FOR SELECT
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can insert household settlements" ON public.household_settlements;
CREATE POLICY "Members can insert household settlements"
    ON public.household_settlements FOR INSERT
    WITH CHECK (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

-- --------------------------------------------------------------------
-- 6. FUNCTIONS & TRIGGERS
-- --------------------------------------------------------------------

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_household_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for household_balances updated_at
DROP TRIGGER IF EXISTS update_household_balances_timestamp ON public.household_balances;
CREATE TRIGGER update_household_balances_timestamp
    BEFORE UPDATE ON public.household_balances
    FOR EACH ROW EXECUTE FUNCTION public.update_household_balance_timestamp();

-- Trigger for household_incomes updated_at
DROP TRIGGER IF EXISTS update_household_incomes_timestamp ON public.household_incomes;
CREATE TRIGGER update_household_incomes_timestamp
    BEFORE UPDATE ON public.household_incomes
    FOR EACH ROW EXECUTE FUNCTION public.update_household_balance_timestamp();

-- --------------------------------------------------------------------
-- 7. INDEXES
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_household_incomes_user ON public.household_incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_household_incomes_household ON public.household_incomes(household_id);
CREATE INDEX IF NOT EXISTS idx_household_share_records_transaction ON public.household_share_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_household_share_records_household ON public.household_share_records(household_id);
CREATE INDEX IF NOT EXISTS idx_household_share_records_paying ON public.household_share_records(paying_user_id);
CREATE INDEX IF NOT EXISTS idx_household_share_records_owed ON public.household_share_records(owed_user_id);
CREATE INDEX IF NOT EXISTS idx_household_balances_household ON public.household_balances(household_id);
CREATE INDEX IF NOT EXISTS idx_household_balances_pair ON public.household_balances(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_household_settlements_household ON public.household_settlements(household_id);
CREATE INDEX IF NOT EXISTS idx_household_settlements_pair ON public.household_settlements(from_user_id, to_user_id);
