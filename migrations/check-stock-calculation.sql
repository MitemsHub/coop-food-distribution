-- Check stock calculation issue
-- This script helps diagnose why stock levels show as 1000

-- 1. Check if there are any orders in the database
SELECT 'Total Orders' as check_type, COUNT(*) as count FROM orders;

-- 2. Check orders by status
SELECT 'Orders by Status' as check_type, status, COUNT(*) as count 
FROM orders 
GROUP BY status 
ORDER BY status;

-- 3. Check what the v_inventory_status view returns for DUTSE branch
SELECT 
    'Inventory Status' as check_type,
    branch_code,
    item_name,
    initial_stock,
    allocated_qty,
    delivered_qty,
    remaining_after_posted,
    remaining_after_delivered
FROM v_inventory_status 
WHERE branch_code = 'DUTSE'
ORDER BY item_name;

-- 4. Check branch_item_prices for DUTSE (fallback data)
SELECT 
    'Branch Item Prices' as check_type,
    b.code as branch_code,
    i.name as item_name,
    bip.initial_stock,
    bip.price
FROM branch_item_prices bip
JOIN branches b ON bip.branch_id = b.id
JOIN items i ON bip.item_id = i.item_id
WHERE b.code = 'DUTSE'
ORDER BY i.name;

-- 5. Check if there are any order_lines that should affect stock
SELECT 
    'Order Lines Summary' as check_type,
    i.name as item_name,
    o.status,
    SUM(ol.qty) as total_qty
FROM order_lines ol
JOIN orders o ON ol.order_id = o.order_id
JOIN items i ON ol.item_id = i.item_id
JOIN branches b ON o.branch_id = b.id
WHERE b.code = 'DUTSE'
GROUP BY i.name, o.status
ORDER BY i.name, o.status;