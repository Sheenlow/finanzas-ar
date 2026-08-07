-- 1. Add payment_method column
ALTER TABLE public.transactions 
ADD COLUMN payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer'));

-- 2. Add installment columns
ALTER TABLE public.transactions 
ADD COLUMN is_installment BOOLEAN DEFAULT FALSE;

ALTER TABLE public.transactions 
ADD COLUMN installments_total INTEGER DEFAULT 1;

ALTER TABLE public.transactions 
ADD COLUMN installment_number INTEGER DEFAULT 1;

ALTER TABLE public.transactions 
ADD COLUMN parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE;
