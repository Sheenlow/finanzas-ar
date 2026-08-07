-- ====================================================================
-- SUPABASE MIGRATION: 00003_households_safe.sql
-- Version with IF NOT EXISTS / IF NOT EXISTS to avoid conflicts
-- Run this ONLY if the migrations 00001 and 00002 already exist
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. HOUSEHOLDS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 2. HOUSEHOLD MEMBERS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    split_percentage NUMERIC(5,2) DEFAULT 0 NOT NULL CHECK (split_percentage >= 0 AND split_percentage <= 100),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(household_id, user_id)
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 3. INVITATIONS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    invited_email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 4. ADD household_id TO TRANSACTIONS (only if column doesn't exist)
-- --------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'household_id'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN household_id UUID REFERENCES public.households(id);
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 5. RLS POLICIES (recreate if they exist)
-- --------------------------------------------------------------------

-- --- households policies ---
DROP POLICY IF EXISTS "Members can view household" ON public.households;
CREATE POLICY "Members can view household"
    ON public.households FOR SELECT
    USING (id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin can update household" ON public.households;
CREATE POLICY "Admin can update household"
    ON public.households FOR UPDATE
    USING (id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'admin'));

-- --- household_members policies ---
DROP POLICY IF EXISTS "Members can view members" ON public.household_members;
CREATE POLICY "Members can view members"
    ON public.household_members FOR SELECT
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin can insert members" ON public.household_members;
CREATE POLICY "Admin can insert members"
    ON public.household_members FOR INSERT
    WITH CHECK (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can update members" ON public.household_members;
CREATE POLICY "Admin can update members"
    ON public.household_members FOR UPDATE
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can delete members" ON public.household_members;
CREATE POLICY "Admin can delete members"
    ON public.household_members FOR DELETE
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "User can join household" ON public.household_members;
CREATE POLICY "User can join household"
    ON public.household_members FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- --- invitations policies ---
DROP POLICY IF EXISTS "Admin can view invitations" ON public.invitations;
CREATE POLICY "Admin can view invitations"
    ON public.invitations FOR SELECT
    USING (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can create invitations" ON public.invitations;
CREATE POLICY "Admin can create invitations"
    ON public.invitations FOR INSERT
    WITH CHECK (household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Anyone can view pending invitation by token" ON public.invitations;
CREATE POLICY "Anyone can view pending invitation by token"
    ON public.invitations FOR SELECT
    USING (status = 'pending');

DROP POLICY IF EXISTS "Invited user can accept invitation" ON public.invitations;
CREATE POLICY "Invited user can accept invitation"
    ON public.invitations FOR UPDATE
    USING (status = 'pending' AND invited_email = (auth.jwt() ->> 'email'))
    WITH CHECK (status = 'accepted');

-- --- transactions policies (replace existing) ---
DROP POLICY IF EXISTS "Users can view own or household transactions" ON public.transactions;
CREATE POLICY "Users can view own or household transactions"
    ON public.transactions FOR SELECT
    USING (
        auth.uid() = user_id
        OR household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert own or household transactions" ON public.transactions;
CREATE POLICY "Users can insert own or household transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own or household transactions" ON public.transactions;
CREATE POLICY "Users can update own or household transactions"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own or household transactions" ON public.transactions;
CREATE POLICY "Users can delete own or household transactions"
    ON public.transactions FOR DELETE
    USING (auth.uid() = user_id);

-- --- accounts policies (replace existing) ---
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
CREATE POLICY "Users can view own accounts"
    ON public.accounts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
CREATE POLICY "Users can insert own accounts"
    ON public.accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
CREATE POLICY "Users can update own accounts"
    ON public.accounts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can delete own accounts"
    ON public.accounts FOR DELETE
    USING (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 6. INDEXES
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_transactions_household ON public.transactions(household_id);
