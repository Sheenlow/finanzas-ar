-- ====================================================================
-- SUPABASE MIGRATION: 00007_transaction_types.sql
-- Adds 'subscription' and 'service' to transactions.type CHECK constraint
-- These types were already referenced in application code but missing from DB
-- ====================================================================

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_type_check
CHECK (type IN ('income', 'expense', 'transfer', 'subscription', 'service'));
