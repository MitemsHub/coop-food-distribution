-- Migration: Fix ambiguous total_amount reference in update_order_lines_batch
-- Problem: PL/pgSQL variable name total_amount conflicts with orders.total_amount column
-- Fix: Rename variable to v_total_amount and use it explicitly in UPDATE

CREATE OR REPLACE FUNCTION update_order_lines_batch(
    p_order_id INTEGER,
    p_lines JSON,
    p_delivery_branch_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    line_data JSON;
    v_total_amount DECIMAL := 0;
    new_lines JSON[] := '{}';
    item_record RECORD;
    price_record RECORD;
    line_amount DECIMAL;
    v_orders_has_cycle BOOLEAN := FALSE;
    v_prices_has_cycle BOOLEAN := FALSE;
    v_order_cycle_id INTEGER := NULL;
BEGIN
    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'cycle_id'
    ) INTO v_orders_has_cycle;

    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'branch_item_prices' AND column_name = 'cycle_id'
    ) INTO v_prices_has_cycle;

    -- Validate order status
    IF NOT EXISTS (
        SELECT 1 FROM orders 
        WHERE order_id = p_order_id 
        AND status = 'Pending'
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Order not found or not in pending status'
        );
    END IF;

    IF v_orders_has_cycle THEN
      SELECT cycle_id INTO v_order_cycle_id
      FROM orders
      WHERE order_id = p_order_id;
    END IF;
    
    -- Process each line in the JSON array
    FOR line_data IN SELECT * FROM json_array_elements(p_lines)
    LOOP
        -- Get item details
        SELECT item_id, sku INTO item_record
        FROM items 
        WHERE sku = (line_data->>'sku')::TEXT;
        
        IF item_record.item_id IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Item not found: ' || (line_data->>'sku')::TEXT
            );
        END IF;
        
        -- Get price for this branch
        IF v_prices_has_cycle AND v_order_cycle_id IS NOT NULL THEN
          SELECT id, price INTO price_record
          FROM branch_item_prices
          WHERE branch_id = p_delivery_branch_id
          AND item_id = item_record.item_id
          AND cycle_id = v_order_cycle_id;
        ELSE
          SELECT id, price INTO price_record
          FROM branch_item_prices
          WHERE branch_id = p_delivery_branch_id
          AND item_id = item_record.item_id;
        END IF;
        
        IF price_record.id IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'No price found for item: ' || (line_data->>'sku')::TEXT
            );
        END IF;
        
        -- Calculate line amount
        line_amount := price_record.price * (line_data->>'qty')::INTEGER;
        v_total_amount := v_total_amount + line_amount;
        
        -- Build new line data
        new_lines := new_lines || json_build_object(
            'order_id', p_order_id,
            'item_id', item_record.item_id,
            'branch_item_price_id', price_record.id,
            'unit_price', price_record.price,
            'qty', (line_data->>'qty')::INTEGER,
            'amount', line_amount
        );
    END LOOP;
    
    -- Delete existing lines
    DELETE FROM order_lines WHERE order_id = p_order_id;
    
    -- Insert new lines using the JSON data
    INSERT INTO order_lines (order_id, item_id, branch_item_price_id, unit_price, qty, amount)
    SELECT 
        (line->>'order_id')::INTEGER,
        (line->>'item_id')::INTEGER,
        (line->>'branch_item_price_id')::INTEGER,
        (line->>'unit_price')::DECIMAL,
        (line->>'qty')::INTEGER,
        (line->>'amount')::DECIMAL
    FROM unnest(new_lines) AS line;
    
    -- Update order total using variable (disambiguated)
    UPDATE orders 
    SET total_amount = v_total_amount 
    WHERE order_id = p_order_id;
    
    RETURN json_build_object(
        'success', true,
        'total_amount', v_total_amount,
        'lines_count', array_length(new_lines, 1)
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Ensure execute permissions remain
GRANT EXECUTE ON FUNCTION update_order_lines_batch(INTEGER, JSON, INTEGER) TO authenticated;
