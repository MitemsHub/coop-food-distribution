-- Full cycle isolation: cycle-scoped prices + orders + cycle-aware views/triggers

DO $$
DECLARE
  v_active_cycle_id INTEGER;
BEGIN
  ALTER TABLE public.cycles
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

  ALTER TABLE public.cycles
    ALTER COLUMN is_active SET DEFAULT FALSE;

  UPDATE public.cycles
  SET is_active = FALSE
  WHERE is_active IS NULL;

  ALTER TABLE public.cycles
    ALTER COLUMN is_active SET NOT NULL;

  SELECT id INTO v_active_cycle_id
  FROM public.cycles
  WHERE is_active IS TRUE
  LIMIT 1;

  IF v_active_cycle_id IS NULL THEN
    SELECT id INTO v_active_cycle_id
    FROM public.cycles
    ORDER BY id DESC
    LIMIT 1;

    IF v_active_cycle_id IS NULL THEN
      INSERT INTO public.cycles (code, name, is_active)
      VALUES ('legacy', 'Legacy', TRUE)
      ON CONFLICT (code)
      DO UPDATE SET is_active = EXCLUDED.is_active
      RETURNING id INTO v_active_cycle_id;
    ELSE
      UPDATE public.cycles SET is_active = FALSE;
      UPDATE public.cycles SET is_active = TRUE WHERE id = v_active_cycle_id;
    END IF;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS uq_cycle_active ON public.cycles (is_active) WHERE is_active;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cycle_id INTEGER REFERENCES public.cycles(id);

ALTER TABLE public.branch_item_prices
  ADD COLUMN IF NOT EXISTS cycle_id INTEGER REFERENCES public.cycles(id);

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS cycle_id INTEGER REFERENCES public.cycles(id);

DO $$
DECLARE
  v_active_cycle_id INTEGER;
BEGIN
  SELECT id INTO v_active_cycle_id
  FROM public.cycles
  WHERE is_active = TRUE
  LIMIT 1;

  UPDATE public.orders
  SET cycle_id = v_active_cycle_id
  WHERE cycle_id IS NULL;

  UPDATE public.branch_item_prices
  SET cycle_id = v_active_cycle_id
  WHERE cycle_id IS NULL;

  UPDATE public.inventory_movements
  SET cycle_id = v_active_cycle_id
  WHERE cycle_id IS NULL;
END $$;

