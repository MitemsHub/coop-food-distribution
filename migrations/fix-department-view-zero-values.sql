-- Migration: Fix department inventory view showing zero values
-- Issue: The view was filtering by member department, but members can order items from any department
-- Solution: Remove member department filtering, only filter by item department

CREATE OR REPLACE VIEW v_inventory_status_by_department AS
SELECT 
    b.code as branch_code,
    b.name as branch_name,
    d.id as department_id,
    d.name as department_name,
    i.sku,
    i.name as item_name,
    i.unit,
    i.category,
    i.image_url,
    bip.price,
    
    -- Calculate total demand for this department (all order statuses)
    -- FIXED: Removed member department filtering - show ALL orders for department items
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status IN ('Pending', 'Posted', 'Delivered')
    ), 0) as total_demand,
    
    -- Calculate pending demand (pending orders only)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Pending'
    ), 0) as pending_demand,
    
    -- Calculate confirmed demand (posted orders)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Posted'
    ), 0) as confirmed_demand,
    
    -- Calculate delivered quantity
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Delivered'
    ), 0) as delivered_qty,
    
    -- Calculate pending delivery quantity (posted but not delivered)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Posted'
    ), 0) as pending_delivery_qty,
    
    -- Calculate available stock based on demand tracking mode
    CASE 
        WHEN b.demand_tracking_mode = true THEN 
            -- For demand tracking: show unlimited availability
            999999
        ELSE 
            -- For traditional stock tracking: use inventory movements
            GREATEST(0, COALESCE((
                SELECT SUM(
                    CASE 
                        WHEN im.movement_type = 'In' THEN im.quantity
                        WHEN im.movement_type = 'Out' THEN -im.quantity
                        ELSE 0
                    END
                )
                FROM inventory_movements im
                WHERE im.branch_id = b.id 
                AND im.item_id = i.item_id
            ), 0))
    END as available_stock,
    
    -- Calculate department allocation percentage based on their orders vs total orders
    CASE 
        WHEN COALESCE((
            SELECT SUM(ol.qty)
            FROM order_lines ol
            JOIN orders o ON ol.order_id = o.order_id
            WHERE o.delivery_branch_id = b.id 
            AND ol.item_id = i.item_id
            AND o.status IN ('Pending', 'Posted')
        ), 0) > 0 THEN
            ROUND(
                (COALESCE((
                    SELECT SUM(ol.qty)
                    FROM order_lines ol
                    JOIN orders o ON ol.order_id = o.order_id
                    WHERE o.delivery_branch_id = b.id 
                    AND ol.item_id = i.item_id
                    AND o.status IN ('Pending', 'Posted')
                ), 0) * 100.0) / COALESCE((
                    SELECT SUM(ol.qty)
                    FROM order_lines ol
                    JOIN orders o ON ol.order_id = o.order_id
                    WHERE o.delivery_branch_id = b.id 
                    AND ol.item_id = i.item_id
                    AND o.status IN ('Pending', 'Posted')
                ), 1), 2
            )
        ELSE 0
    END as allocation_percentage
    
FROM branches b
CROSS JOIN departments d
CROSS JOIN items i
LEFT JOIN branch_item_prices bip ON b.id = bip.branch_id AND i.item_id = bip.item_id
WHERE bip.id IS NOT NULL  -- Only include items that have prices set for the branch
AND i.department_id = d.id  -- Only show items that belong to this department
ORDER BY b.name, d.name, i.name;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_item ON inventory_movements(branch_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);

-- Add helpful comments
COMMENT ON VIEW v_inventory_status_by_department IS 'Department-level inventory view - shows all orders for department items regardless of member department';

-- Test the fix by checking a few rows
SELECT 
    branch_name,
    department_name,
    item_name,
    total_demand,
    pending_demand,
    confirmed_demand,
    delivered_qty
FROM v_inventory_status_by_department
WHERE branch_code = 'DUTSE'
ORDER BY department_name, item_name
LIMIT 10;