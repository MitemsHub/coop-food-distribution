BEGIN;

CREATE OR REPLACE FUNCTION public.reprice_orders_for_branch_item(
  p_branch_id BIGINT,
  p_item_id   BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  updated_lines_count INTEGER := 0;
  has_cycle BOOLEAN := false;
  orders_has_cycle BOOLEAN := false;
  markups_has_cycle BOOLEAN := false;
  cycles_has_loan_rate BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch_item_prices' AND column_name = 'cycle_id'
  ) INTO has_cycle;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'cycle_id'
  ) INTO orders_has_cycle;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch_item_markups' AND column_name = 'cycle_id'
  ) INTO markups_has_cycle;

  IF orders_has_cycle THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cycles' AND column_name = 'food_loan_interest_rate_pct'
    ) INTO cycles_has_loan_rate;
  END IF;

  IF has_cycle AND orders_has_cycle THEN
    UPDATE public.order_lines AS ol
    SET
      unit_price = bip.price + COALESCE((
        SELECT bim.amount FROM public.branch_item_markups bim
        WHERE bim.branch_id = o.delivery_branch_id AND bim.item_id = ol.item_id AND bim.active = TRUE
          AND (NOT markups_has_cycle OR bim.cycle_id = o.cycle_id)
      ), 0),
      branch_item_price_id = bip.id,
      amount = (bip.price + COALESCE((
        SELECT bim.amount FROM public.branch_item_markups bim
        WHERE bim.branch_id = o.delivery_branch_id AND bim.item_id = ol.item_id AND bim.active = TRUE
          AND (NOT markups_has_cycle OR bim.cycle_id = o.cycle_id)
      ), 0)) * ol.qty
    FROM public.orders AS o
    JOIN public.branch_item_prices AS bip
      ON bip.branch_id = o.delivery_branch_id AND bip.cycle_id = o.cycle_id
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
        WHERE bim.branch_id = o.delivery_branch_id AND bim.item_id = ol.item_id AND bim.active = TRUE
      ), 0),
      branch_item_price_id = bip.id,
      amount = (bip.price + COALESCE((
        SELECT bim.amount FROM public.branch_item_markups bim
        WHERE bim.branch_id = o.delivery_branch_id AND bim.item_id = ol.item_id AND bim.active = TRUE
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

  IF orders_has_cycle AND cycles_has_loan_rate THEN
    WITH s AS (
      SELECT ol.order_id, SUM(ol.amount) AS principal
      FROM public.order_lines AS ol
      GROUP BY ol.order_id
    )
    UPDATE public.orders AS o
    SET
      total_amount = COALESCE(s.principal, 0)
                   + CASE WHEN o.payment_option = 'Loan'
                          THEN ROUND(COALESCE(s.principal, 0) * (COALESCE(c.food_loan_interest_rate_pct, 0) / 100.0))
                          ELSE 0
                     END,
      updated_at = NOW()
    FROM s
    LEFT JOIN public.cycles AS c ON c.id = o.cycle_id
    WHERE o.delivery_branch_id = p_branch_id
      AND o.status::text IN ('Pending','Posted','Delivered')
      AND s.order_id = o.order_id
      AND EXISTS (
        SELECT 1 FROM public.order_lines AS ol2
        WHERE ol2.order_id = o.order_id AND ol2.item_id = p_item_id
      );
  ELSE
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
  END IF;

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

CREATE OR REPLACE FUNCTION public.on_branch_item_prices_changed()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.reprice_orders_for_branch_item(NEW.branch_id, NEW.item_id);
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_reprice_orders_on_bip_change ON public.branch_item_prices;
CREATE TRIGGER trg_reprice_orders_on_bip_change
AFTER INSERT OR UPDATE OF price ON public.branch_item_prices
FOR EACH ROW EXECUTE FUNCTION public.on_branch_item_prices_changed();

COMMIT;

