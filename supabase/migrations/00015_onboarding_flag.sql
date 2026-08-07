-- ====================================================================
-- MIGRATION: 00015_onboarding_flag.sql
-- Agrega flag de onboarding completado a profiles
-- ====================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
