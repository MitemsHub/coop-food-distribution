-- Automatically reprice order_lines and orders when branch item prices change
-- This adds a function and trigger so that updates to branch_item_prices
-- immediately reflect in existing orders (Pending, Posted, Delivered).

CREATE OR REPLACE FUNCTION reprice_orders_for_branch_item(
    p_branch_id INTEGER,
    p_item_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    updated_lines_count INTEGER := 0;
BEGIN
    -- Update affected order lines: set unit_price, branch_item_price_id, and amount
    UPDATE order_lines ol
    SET 
        unit_price = bip.price,
        branch_item_price_id = bip.id,
        amount = bip.price * ol.qty
    FROM orders o
    JOIN branch_item_prices bip 
      ON bip.branch_id = o.delivery_branch_id 
     AND bip.item_id = ol.item_id
    WHERE ol.order_id = o.order_id
      AND o.delivery_branch_id = p_branch_id
      AND ol.item_id = p_item_id
      AND UPPER(o.status) IN ('PENDING','POSTED','DELIVERED');

    GET DIAGNOSTICS updated_lines_count = ROW_COUNT;

    -- Update totals for orders impacted by the above change
    UPDATE orders o
    SET 
        total_amount = COALESCE((
            SELECT SUM(ol.amount) 
            FROM order_lines ol 
            WHERE ol.order_id = o.order_id
        ), 0),
        updated_at = NOW()
    WHERE o.delivery_branch_id = p_branch_id
      AND UPPER(o.status) IN ('PENDING','POSTED','DELIVERED')
      AND EXISTS (
          SELECT 1 
          FROM order_lines ol 
          WHERE ol.order_id = o.order_id 
            AND ol.item_id = p_item_id
      );

    RETURN json_build_object('success', true, 'updated_lines', updated_lines_count);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Trigger function to invoke repricing after branch_item_prices changes
CREATE OR REPLACE FUNCTION on_branch_item_prices_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM reprice_orders_for_branch_item(NEW.branch_id, NEW.item_id);
    RETURN NEW;
END;
$$;

-- Create the trigger on branch_item_prices for insert or price update
DROP TRIGGER IF EXISTS trg_reprice_orders_on_bip_change ON branch_item_prices;
CREATE TRIGGER trg_reprice_orders_on_bip_change
AFTER INSERT OR UPDATE OF price ON branch_item_prices
FOR EACH ROW
EXECUTE FUNCTION on_branch_item_prices_changed();