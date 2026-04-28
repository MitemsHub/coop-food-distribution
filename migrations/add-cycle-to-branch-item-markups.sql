DO $$
DECLARE
  v_active_cycle_id INTEGER;
  r RECORD;
BEGIN
  ALTER TABLE public.branch_item_markups
    ADD COLUMN IF NOT EXISTS cycle_id INTEGER REFERENCES public.cycles(id);

  BEGIN
    SELECT id INTO v_active_cycle_id
    FROM public.cycles
    WHERE is_active = TRUE
    LIMIT 1;
  EXCEPTION WHEN undefined_column THEN
    SELECT id INTO v_active_cycle_id
    FROM public.cycles
    ORDER BY id DESC
    LIMIT 1;
  END;

  IF v_active_cycle_id IS NULL THEN
    INSERT INTO public.cycles (code, name, is_active)
    VALUES ('legacy', 'Legacy', TRUE)
    ON CONFLICT (code)
    DO UPDATE SET is_active = EXCLUDED.is_active
    RETURNING id INTO v_active_cycle_id;
  END IF;

  UPDATE public.branch_item_markups
  SET cycle_id = v_active_cycle_id
  WHERE cycle_id IS NULL;

  ALTER TABLE public.branch_item_markups
    ALTER COLUMN cycle_id SET NOT NULL;

  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'branch_item_markups'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY ck.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ck.attnum
      )::text[] = ARRAY['branch_id','item_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.branch_item_markups DROP CONSTRAINT %I', r.conname);
  END LOOP;

  CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_item_markups_cycle
    ON public.branch_item_markups(branch_id, item_id, cycle_id);

  CREATE INDEX IF NOT EXISTS idx_branch_item_markups_cycle
    ON public.branch_item_markups(cycle_id);

  CREATE OR REPLACE FUNCTION public.set_cycle_id_from_active_cycle()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    IF NEW.cycle_id IS NULL THEN
      BEGIN
        SELECT id INTO NEW.cycle_id
        FROM public.cycles
        WHERE is_active = TRUE
        LIMIT 1;
      EXCEPTION WHEN undefined_column THEN
        SELECT id INTO NEW.cycle_id
        FROM public.cycles
        ORDER BY id DESC
        LIMIT 1;
      END;
      IF NEW.cycle_id IS NULL THEN
        RAISE EXCEPTION 'No active cycle found';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $fn$;

  DROP TRIGGER IF EXISTS trg_branch_item_markups_set_cycle_id ON public.branch_item_markups;
  CREATE TRIGGER trg_branch_item_markups_set_cycle_id
  BEFORE INSERT ON public.branch_item_markups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cycle_id_from_active_cycle();
END $$;

CREATE OR REPLACE FUNCTION public.reprice_orders_for_branch_item(
  p_branch_id BIGINT,
  p_item_id   BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  updated_lines_count INTEGER := 0;
  prices_has_cycle BOOLEAN := false;
  orders_has_cycle BOOLEAN := false;
  markups_has_cycle BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch_item_prices' AND column_name = 'cycle_id'
  ) INTO prices_has_cycle;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'cycle_id'
  ) INTO orders_has_cycle;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch_item_markups' AND column_name = 'cycle_id'
  ) INTO markups_has_cycle;

  IF prices_has_cycle AND orders_has_cycle THEN
    UPDATE public.order_lines AS ol
    SET
      unit_price = bip.price + COALESCE((
        SELECT bim.amount FROM public.branch_item_markups bim
        WHERE bim.branch_id = o.delivery_branch_id
          AND bim.item_id = ol.item_id
          AND bim.active = TRUE
          AND (NOT markups_has_cycle OR bim.cycle_id = o.cycle_id)
      ), 0),
      branch_item_price_id = bip.id,
      amount = (bip.price + COALESCE((
        SELECT bim.amount FROM public.branch_item_markups bim
        WHERE bim.branch_id = o.delivery_branch_id
          AND bim.item_id = ol.item_id
          AND bim.active = TRUE
          AND (NOT markups_has_cycle OR bim.cycle_id = o.cycle_id)
      ), 0)) * ol.qty
    FROM public.orders AS o
    JOIN public.branch_item_prices AS bip
      ON bip.branch_id = o.delivery_branch_id
     AND bip.cycle_id = o.cycle_id
    WHERE ol.order_id = o.order_id
      AND bip.item_id = ol.item_id
      AND o.delivery_branch_id = p_branch_id
      AND ol.item_id = p_item_id
      AND o.status::text IN ('Pending','Posted','Delivered');
  ELSE
    UPDATE public.order_lines AS ol
    SET
      unit_price = bip.price + COALESCE((
        SELECT bim.amount FROM public.branch_item_markups bim
        WHERE bim.branch_id = o.delivery_branch_id
          AND bim.item_id = ol.item_id
          AND bim.active = TRUE
      ), 0),
      branch_item_price_id = bip.id,
      amount = (bip.price + COALESCE((
        SELECT bim.amount FROM public.branch_item_markups bim
        WHERE bim.branch_id = o.delivery_branch_id
          AND bim.item_id = ol.item_id
          AND bim.active = TRUE
      ), 0)) * ol.qty
    FROM public.orders AS o
    JOIN public.branch_item_prices AS bip
      ON bip.branch_id = o.delivery_branch_id
    WHERE ol.order_id = o.order_id
      AND bip.item_id = ol.item_id
      AND o.delivery_branch_id = p_branch_id
      AND ol.item_id = p_item_id
      AND o.status::text IN ('Pending','Posted','Delivered');
  END IF;

  GET DIAGNOSTICS updated_lines_count = ROW_COUNT;

  WITH s AS (
    SELECT ol.order_id, SUM(ol.amount) AS principal
    FROM public.order_lines AS ol
    GROUP BY ol.order_id
  )
  UPDATE public.orders AS o
  SET
    total_amount = COALESCE(s.principal, 0)
               + CASE WHEN o.payment_option = 'Loan'
                      THEN ROUND(COALESCE(s.principal, 0) * 0.13)
                      ELSE 0
                 END,
    updated_at = NOW()
  FROM s
  WHERE o.delivery_branch_id = p_branch_id
    AND o.status::text IN ('Pending','Posted','Delivered')
    AND s.order_id = o.order_id
    AND EXISTS (
      SELECT 1 FROM public.order_lines AS ol2
      WHERE ol2.order_id = o.order_id AND ol2.item_id = p_item_id
    );

  RETURN json_build_object('success', true, 'updated_lines', updated_lines_count);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION public.reprice_orders_for_branch_item(BIGINT, BIGINT) SET search_path = public;

CREATE OR REPLACE FUNCTION public.on_branch_item_markups_changed()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.reprice_orders_for_branch_item(NEW.branch_id, NEW.item_id);
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_reprice_orders_on_bim_change ON public.branch_item_markups;
CREATE TRIGGER trg_reprice_orders_on_bim_change
AFTER INSERT OR UPDATE OF amount, active ON public.branch_item_markups
FOR EACH ROW EXECUTE FUNCTION public.on_branch_item_markups_changed();
