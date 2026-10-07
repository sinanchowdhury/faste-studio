-- FASTE Studio: targeted Sales + Balance repair
-- Does NOT alter Product, Production, Product House, or their UI/data.
-- Run once in Supabase SQL Editor.

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_pcs numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_per_set numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS manager_per_set numeric NOT NULL DEFAULT 0;

ALTER TABLE public.ledger ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Attach legacy rows to the existing account without deleting data.
UPDATE public.sales
SET user_id = (SELECT id FROM auth.users WHERE lower(email)=lower('fastestudio.in@gmail.com') LIMIT 1)
WHERE user_id IS NULL;
UPDATE public.ledger
SET user_id = (SELECT id FROM auth.users WHERE lower(email)=lower('fastestudio.in@gmail.com') LIMIT 1)
WHERE user_id IS NULL;
UPDATE public.withdrawals
SET user_id = (SELECT id FROM auth.users WHERE lower(email)=lower('fastestudio.in@gmail.com') LIMIT 1)
WHERE user_id IS NULL;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sales" ON public.sales;
DROP POLICY IF EXISTS "Users can insert own sales" ON public.sales;
DROP POLICY IF EXISTS "Users can update own sales" ON public.sales;
DROP POLICY IF EXISTS "Users can delete own sales" ON public.sales;
CREATE POLICY "Users can view own sales" ON public.sales FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own sales" ON public.sales FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own sales" ON public.sales FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own ledger" ON public.ledger;
DROP POLICY IF EXISTS "Users can insert own ledger" ON public.ledger;
DROP POLICY IF EXISTS "Users can update own ledger" ON public.ledger;
DROP POLICY IF EXISTS "Users can delete own ledger" ON public.ledger;
CREATE POLICY "Users can view own ledger" ON public.ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own ledger" ON public.ledger FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own ledger" ON public.ledger FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own ledger" ON public.ledger FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users can insert own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users can update own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users can delete own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can view own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own withdrawals" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own withdrawals" ON public.withdrawals FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own withdrawals" ON public.withdrawals FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Remove only old automatic sale entries created by previous buggy versions.
DELETE FROM public.ledger
WHERE note ILIKE 'auto_sale_revenue:%'
   OR note ILIKE 'auto_sale_role:%'
   OR note ILIKE 'AUTO_SALE_ROLE:%';

-- Rebuild one revenue row + one role row per existing sale.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public.sales WHERE user_id IS NOT NULL LOOP
    IF COALESCE(r.total_sale,0) > 0 THEN
      INSERT INTO public.ledger(user_id,date,type,title,amount,note)
      VALUES (r.user_id,r.date,'Income','Sale Revenue',COALESCE(r.total_sale,0),'auto_sale_revenue:' || r.id::text);
    END IF;
    IF COALESCE(r.seller_profit,0) > 0 THEN
      INSERT INTO public.ledger(user_id,date,type,title,amount,note)
      VALUES (r.user_id,r.date,'Income','Seller Income',COALESCE(r.seller_profit,0),'auto_sale_role:seller:' || r.id::text);
    END IF;
    IF COALESCE(r.manager_profit,0) > 0 THEN
      INSERT INTO public.ledger(user_id,date,type,title,amount,note)
      VALUES (r.user_id,r.date,'Income','Manager Income',COALESCE(r.manager_profit,0),'auto_sale_role:manager:' || r.id::text);
    END IF;
    IF COALESCE(r.investor_profit,0) > 0 THEN
      INSERT INTO public.ledger(user_id,date,type,title,amount,note)
      VALUES (r.user_id,r.date,'Income','Investor Income',COALESCE(r.investor_profit,0),'auto_sale_role:investor:' || r.id::text);
    END IF;
    IF COALESCE(r.admin_profit,0) > 0 THEN
      INSERT INTO public.ledger(user_id,date,type,title,amount,note)
      VALUES (r.user_id,r.date,'Income','Admin Income',COALESCE(r.admin_profit,0),'auto_sale_role:admin:' || r.id::text);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

/* =========================================================
   SALES RETURN SUPPORT
   Added without changing Product / Production / Product House data
   ========================================================= */

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS return_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS returned_sets numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS returned_pcs numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS returned_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS returned_cost numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS returned_seller_profit numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS returned_manager_profit numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS returned_investor_profit numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS returned_admin_profit numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS returned_at timestamptz;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS return_items jsonb NOT NULL DEFAULT '[]'::jsonb;

/* Store Member Name support */
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS member_name text;

NOTIFY pgrst, 'reload schema';
