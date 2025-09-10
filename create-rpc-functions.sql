-- Create RPC functions for order management
-- These functions are required for the Rep and Admin order management functionality

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS post_order(INTEGER, TEXT);
DROP FUNCTION IF EXISTS post_order(BIGINT, TEXT);
DROP FUNCTION IF EXISTS deliver_order(INTEGER, TEXT);
DROP FUNCTION IF EXISTS deliver_order(BIGINT, TEXT);

-- Function to post an order (change status from pending to posted)
CREATE OR REPLACE FUNCTION post_order(
    p_order_id INTEGER,
    p_admin TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_exists BOOLEAN;
    v_current_status TEXT;
    v_result JSON;
BEGIN
    -- Check if order exists and get current status
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_id = p_order_id), 
           status INTO v_order_exists, v_current_status
    FROM orders 
    WHERE order_id = p_order_id;
    
    -- Return error if order doesn't exist
    IF NOT v_order_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Order not found'
        );
    END IF;
    
    -- Return error if order is not in pending status
    IF v_current_status != 'Pending' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Order must be in pending status to post'
        );
    END IF;
    
    -- Update order status to posted
    UPDATE orders 
    SET status = 'Posted', 
        posted_at = NOW()
    WHERE order_id = p_order_id;
    
    -- Return success
    RETURN json_build_object(
        'success', true,
        'message', 'Order posted successfully',
        'order_id', p_order_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Function to deliver an order (change status from posted to delivered)
CREATE OR REPLACE FUNCTION deliver_order(
    p_order_id INTEGER,
    p_admin TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_exists BOOLEAN;
    v_current_status TEXT;
    v_result JSON;
BEGIN
    -- Check if order exists and get current status
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_id = p_order_id), 
           status INTO v_order_exists, v_current_status
    FROM orders 
    WHERE order_id = p_order_id;
    
    -- Return error if order doesn't exist
    IF NOT v_order_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Order not found'
        );
    END IF;
    
    -- Return error if order is not in posted status
    IF v_current_status != 'Posted' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Order must be in posted status to deliver'
        );
    END IF;
    
    -- Update order status to delivered
    UPDATE orders 
    SET status = 'Delivered', 
        delivered_at = NOW()
    WHERE order_id = p_order_id;
    
    -- Return success
    RETURN json_build_object(
        'success', true,
        'message', 'Order delivered successfully',
        'order_id', p_order_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Grant execute permissions to authenticated users ONLY
-- These functions should never be accessible to anonymous users for security
GRANT EXECUTE ON FUNCTION post_order(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION deliver_order(INTEGER, TEXT) TO authenticated;

-- SECURITY: DO NOT grant to anon users - would allow unauthorized order manipulation
-- GRANT EXECUTE ON FUNCTION post_order(INTEGER, TEXT) TO anon;  -- REMOVED FOR SECURITY
-- GRANT EXECUTE ON FUNCTION deliver_order(INTEGER, TEXT) TO anon; -- REMOVED FOR SECURITY