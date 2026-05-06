-- Allow 'Delivered' status on ram_orders
-- Existing systems may have a CHECK constraint that only permits Pending/Approved/Cancelled.
-- This migration expands it to include Delivered so Rep/Admin can mark delivery completion.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ram_orders'
      AND constraint_name = 'ram_orders_status_check'
  ) THEN
    ALTER TABLE public.ram_orders DROP CONSTRAINT ram_orders_status_check;
  END IF;

  ALTER TABLE public.ram_orders
    ADD CONSTRAINT ram_orders_status_check
    CHECK (status IN ('Pending','Approved','Delivered','Cancelled'));
END $$;

