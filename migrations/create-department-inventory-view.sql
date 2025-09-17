-- Migration: Create department-level inventory status view
-- This view provides comprehensive inventory status organized by branch and department
-- Run this in Supabase SQL Editor after adding department_id to items table

-- Drop existing view if it exists
DROP VIEW IF EXISTS v_inventory_status_by_department;

-- Create department-level inventory status view
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
    bip.initial_stock,
    
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
    
    -- Calculate total department demand (all orders)
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
    
    -- Calculate remaining stock after department allocations
    bip.initial_stock - COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        JOIN members m ON o.member_id = m.member_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND m.department_id = d.id
        AND o.status IN ('Pending', 'Posted', 'Delivered')
    ), 0) as remaining_after_department
    
FROM branches b
CROSS JOIN departments d
CROSS JOIN items i
LEFT JOIN branch_item_prices bip ON b.id = bip.branch_id AND i.item_id = bip.item_id
WHERE bip.id IS NOT NULL  -- Only include items that have prices set for the branch
AND i.department_id = d.id  -- Only show items that belong to this department
ORDER BY b.name, d.name, i.name;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_members_department_branch ON members(department_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_branch_status ON orders(delivery_branch_id, status);

-- Test query to verify the view works
SELECT 
    branch_name,
    department_name,
    COUNT(*) as item_count,
    SUM(initial_stock) as total_initial_stock,
    SUM(allocated_qty) as total_allocated,
    SUM(delivered_qty) as total_delivered
FROM v_inventory_status_by_department
GROUP BY branch_name, department_name
ORDER BY branch_name, department_name
LIMIT 10;