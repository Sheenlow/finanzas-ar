-- ====================================================================
-- SUPABASE MIGRATION: 00005_categories_update.sql
-- Replaces seed categories for all transaction types
-- ====================================================================

DELETE FROM public.categories;

-- Income categories
INSERT INTO public.categories (name, type, icon, color) VALUES
    ('Sueldo',             'income', 'Briefcase',      '#16a34a'),
    ('Freelance',          'income', 'Laptop',         '#22c55e'),
    ('Inversiones',        'income', 'TrendingUp',     '#10b981'),
    ('Reembolso',          'income', 'RotateCcw',      '#059669'),
    ('Regalo recibido',    'income', 'Gift',           '#ec4899'),
    ('Otros ingresos',     'income', 'Plus',           '#64748b');

-- Expense categories
INSERT INTO public.categories (name, type, icon, color) VALUES
    ('Comida',             'expense', 'Utensils',       '#f97316'),
    ('Regalos',            'expense', 'Gift',           '#ec4899'),
    ('Salud / Médicos',    'expense', 'Heart',          '#ef4444'),
    ('Vivienda',           'expense', 'Home',           '#8b5cf6'),
    ('Transporte',         'expense', 'Car',            '#06b6d4'),
    ('Gastos personales',  'expense', 'ShoppingBag',    '#64748b'),
    ('Mascotas',           'expense', 'PawPrint',       '#eab308'),
    ('Servicios',          'expense', 'Zap',            '#3b82f6'),
    ('Viajes',             'expense', 'Plane',          '#14b8a6'),
    ('Deuda',              'expense', 'Landmark',       '#dc2626'),
    ('Otros',              'expense', 'MoreHorizontal', '#78716c');

-- Transfer category
INSERT INTO public.categories (name, type, icon, color) VALUES
    ('Entre cuentas',      'transfer', 'ArrowLeftRight', '#6366f1');
