-- ====================================================================
-- SUPABASE MIGRATION: 00016_atomic_balances.sql
-- Reemplaza updateBalance y settle con operaciones atómicas a nivel BD
-- para eliminar race conditions en escrituras concurrentes.
-- ====================================================================

-- 1. Atomic balance update (INSERT ... ON CONFLICT DO UPDATE es atómico)
CREATE OR REPLACE FUNCTION atomic_update_balance(
  p_household_id UUID,
  p_from UUID,
  p_to UUID,
  p_amount NUMERIC
) RETURNS void AS $$
BEGIN
  INSERT INTO household_balances (household_id, from_user_id, to_user_id, open_amount)
  VALUES (p_household_id, p_from, p_to, p_amount)
  ON CONFLICT (household_id, from_user_id, to_user_id)
  DO UPDATE SET open_amount = household_balances.open_amount + EXCLUDED.open_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic settle (deducción + inserción + marcado en una transacción)
CREATE OR REPLACE FUNCTION atomic_settle(
  p_household_id UUID,
  p_from UUID,
  p_to UUID,
  p_amount NUMERIC
) RETURNS void AS $$
BEGIN
  -- Verificar que el balance existe y es suficiente
  PERFORM 1 FROM household_balances
  WHERE household_id = p_household_id
    AND from_user_id = p_from
    AND to_user_id = p_to
    AND open_amount >= p_amount
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Balance insuficiente o inexistente';
  END IF;

  -- Deducir del balance
  UPDATE household_balances
  SET open_amount = open_amount - p_amount
  WHERE household_id = p_household_id
    AND from_user_id = p_from
    AND to_user_id = p_to;

  -- Eliminar balances en cero
  DELETE FROM household_balances
  WHERE household_id = p_household_id
    AND from_user_id = p_from
    AND to_user_id = p_to
    AND open_amount <= 0;

  -- Insertar registro de liquidación
  INSERT INTO household_settlements (household_id, from_user_id, to_user_id, amount)
  VALUES (p_household_id, p_from, p_to, p_amount);

  -- Marcar share_records como settled
  UPDATE household_share_records
  SET is_settled = true, settled_at = now()
  WHERE household_id = p_household_id
    AND owed_user_id = p_from
    AND paying_user_id = p_to
    AND is_settled = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
