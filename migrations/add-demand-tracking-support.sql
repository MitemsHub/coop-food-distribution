-- Add demand tracking support to the inventory system
-- This migration adds columns and modifies views to support demand-based stock allocation

-- Add demand tracking mode flag to branches table
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS demand_tracking_mode BOOLEAN DEFAULT false;

-- Add comment to explain the new column
COMMENT ON COLUMN branches.demand_tracking_mode IS 'When true, stock counters show increasing demand instead of decreasing stock';

-- Update branches to enable demand tracking for all available locations
-- Based on actual branches in database (39 total branches)
UPDATE branches 
SET demand_tracking_mode = true 
WHERE code IN (
  'DUTSE', 'UYO', 'ABAKALIKI', 'JALINGO', 'COOP_SECRETARIAT', 'BIRNIN_KEBBI', 'DAMATURU', 'GUSAU', 'YOLA', 'PORT_HACOURT',
  'UMUAHIA', 'ADO_EKITI', 'AWKA', 'LOKOJA', 'SOKOTO', 'KATSINA', 'ENUGU', 'MAIDUGURI', 'BENIN', 'MAKURDI',
  'YENAGOA', 'ASABA', 'MINNA', 'LAFIA', 'IBADAN', 'ABEOKUTA', 'KANO', 'GOMBE', 'BAUCHI', 'JOS',
  'ILORIN', 'KADUNA', 'AKURE', 'OSHOGBO', 'CALABAR', 'OWERRI', 'ABUJA', 'LAGOS', 'HEAD_OFFICE'
);

-- Drop existing inventory status view to recreate with demand tracking
DROP VIEW IF EXISTS v_inventory_status;

-- Create enhanced inventory status view with demand tracking support
CREATE VIEW v_inventory_status AS
SELECT 
    b.code as branch_code,
    b.name as branch_name,
    b.demand_tracking_mode,
    i.sku,
    i.name as item_name,
    i.unit,
    i.category,
    i.image_url,
    bip.price,
    bip.initial_stock,
    
    -- Calculate total demand (sum of all pending and posted orders)
    COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status IN ('Pending', 'Posted')
    ), 0) as total_demand,
    
    -- Calculate pending demand (only pending orders)
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
    
    -- Calculate allocated quantity (sum of all pending and posted orders) - for backward compatibility
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
    
    -- Calculate remaining after posted orders (for traditional stock tracking)
    CASE 
        WHEN b.demand_tracking_mode = true THEN 
            -- For demand tracking: show how much more can be ordered (if initial_stock > 0)
            GREATEST(0, bip.initial_stock - COALESCE((
                SELECT SUM(ol.qty)
                FROM order_lines ol
                JOIN orders o ON ol.order_id = o.order_id
                WHERE o.delivery_branch_id = b.id 
                AND ol.item_id = i.item_id
                AND o.status IN ('Pending', 'Posted', 'Delivered')
            ), 0))
        ELSE 
            -- For traditional stock tracking: show remaining stock
            GREATEST(0, bip.initial_stock - COALESCE((
                SELECT SUM(ol.qty)
                FROM order_lines ol
                JOIN orders o ON ol.order_id = o.order_id
                WHERE o.delivery_branch_id = b.id 
                AND ol.item_id = i.item_id
                AND o.status IN ('Pending', 'Posted', 'Delivered')
            ), 0))
    END as remaining_after_posted,
    
    -- Calculate remaining after delivered orders
    GREATEST(0, bip.initial_stock - COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id 
        AND ol.item_id = i.item_id
        AND o.status = 'Delivered'
    ), 0)) as remaining_after_delivered
    
FROM branches b
CROSS JOIN items i
LEFT JOIN branch_item_prices bip ON b.id = bip.branch_id AND i.item_id = bip.item_id
WHERE bip.id IS NOT NULL  -- Only include items that have prices set for the branch
ORDER BY b.name, i.name;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_branches_demand_tracking ON branches(demand_tracking_mode);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_branch_status ON orders(delivery_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_order_lines_item_qty ON order_lines(item_id, qty);

-- Add helpful comments
COMMENT ON VIEW v_inventory_status IS 'Enhanced inventory status view supporting both traditional stock tracking and demand-based allocation';
COMMENT ON COLUMN v_inventory_status.total_demand IS 'Total quantity demanded (pending + posted orders)';
COMMENT ON COLUMN v_inventory_status.pending_demand IS 'Quantity from pending orders (member applications)';
COMMENT ON COLUMN v_inventory_status.confirmed_demand IS 'Quantity from posted orders (confirmed allocations)';

-- Test query to verify demand tracking works
SELECT 
    branch_code,
    branch_name,
    demand_tracking_mode,
    sku,
    item_name,
    total_demand,
    pending_demand,
    confirmed_demand,
    remaining_after_posted
FROM v_inventory_status 
WHERE branch_code IN ('DUTSE', 'ABUJA')
ORDER BY branch_code, sku
LIMIT 10;