ALTER TABLE public.orders ALTER COLUMN cycle_id SET NOT NULL;
ALTER TABLE public.branch_item_prices ALTER COLUMN cycle_id SET NOT NULL;
ALTER TABLE public.inventory_movements ALTER COLUMN cycle_id SET NOT NULL;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'branch_item_prices'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY ck.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ck.attnum
      )::text[] = ARRAY['branch_id','item_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.branch_item_prices DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_item_cycle
  ON public.branch_item_prices(branch_id, item_id, cycle_id);

CREATE INDEX IF NOT EXISTS idx_orders_cycle_delivery_status
  ON public.orders(cycle_id, delivery_branch_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_cycle_branch_status
  ON public.orders(cycle_id, branch_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_cycle_branch_item
  ON public.inventory_movements(cycle_id, branch_id, item_id);

CREATE OR REPLACE FUNCTION public.set_cycle_id_from_active_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cycle_id IS NULL THEN
    SELECT id INTO NEW.cycle_id
    FROM public.cycles
    WHERE is_active = TRUE
    LIMIT 1;
    IF NEW.cycle_id IS NULL THEN
      RAISE EXCEPTION 'No active cycle found';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_cycle_id ON public.orders;
CREATE TRIGGER trg_orders_set_cycle_id
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_cycle_id_from_active_cycle();

DROP TRIGGER IF EXISTS trg_branch_item_prices_set_cycle_id ON public.branch_item_prices;
CREATE TRIGGER trg_branch_item_prices_set_cycle_id
BEFORE INSERT ON public.branch_item_prices
FOR EACH ROW
EXECUTE FUNCTION public.set_cycle_id_from_active_cycle();

DROP TRIGGER IF EXISTS trg_inventory_movements_set_cycle_id ON public.inventory_movements;
CREATE TRIGGER trg_inventory_movements_set_cycle_id
BEFORE INSERT ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.set_cycle_id_from_active_cycle();

DROP VIEW IF EXISTS public.v_inventory_status;
CREATE VIEW public.v_inventory_status AS
WITH
  order_agg AS (
    SELECT
      o.cycle_id,
      o.delivery_branch_id AS branch_id,
      ol.item_id,
      SUM(ol.qty) AS total_demand,
      SUM(CASE WHEN o.status = 'Pending'::order_status THEN ol.qty ELSE 0 END) AS pending_demand,
      SUM(CASE WHEN o.status = 'Posted'::order_status  THEN ol.qty ELSE 0 END) AS confirmed_demand,
      SUM(CASE WHEN o.status = ANY (ARRAY['Pending'::order_status,'Posted'::order_status]) THEN ol.qty ELSE 0 END) AS allocated_qty,
      SUM(CASE WHEN o.status = 'Delivered'::order_status THEN ol.qty ELSE 0 END) AS delivered_qty,
      SUM(CASE WHEN o.status = 'Posted'::order_status THEN ol.qty ELSE 0 END) AS pending_delivery_qty
    FROM public.order_lines ol
    JOIN public.orders o ON o.order_id = ol.order_id
    GROUP BY o.cycle_id, o.delivery_branch_id, ol.item_id
  ),
  movement_agg AS (
    SELECT
      cycle_id,
      branch_id,
      item_id,
      SUM(
        CASE
          WHEN movement_type = 'In'  THEN quantity
          WHEN movement_type = 'Out' THEN -quantity
          ELSE 0
        END
      ) AS stock_qty
    FROM public.inventory_movements
    GROUP BY cycle_id, branch_id, item_id
  )
SELECT
  bip.cycle_id,
  b.code AS branch_code,
  b.name AS branch_name,
  b.demand_tracking_mode,
  i.item_id,
  i.sku,
  i.name AS item_name,
  i.unit,
  i.category,
  i.image_url,
  bip.price,
  COALESCE(oa.total_demand, 0)           AS total_demand,
  COALESCE(oa.pending_demand, 0)         AS pending_demand,
  COALESCE(oa.confirmed_demand, 0)       AS confirmed_demand,
  COALESCE(oa.allocated_qty, 0)          AS allocated_qty,
  COALESCE(oa.delivered_qty, 0)          AS delivered_qty,
  COALESCE(oa.pending_delivery_qty, 0)   AS pending_delivery_qty,
  COALESCE(oa.delivered_qty, 0)          AS delivered_demand,
  CASE
    WHEN b.demand_tracking_mode = TRUE THEN 999999
    ELSE GREATEST(0, COALESCE(ma.stock_qty, 0))
  END AS available_stock,
  CASE
    WHEN b.demand_tracking_mode = TRUE THEN 999999
    ELSE GREATEST(0, COALESCE(ma.stock_qty, 0) - COALESCE(oa.total_demand, 0))
  END AS remaining_after_posted,
  CASE
    WHEN b.demand_tracking_mode = TRUE THEN 999999
    ELSE GREATEST(0, COALESCE(ma.stock_qty, 0) - COALESCE(oa.delivered_qty, 0))
  END AS remaining_after_delivered
FROM public.branches b
JOIN public.branch_item_prices bip ON b.id = bip.branch_id
JOIN public.items i ON i.item_id = bip.item_id
LEFT JOIN order_agg oa ON oa.cycle_id = bip.cycle_id AND oa.branch_id = b.id AND oa.item_id = i.item_id
LEFT JOIN movement_agg ma ON ma.cycle_id = bip.cycle_id AND ma.branch_id = b.id AND ma.item_id = i.item_id
WHERE bip.price IS NOT NULL;

CREATE OR REPLACE VIEW public.v_applications_by_branch AS
SELECT
  b.name AS branch_name,
  COALESCE(SUM(CASE WHEN o.status = 'Pending'::order_status  THEN 1 ELSE 0 END), 0) AS pending,
  COALESCE(SUM(CASE WHEN o.status = 'Posted'::order_status   THEN 1 ELSE 0 END), 0) AS posted,
  COALESCE(SUM(CASE WHEN o.status = 'Delivered'::order_status THEN 1 ELSE 0 END), 0) AS delivered
FROM public.branches b
LEFT JOIN public.orders o
  ON b.id = o.branch_id
 AND o.cycle_id = (SELECT id FROM public.cycles WHERE is_active = TRUE LIMIT 1)
GROUP BY b.id, b.name
ORDER BY b.name;

CREATE OR REPLACE VIEW public.v_applications_by_branch_department AS
SELECT
  b.name AS branch_name,
  d.name AS department_name,
  COALESCE(SUM(CASE WHEN o.status = 'Pending'::order_status  THEN 1 ELSE 0 END), 0) AS pending,
  COALESCE(SUM(CASE WHEN o.status = 'Posted'::order_status   THEN 1 ELSE 0 END), 0) AS posted,
  COALESCE(SUM(CASE WHEN o.status = 'Delivered'::order_status THEN 1 ELSE 0 END), 0) AS delivered
FROM public.branches b
CROSS JOIN public.departments d
LEFT JOIN public.orders o
  ON o.branch_id     = b.id
 AND o.department_id = d.id
 AND o.cycle_id = (SELECT id FROM public.cycles WHERE is_active = TRUE LIMIT 1)
GROUP BY b.id, b.name, d.id, d.name
ORDER BY b.name, d.name;

CREATE OR REPLACE VIEW public.v_applications_by_delivery_branch_member_branch AS
SELECT
  db.name AS delivery_branch_name,
  mb.name AS branch_name,
  COALESCE(SUM(CASE WHEN o.status = 'Pending'::order_status  THEN 1 ELSE 0 END), 0) AS pending,
  COALESCE(SUM(CASE WHEN o.status = 'Posted'::order_status   THEN 1 ELSE 0 END), 0) AS posted,
  COALESCE(SUM(CASE WHEN o.status = 'Delivered'::order_status THEN 1 ELSE 0 END), 0) AS delivered
FROM public.branches db
CROSS JOIN public.branches mb
LEFT JOIN public.orders o
  ON o.delivery_branch_id = db.id
 AND o.branch_id          = mb.id
 AND o.cycle_id = (SELECT id FROM public.cycles WHERE is_active = TRUE LIMIT 1)
GROUP BY db.id, db.name, mb.id, mb.name
ORDER BY db.name, mb.name;
