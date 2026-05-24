-- Food Distribution: cycle policy (loan amount caps) + Banks (per branch, per cycle)

ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_eligible_amount_cap BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_grace_amount_cap BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_eligible_amount_cap_pensioner BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_eligible_amount_cap_retiree BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_eligible_amount_cap_active BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_grace_amount_cap_pensioner BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_grace_amount_cap_retiree BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_grace_amount_cap_active BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.cycles
ADD COLUMN IF NOT EXISTS food_loan_cap_include_interest BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.cycles
SET food_loan_eligible_amount_cap = COALESCE(food_loan_eligible_amount_cap, 0),
    food_loan_grace_amount_cap = COALESCE(food_loan_grace_amount_cap, 0),
    food_loan_eligible_amount_cap_pensioner = COALESCE(food_loan_eligible_amount_cap_pensioner, 0),
    food_loan_eligible_amount_cap_retiree = COALESCE(food_loan_eligible_amount_cap_retiree, 0),
    food_loan_eligible_amount_cap_active = COALESCE(food_loan_eligible_amount_cap_active, 0),
    food_loan_grace_amount_cap_pensioner = COALESCE(food_loan_grace_amount_cap_pensioner, 0),
    food_loan_grace_amount_cap_retiree = COALESCE(food_loan_grace_amount_cap_retiree, 0),
    food_loan_grace_amount_cap_active = COALESCE(food_loan_grace_amount_cap_active, 0),
    food_loan_cap_include_interest = COALESCE(food_loan_cap_include_interest, TRUE);

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS food_loan_grace_used BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.food_vendor_bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  cycle_id BIGINT NULL REFERENCES public.cycles(id) ON DELETE SET NULL,
  bank_name TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_role TEXT NULL,
  created_by_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS food_vendor_bank_accounts_one_current_cycle
ON public.food_vendor_bank_accounts(branch_id, cycle_id)
WHERE is_current AND cycle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS food_vendor_bank_accounts_cycle_branch_idx
ON public.food_vendor_bank_accounts(cycle_id, branch_id);

CREATE TABLE IF NOT EXISTS public.food_vendor_invoices (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  cycle_id BIGINT NULL REFERENCES public.cycles(id) ON DELETE SET NULL,
  invoice_ref TEXT NULL,
  invoice_date DATE NULL,
  amount NUMERIC NULL,
  notes TEXT NULL,
  storage_bucket TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  file_size BIGINT NOT NULL DEFAULT 0,
  created_by_role TEXT NULL,
  created_by_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS food_vendor_invoices_cycle_branch_idx
ON public.food_vendor_invoices(cycle_id, branch_id);

CREATE TABLE IF NOT EXISTS public.food_vendor_payment_status (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  cycle_id BIGINT NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ NULL,
  paid_by TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS food_vendor_payment_status_branch_cycle_uidx
ON public.food_vendor_payment_status(branch_id, cycle_id);

CREATE INDEX IF NOT EXISTS food_vendor_payment_status_cycle_branch_idx
ON public.food_vendor_payment_status(cycle_id, branch_id);

ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS rep_phone TEXT NOT NULL DEFAULT '';

UPDATE public.branches
SET rep_phone = COALESCE(rep_phone, '');
