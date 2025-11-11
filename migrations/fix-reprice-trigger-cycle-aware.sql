-- Fix repricing to respect cycle_id when present on branch_item_prices
-- This version conditionally joins by cycle_id if the column exists,
-- avoiding ambiguous updates when multiple price rows exist per branch+item across cycles.

CREATE OR REPLACE FUNCTION reprice_orders_for_branch_item(
    p_branch_id INTEGER,
    p_item_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    updated_lines_count INTEGER := 0;
    has_cycle BOOLEAN := false;
    orders_has_cycle BOOLEAN := false;
BEGIN
    -- Detect whether branch_item_prices has a cycle_id column
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'branch_item_prices'
          AND column_name = 'cycle_id'
    ) INTO has_cycle;

    -- Detect whether orders has a cycle_id column
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orders'
          AND column_name = 'cycle_id'
    ) INTO orders_has_cycle;

    -- Use cycle-aware logic ONLY if both tables have cycle_id
    IF has_cycle AND orders_has_cycle THEN
        -- Cycle-aware update: match branch, item, and cycle
        EXECUTE $$
        UPDATE public.order_lines AS ol
        SET 
            unit_price = bip.price,
            branch_item_price_id = bip.id,
            amount = bip.price * ol.qty
        FROM public.orders AS o
        JOIN public.branch_item_prices AS bip 
          ON bip.branch_id = o.delivery_branch_id 
         AND bip.item_id = ol.item_id
         AND bip.cycle_id = o.cycle_id
        WHERE ol.order_id = o.order_id
          AND o.delivery_branch_id = $1
          AND ol.item_id = $2
          AND o.status::text IN ('Pending','Posted','Delivered');
        $$ USING p_branch_id, p_item_id;

        GET DIAGNOSTICS updated_lines_count = ROW_COUNT;

        -- Recompute totals using a joined aggregate to avoid correlated subquery pitfalls
        EXECUTE $$
        UPDATE public.orders AS o
        SET 
            total_amount = COALESCE(s.sum_amount, 0),
            updated_at = NOW()
        FROM (
            SELECT ol.order_id, SUM(ol.amount) AS sum_amount
            FROM public.order_lines AS ol
            GROUP BY ol.order_id
        ) AS s
        WHERE o.order_id = s.order_id
          AND o.delivery_branch_id = $1
          AND o.status::text IN ('Pending','Posted','Delivered')
          AND EXISTS (
              SELECT 1 
              FROM public.order_lines AS ol2 
              WHERE ol2.order_id = o.order_id 
                AND ol2.item_id = $2
          );
        $$ USING p_branch_id, p_item_id;
    ELSE
        -- Legacy update: match branch and item only
        UPDATE public.order_lines AS ol
        SET 
            unit_price = bip.price,
            branch_item_price_id = bip.id,
            amount = bip.price * ol.qty
        FROM public.orders AS o
        JOIN public.branch_item_prices AS bip 
          ON bip.branch_id = o.delivery_branch_id 
         AND bip.item_id = ol.item_id
        WHERE ol.order_id = o.order_id
          AND o.delivery_branch_id = p_branch_id
          AND ol.item_id = p_item_id
          AND o.status::text IN ('Pending','Posted','Delivered');

        GET DIAGNOSTICS updated_lines_count = ROW_COUNT;

        -- Recompute totals using a joined aggregate
        UPDATE public.orders AS o
        SET 
            total_amount = COALESCE(s.sum_amount, 0),
            updated_at = NOW()
        FROM (
            SELECT ol.order_id, SUM(ol.amount) AS sum_amount
            FROM public.order_lines AS ol
            GROUP BY ol.order_id
        ) AS s
        WHERE o.order_id = s.order_id
          AND o.delivery_branch_id = p_branch_id
          AND o.status::text IN ('Pending','Posted','Delivered')
          AND EXISTS (
              SELECT 1 
              FROM public.order_lines AS ol2 
              WHERE ol2.order_id = o.order_id 
                AND ol2.item_id = p_item_id
          );
    END IF;

    RETURN json_build_object('success', true, 'updated_lines', updated_lines_count);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Trigger remains the same; it will invoke this updated function
DROP TRIGGER IF EXISTS trg_reprice_orders_on_bip_change ON public.branch_item_prices;
CREATE TRIGGER trg_reprice_orders_on_bip_change
AFTER INSERT OR UPDATE OF price ON public.branch_item_prices
FOR EACH ROW
EXECUTE FUNCTION on_branch_item_prices_changed();