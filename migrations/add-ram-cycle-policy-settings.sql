ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS loan_qty_cap_pensioner INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS loan_qty_cap_other INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS loan_grace_qty INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS price_junior BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS price_senior BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS price_executive BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS price_undefined BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS eligible_loan_qty_pensioner INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS eligible_loan_qty_retiree INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS eligible_loan_qty_active INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS grace_loan_qty_pensioner INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS grace_loan_qty_retiree INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles
ADD COLUMN IF NOT EXISTS grace_loan_qty_active INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ram_cycles ALTER COLUMN loan_qty_cap_pensioner SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN loan_qty_cap_other SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN loan_grace_qty SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN price_junior SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN price_senior SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN price_executive SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN price_undefined SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN eligible_loan_qty_pensioner SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN eligible_loan_qty_retiree SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN eligible_loan_qty_active SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN grace_loan_qty_pensioner SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN grace_loan_qty_retiree SET DEFAULT 0;
ALTER TABLE public.ram_cycles ALTER COLUMN grace_loan_qty_active SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.ram_cycle_delivery_locations (
  id BIGSERIAL PRIMARY KEY,
  ram_cycle_id BIGINT NOT NULL REFERENCES public.ram_cycles(id) ON DELETE CASCADE,
  ram_delivery_location_id BIGINT NOT NULL REFERENCES public.ram_delivery_locations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ram_cycle_delivery_locations_cycle_loc_uidx
ON public.ram_cycle_delivery_locations(ram_cycle_id, ram_delivery_location_id);

CREATE INDEX IF NOT EXISTS ram_cycle_delivery_locations_cycle_active_idx
ON public.ram_cycle_delivery_locations(ram_cycle_id, is_active);

WITH c AS (SELECT public.get_active_ram_cycle_id() AS id)
INSERT INTO public.ram_cycle_delivery_locations(ram_cycle_id, ram_delivery_location_id, is_active)
SELECT c.id, l.id, TRUE
FROM c
JOIN public.ram_delivery_locations l ON TRUE
WHERE c.id IS NOT NULL
ON CONFLICT (ram_cycle_id, ram_delivery_location_id) DO NOTHING;

ALTER TABLE public.ram_vendor_bank_accounts
ADD COLUMN IF NOT EXISTS ram_cycle_id BIGINT NULL REFERENCES public.ram_cycles(id) ON DELETE SET NULL;

UPDATE public.ram_vendor_bank_accounts
SET ram_cycle_id = public.get_active_ram_cycle_id()
WHERE ram_cycle_id IS NULL;

DROP INDEX IF EXISTS public.ram_vendor_bank_accounts_one_current;

CREATE UNIQUE INDEX IF NOT EXISTS ram_vendor_bank_accounts_one_current_cycle
ON public.ram_vendor_bank_accounts(ram_delivery_location_id, ram_cycle_id)
WHERE is_current AND ram_cycle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ram_vendor_bank_accounts_cycle_loc_idx
ON public.ram_vendor_bank_accounts(ram_cycle_id, ram_delivery_location_id);
