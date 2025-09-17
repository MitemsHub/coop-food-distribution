-- Migration: Remove initial_stock dependency from inventory views
-- This migration updates the inventory status view to work without initial_stock
-- Run this in Supabase SQL Editor after removing initial_stock from application code

-- Drop existing views that depend on initial_stock
DROP VIEW IF EXISTS v_inventory_status;
DROP VIEW IF EXISTS v_inventory_status_by_department;

-- Create updated inventory status view without initial_stock dependency
-- This view now focuses on demand tracking and order fulfillment
CREATE VIEW v_inventory_status AS
SELECT 
    b.code as branch_code,
    b.name as branch_name,
    i.sku,
    i.name as item_name,
    i.unit,
    i.category,
    i.image_url,
    bip.price,
    
    -- Demand tracking fields
    b.demand_tracking_mode,
    
    -- Calculate total demand (sum of all orders regardless of status)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
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
    
    -- Calculate allocated quantity (sum of all pending and posted orders)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status IN ('Pending', 'Posted')
    ), 0) as allocated_qty,
    
    -- Calculate delivered quantity (sum of delivered orders)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Delivered'
    ), 0) as delivered_qty
    
FROM branches b
CROSS JOIN items i
LEFT JOIN branch_item_prices bip ON b.id = bip.branch_id AND i.item_id = bip.item_id
WHERE bip.id IS NOT NULL  -- Only include items that have prices set for the branch
ORDER BY b.name, i.name;

-- Create updated department-level inventory status view without initial_stock
CREATE VIEW v_inventory_status_by_department AS
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
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        JOIN members m ON o.member_id = m.member_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND m.department_id = d.id
        AND o.status IN ('Pending', 'Posted', 'Delivered')
    ), 0) as total_demand,
    
    -- Calculate department-specific allocated quantity (pending + posted orders)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        JOIN members m ON o.member_id = m.member_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND m.department_id = d.id
        AND o.status IN ('Pending', 'Posted')
    ), 0) as allocated_qty,
    
    -- Calculate department-specific delivered quantity
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        JOIN members m ON o.member_id = m.member_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND m.department_id = d.id
        AND o.status = 'Delivered'
    ), 0) as delivered_qty,
    
    -- Calculate department-specific pending delivery quantity (posted but not delivered)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        JOIN members m ON o.member_id = m.member_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND m.department_id = d.id
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
                    JOIN members m ON o.member_id = m.member_id
                    WHERE o.delivery_branch_id = b.id 
                    AND ol.item_id = i.item_id
                    AND m.department_id = d.id
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
COMMENT ON VIEW v_inventory_status IS 'Inventory status view without initial_stock dependency - uses inventory movements for stock calculations';
COMMENT ON VIEW v_inventory_status_by_department IS 'Department-level inventory view without initial_stock dependency';