-- ====================================================================
-- SUPABASE MIGRATION: 00006_household_goals.sql
-- Description: Shared household savings goals + goal deposit audit trail
-- ====================================================================

-- 1. Add household_id to savings_goals
ALTER TABLE public.savings_goals
ADD COLUMN household_id UUID REFERENCES public.households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_savings_goals_household ON public.savings_goals(household_id);

-- 2. Goal deposits audit table
CREATE TABLE public.goal_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.goal_deposits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_goal_deposits_goal ON public.goal_deposits(goal_id);

-- 3. Replace savings_goals RLS policies for household support

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can insert their own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can update their own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can delete their own savings goals" ON public.savings_goals;

-- SELECT: own goals OR household goals (any member)
CREATE POLICY "Users can view own or household savings goals"
    ON public.savings_goals FOR SELECT
    USING (
        auth.uid() = user_id
        OR household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );

-- INSERT: only the owner
CREATE POLICY "Users can insert their own savings goals"
    ON public.savings_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: only the creator (owner)
CREATE POLICY "Users can update their own savings goals"
    ON public.savings_goals FOR UPDATE
    USING (auth.uid() = user_id);

-- DELETE: only the creator (owner)
CREATE POLICY "Users can delete their own savings goals"
    ON public.savings_goals FOR DELETE
    USING (auth.uid() = user_id);

-- 4. RLS for goal_deposits
CREATE POLICY "Users can view deposits on visible goals"
    ON public.goal_deposits FOR SELECT
    USING (
        goal_id IN (
            SELECT id FROM public.savings_goals
            WHERE auth.uid() = user_id
               OR household_id IN (
                   SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
               )
        )
    );

CREATE POLICY "Users can insert deposits on visible goals"
    ON public.goal_deposits FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND goal_id IN (
            SELECT id FROM public.savings_goals
            WHERE auth.uid() = user_id
               OR household_id IN (
                   SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
               )
        )
    );
