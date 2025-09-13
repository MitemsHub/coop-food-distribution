-- Fix for Inventory View - Use delivery_branch_id instead of branch_id
-- This fixes the issue where orders delivered to DUTSE weren't affecting DUTSE stock levels
-- Run this SQL script in Supabase SQL Editor

-- Drop existing view
DROP VIEW IF EXISTS v_inventory_status;

-- Create updated view with delivery_branch_id logic
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
    bip.initial_stock,
    
    -- Calculate allocated quantity (sum of all pending and posted orders)
    -- FIXED: Using delivery_branch_id instead of branch_id
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status IN ('Pending', 'Posted')
    ), 0) as allocated_qty,
    
    -- Calculate delivered quantity (sum of delivered orders)
    -- FIXED: Using delivery_branch_id instead of branch_id
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Delivered'
    ), 0) as delivered_qty,
    
    -- Calculate pending delivery quantity (posted but not delivered)
    -- FIXED: Using delivery_branch_id instead of branch_id
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Posted'
    ), 0) as pending_delivery_qty,
    
    -- Calculate remaining after posted orders
    -- FIXED: Using delivery_branch_id instead of branch_id
    bip.initial_stock - COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status IN ('Pending', 'Posted', 'Delivered')
    ), 0) as remaining_after_posted,
    
    -- Calculate remaining after delivered orders
    -- FIXED: Using delivery_branch_id instead of branch_id
    bip.initial_stock - COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Delivered'
    ), 0) as remaining_after_delivered
    
FROM branches b
CROSS JOIN items i
LEFT JOIN branch_item_prices bip ON b.id = bip.branch_id AND i.item_id = bip.item_id
WHERE bip.id IS NOT NULL
ORDER BY b.name, i.name;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_v_inventory_status_branch_item 
ON branch_item_prices(branch_id, item_id);

-- Test the fix - Check DUTSE stock levels
SELECT 
    branch_code,
    sku,
    item_name,
    initial_stock,
    allocated_qty,
    remaining_after_posted
FROM v_inventory_status 
WHERE branch_code = 'DUTSE'
ORDER BY sku;