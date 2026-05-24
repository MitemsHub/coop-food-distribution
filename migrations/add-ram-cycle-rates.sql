ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS loan_interest_rate_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS vendor_deduction_rate_pct NUMERIC(6,2) NOT NULL DEFAULT 0;

UPDATE public.ram_cycles
SET loan_interest_rate_pct = 6
WHERE is_active = TRUE
  AND COALESCE(loan_interest_rate_pct, 0) = 0;

UPDATE public.ram_cycles
SET vendor_deduction_rate_pct = 6
WHERE is_active = TRUE
  AND COALESCE(vendor_deduction_rate_pct, 0) = 0;

