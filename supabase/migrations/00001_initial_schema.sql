-- ====================================================================
-- SUPABASE MIGRATION: 00001_initial_schema.sql
-- Description: Initial database schema for "Finanzas AR"
-- Specifically designed for the Argentine multi-currency context (ARS/USD).
-- Includes Profiles, Accounts, Categories, Transactions, Savings Goals,
-- Automatic Triggers, and rigorous Row Level Security (RLS) policies.
-- ====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 1. PROFILES TABLE
-- --------------------------------------------------------------------
-- Extends the Supabase auth.users table for application-specific data.
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    full_name TEXT,
    preferred_currency VARCHAR(3) DEFAULT 'ARS' NOT NULL CHECK (preferred_currency IN ('ARS', 'USD')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 2. ACCOUNTS TABLE
-- --------------------------------------------------------------------
-- Holds user accounts. Support for Cash (Colchón/Bolsillo), Bank (Traditional & Virtual),
-- and Crypto (exchanges & self-custody) which are highly popular in Argentina.
CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'crypto')),
    currency VARCHAR(5) NOT NULL CHECK (currency IN ('ARS', 'USD', 'USDT', 'USDC', 'BTC', 'ETH')),
    balance NUMERIC(20, 2) DEFAULT 0.00 NOT NULL,
    color TEXT DEFAULT '#0ea5e9' NOT NULL, -- UI customization (defaults to Celeste)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 3. CATEGORIES TABLE
-- --------------------------------------------------------------------
-- Transactions categories. Supports both global/system categories (user_id IS NULL)
-- and custom user-defined categories.
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL means global/system default
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    icon TEXT DEFAULT 'HelpCircle' NOT NULL, -- Lucide icon identifier
    color TEXT DEFAULT '#94a3b8' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 4. TRANSACTIONS TABLE
-- --------------------------------------------------------------------
-- Central ledger. Tracks income, expenses, and internal transfers.
-- Crucial Argentine aspect: exchange_rate is tracked at the transaction level
-- to correctly convert/calculate net worth in dual currency contexts (blue/MEP/official).
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    destination_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE, -- Only for transfers
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    amount NUMERIC(20, 2) NOT NULL, -- Positive decimal values
    currency VARCHAR(5) NOT NULL CHECK (currency IN ('ARS', 'USD', 'USDT', 'USDC', 'BTC', 'ETH')),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    description TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Exchange rate relative to ARS (e.g., 1000 ARS/USD or 1.0 for ARS-ARS transactions)
    -- Essential to calculate inflation-adjusted and currency-unified balances.
    exchange_rate NUMERIC(20, 6) DEFAULT 1.000000 NOT NULL, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 5. SAVINGS GOALS TABLE
-- --------------------------------------------------------------------
-- Saving targets in ARS or USD (essential due to high ARS volatility, most goals are USD-based).
CREATE TABLE public.savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    target_amount NUMERIC(20, 2) NOT NULL,
    current_amount NUMERIC(20, 2) DEFAULT 0.00 NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL CHECK (currency IN ('ARS', 'USD')),
    target_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Savings Goals
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;


-- ====================================================================
-- RLS POLICIES (Row Level Security)
-- ====================================================================

-- --- profiles policies ---
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- --- accounts policies ---
CREATE POLICY "Users can view their own accounts"
    ON public.accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own accounts"
    ON public.accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts"
    ON public.accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts"
    ON public.accounts FOR DELETE
    USING (auth.uid() = user_id);

-- --- categories policies ---
CREATE POLICY "Users can view system and their own custom categories"
    ON public.categories FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom categories"
    ON public.categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom categories"
    ON public.categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom categories"
    ON public.categories FOR DELETE
    USING (auth.uid() = user_id);

-- --- transactions policies ---
CREATE POLICY "Users can view their own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
    ON public.transactions FOR DELETE
    USING (auth.uid() = user_id);

-- --- savings_goals policies ---
CREATE POLICY "Users can view their own savings goals"
    ON public.savings_goals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings goals"
    ON public.savings_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings goals"
    ON public.savings_goals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own savings goals"
    ON public.savings_goals FOR DELETE
    USING (auth.uid() = user_id);


-- ====================================================================
-- TRIGGERS & PROCEDURES (Automation)
-- ====================================================================

-- 1. Automate user profile creation on Supabase Auth Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, preferred_currency)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Usuario Finanzas'),
        'ARS'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Automate updated_at timestamp columns
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE OR REPLACE TRIGGER update_accounts_modtime
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE OR REPLACE TRIGGER update_savings_goals_modtime
    BEFORE UPDATE ON public.savings_goals
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


-- ====================================================================
-- PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX idx_accounts_user ON public.accounts(user_id);
CREATE INDEX idx_categories_user ON public.categories(user_id);
CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_account ON public.transactions(account_id);
CREATE INDEX idx_savings_goals_user ON public.savings_goals(user_id);


-- ====================================================================
-- SEED SYSTEM DEFAULT CATEGORIES
-- ====================================================================
INSERT INTO public.categories (name, type, icon, color) VALUES
    ('Sueldo / Honorarios', 'income', 'Briefcase', '#10b981'),
    ('Rendimientos / Inversiones', 'income', 'TrendingUp', '#0ea5e9'),
    ('Ventas / Otros Ingresos', 'income', 'DollarSign', '#22c55e'),
    ('Supermercado / Comida', 'expense', 'ShoppingCart', '#f43f5e'),
    ('Alquiler / Expensas', 'expense', 'Home', '#6366f1'),
    ('Servicios (Luz, Gas, Internet)', 'expense', 'Zap', '#eab308'),
    ('Restaurantes / Delivery', 'expense', 'Utensils', '#f97316'),
    ('Transporte / Combustible', 'expense', 'Car', '#06b6d4'),
    ('Salud / Medicina Prepaga', 'expense', 'Heart', '#ec4899'),
    ('Entretenimiento / Ocio', 'expense', 'Film', '#a855f7'),
    ('Compra de Dólares (Ahorro)', 'expense', 'TrendingUp', '#0284c7'),
    ('Ajuste por Inflación / Tipo de Cambio', 'expense', 'Percent', '#64748b'),
    ('Otros Gastos', 'expense', 'HelpCircle', '#94a3b8'),
    ('Transferencia Interna', 'transfer', 'RefreshCw', '#3b82f6');
