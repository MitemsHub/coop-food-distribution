ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_interest_rate_pct NUMERIC(6,2) NOT NULL DEFAULT 0;

UPDATE public.cycles
SET food_loan_interest_rate_pct = 13
WHERE is_active = TRUE
  AND COALESCE(food_loan_interest_rate_pct, 0) = 0;
