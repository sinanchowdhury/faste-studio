-- FASTE STUDIO: seller management migration
-- Run once in Supabase SQL Editor before deploying the updated app files.

CREATE TABLE IF NOT EXISTS public.sellers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_code text NOT NULL,
    name text NOT NULL,
    balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, seller_code)
);

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL;

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own sellers" ON public.sellers;
DROP POLICY IF EXISTS "Users can insert own sellers" ON public.sellers;
DROP POLICY IF EXISTS "Users can update own sellers" ON public.sellers;
DROP POLICY IF EXISTS "Users can delete own sellers" ON public.sellers;
CREATE POLICY "Users can view own sellers" ON public.sellers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sellers" ON public.sellers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own sellers" ON public.sellers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own sellers" ON public.sellers FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS sellers_user_id_idx ON public.sellers(user_id);
CREATE INDEX IF NOT EXISTS sales_seller_id_idx ON public.sales(seller_id);
CREATE INDEX IF NOT EXISTS withdrawals_seller_id_idx ON public.withdrawals(seller_id);
NOTIFY pgrst, 'reload schema';
