-- Create v_inventory_status view for inventory management
-- This view provides comprehensive inventory status across all branches and items

-- Drop existing view if it exists to avoid column name conflicts
DROP VIEW IF EXISTS v_inventory_status;

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
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status IN ('Pending', 'Posted')
    ), 0) as allocated_qty,
    
    -- Calculate delivered quantity (sum of delivered orders)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Delivered'
    ), 0) as delivered_qty,
    
    -- Calculate pending delivery quantity (posted but not delivered)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Posted'
    ), 0) as pending_delivery_qty,
    
    -- Calculate remaining after posted orders
    bip.initial_stock - COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status IN ('Pending', 'Posted', 'Delivered')
    ), 0) as remaining_after_posted,
    
    -- Calculate remaining after delivered orders
    bip.initial_stock - COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Delivered'
    ), 0) as remaining_after_delivered
    
FROM branches b
CROSS JOIN items i
LEFT JOIN branch_item_prices bip ON b.id = bip.branch_id AND i.item_id = bip.item_id
WHERE bip.id IS NOT NULL  -- Only include items that have prices set for the branch
ORDER BY b.name, i.name;

-- Create an index on the view for better performance
CREATE INDEX IF NOT EXISTS idx_v_inventory_status_branch_item 
ON branch_item_prices(branch_id, item_id);