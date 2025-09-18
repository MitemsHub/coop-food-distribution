-- Check for zero-price entries across all branches
SELECT 
    b.code as branch_code,
    b.name as branch_name,
    COUNT(*) as zero_price_items
FROM branch_item_prices bip
JOIN branches b ON bip.branch_id = b.id
WHERE bip.price = 0
GROUP BY b.code, b.name
ORDER BY zero_price_items DESC;

-- Check specific ADO_EKITI entries
SELECT 
    b.code as branch_code,
    i.sku,
    i.name as item_name,
    bip.price,
    bip.created_at
FROM branch_item_prices bip
JOIN branches b ON bip.branch_id = b.id
JOIN items i ON bip.item_id = i.item_id
WHERE b.code = 'ADO_EKITI'
ORDER BY bip.created_at DESC;

-- Check all branches with configured items
SELECT 
    b.code as branch_code,
    b.name as branch_name,
    COUNT(*) as total_items,
    COUNT(CASE WHEN bip.price > 0 THEN 1 END) as items_with_price,
    COUNT(CASE WHEN bip.price = 0 THEN 1 END) as items_with_zero_price
FROM branch_item_prices bip
JOIN branches b ON bip.branch_id = b.id
GROUP BY b.code, b.name
ORDER BY b.code;