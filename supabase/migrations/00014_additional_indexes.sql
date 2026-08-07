-- ====================================================================
-- SUPABASE MIGRATION: 00014_additional_indexes.sql
-- Description: Indices adicionales para optimizar queries frecuentes
-- ====================================================================

-- 1. Transacciones por usuario ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);

-- 2. Transacciones por household ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_transactions_household_date ON transactions(household_id, transaction_date DESC);

-- 3. Transacciones con parent (para búsquedas de hijos)
CREATE INDEX IF NOT EXISTS idx_transactions_parent ON transactions(parent_transaction_id) WHERE parent_transaction_id IS NOT NULL;

-- 4. Balances de household por combinación de usuarios
CREATE INDEX IF NOT EXISTS idx_household_balances_lookup ON household_balances(household_id, from_user_id, to_user_id);

-- 5. Depósitos de metas ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_goal_deposits_goal_date ON goal_deposits(goal_id, created_at DESC);

-- 6. Reglas de bot por usuario y keyword
CREATE INDEX IF NOT EXISTS idx_bot_rules_user_keyword ON bot_rules(user_id, keyword);
