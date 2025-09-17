-- Optimized bulk operations for better performance
-- This migration adds batch processing capabilities to reduce database round trips

-- Function to post multiple orders in a single transaction
CREATE OR REPLACE FUNCTION post_orders_bulk(
    p_order_ids INTEGER[],
    p_admin TEXT DEFAULT 'admin@coop'
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    posted_orders INTEGER[] := '{}';
    failed_orders JSON[] := '{}';
    order_id INTEGER;
    order_status TEXT;
    result_json JSON;
BEGIN
    -- Process each order in the array
    FOREACH order_id IN ARRAY p_order_ids
    LOOP
        BEGIN
            -- Check order status
            SELECT status INTO order_status 
            FROM orders 
            WHERE orders.order_id = order_id;
            
            IF order_status IS NULL THEN
                failed_orders := failed_orders || json_build_object(
                    'order_id', order_id,
                    'error', 'Order not found'
                );
                CONTINUE;
            END IF;
            
            IF order_status != 'Pending' THEN
                failed_orders := failed_orders || json_build_object(
                    'order_id', order_id,
                    'error', 'Order must be in pending status to post'
                );
                CONTINUE;
            END IF;
            
            -- Update order status to posted
            UPDATE orders 
            SET status = 'Posted', 
                posted_at = NOW()
            WHERE orders.order_id = order_id;
            
            -- Add to successful posts
            posted_orders := posted_orders || order_id;
            
        EXCEPTION
            WHEN OTHERS THEN
                failed_orders := failed_orders || json_build_object(
                    'order_id', order_id,
                    'error', SQLERRM
                );
        END;
    END LOOP;
    
    -- Return results
    RETURN json_build_object(
        'success', true,
        'posted', posted_orders,
        'failed', failed_orders,
        'posted_count', array_length(posted_orders, 1),
        'failed_count', array_length(failed_orders, 1)
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'posted', posted_orders,
            'failed', failed_orders
        );
END;
$$;

-- Function to batch update order lines with optimized queries
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
    total_amount DECIMAL := 0;
    new_lines JSON[] := '{}';
    item_record RECORD;
    price_record RECORD;
    line_amount DECIMAL;
BEGIN
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
        SELECT id, price INTO price_record
        FROM branch_item_prices
        WHERE branch_id = p_delivery_branch_id
        AND item_id = item_record.item_id;
        
        IF price_record.id IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'No price found for item: ' || (line_data->>'sku')::TEXT
            );
        END IF;
        
        -- Calculate line amount
        line_amount := price_record.price * (line_data->>'qty')::INTEGER;
        total_amount := total_amount + line_amount;
        
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
    
    -- Update order total
    UPDATE orders 
    SET total_amount = total_amount 
    WHERE order_id = p_order_id;
    
    RETURN json_build_object(
        'success', true,
        'total_amount', total_amount,
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION post_orders_bulk(INTEGER[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_lines_batch(INTEGER, JSON, INTEGER) TO authenticated;