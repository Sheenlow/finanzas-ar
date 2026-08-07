-- ====================================================================
-- SUPABASE MIGRATION: 00012_billing_cycles.sql
-- Description: Soporte para ciclos de facturación variables y reglas
-- de estimación automática de fecha de cierre (último jueves del mes).
-- ====================================================================

-- 1. Agregar closing_rule a credit_cards
ALTER TABLE public.credit_cards
  ADD COLUMN IF NOT EXISTS closing_rule TEXT NOT NULL DEFAULT 'last_thursday'
  CHECK (closing_rule IN ('fixed', 'last_thursday'));

-- 2. Crear tabla billing_cycles para registrar cierres reales
CREATE TABLE public.billing_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE NOT NULL,
    close_date DATE NOT NULL,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (credit_card_id, close_date)
);

-- 3. Indice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_billing_cycles_card_date
  ON public.billing_cycles(credit_card_id, close_date);

-- 4. RLS para billing_cycles (misma lógica que credit_cards)
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own billing cycles"
    ON public.billing_cycles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.credit_cards
            JOIN public.accounts ON accounts.id = credit_cards.account_id
            WHERE credit_cards.id = billing_cycles.credit_card_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own billing cycles"
    ON public.billing_cycles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.credit_cards
            JOIN public.accounts ON accounts.id = credit_cards.account_id
            WHERE credit_cards.id = billing_cycles.credit_card_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own billing cycles"
    ON public.billing_cycles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.credit_cards
            JOIN public.accounts ON accounts.id = credit_cards.account_id
            WHERE credit_cards.id = billing_cycles.credit_card_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own billing cycles"
    ON public.billing_cycles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.credit_cards
            JOIN public.accounts ON accounts.id = credit_cards.account_id
            WHERE credit_cards.id = billing_cycles.credit_card_id
            AND accounts.user_id = auth.uid()
        )
    );
