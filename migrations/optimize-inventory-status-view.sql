-- Migration: Optimize v_inventory_status view to remove correlated subqueries and heavy sorting
-- This migration replaces per-row correlated subqueries with pre-aggregated joins
-- and removes ORDER BY from the view to allow caller-controlled sorting.

-- Drop existing view to avoid conflicts
DROP VIEW IF EXISTS v_inventory_status;

-- Recreate optimized inventory status view
CREATE VIEW v_inventory_status AS
WITH 
  order_agg AS (
    SELECT 
      o.delivery_branch_id AS branch_id,
      ol.item_id,
      SUM(ol.qty) AS total_demand,
      SUM(CASE WHEN o.status = 'Pending' THEN ol.qty ELSE 0 END) AS pending_demand,
      SUM(CASE WHEN o.status = 'Posted'  THEN ol.qty ELSE 0 END) AS confirmed_demand,
      SUM(CASE WHEN o.status IN ('Pending','Posted') THEN ol.qty ELSE 0 END) AS allocated_qty,
      SUM(CASE WHEN o.status = 'Delivered' THEN ol.qty ELSE 0 END) AS delivered_qty,
      SUM(CASE WHEN o.status = 'Posted' THEN ol.qty ELSE 0 END) AS pending_delivery_qty
    FROM order_lines ol
    JOIN orders o ON o.order_id = ol.order_id
    GROUP BY o.delivery_branch_id, ol.item_id
  ),
  movement_agg AS (
    SELECT 
      branch_id,
      item_id,
      SUM(CASE 
            WHEN movement_type = 'In'  THEN quantity
            WHEN movement_type = 'Out' THEN -quantity
            ELSE 0
          END) AS stock_qty
    FROM inventory_movements
    GROUP BY branch_id, item_id
  )
SELECT 
  b.code AS branch_code,
  b.name AS branch_name,
  b.demand_tracking_mode,
  i.item_id,
  i.sku,
  i.name AS item_name,
  i.unit,
  i.category,
  i.image_url,
  bip.price,
  
  COALESCE(oa.total_demand, 0)           AS total_demand,
  COALESCE(oa.pending_demand, 0)         AS pending_demand,
  COALESCE(oa.confirmed_demand, 0)       AS confirmed_demand,
  COALESCE(oa.allocated_qty, 0)          AS allocated_qty,
  COALESCE(oa.delivered_qty, 0)          AS delivered_qty,
  COALESCE(oa.pending_delivery_qty, 0)   AS pending_delivery_qty,
  
  -- Alias expected by UI
  COALESCE(oa.delivered_qty, 0)          AS delivered_demand,
  
  CASE 
    WHEN b.demand_tracking_mode = TRUE THEN 999999
    ELSE GREATEST(0, COALESCE(ma.stock_qty, 0))
  END AS available_stock,
  
  CASE
    WHEN b.demand_tracking_mode = TRUE THEN 999999
    ELSE GREATEST(0, COALESCE(ma.stock_qty, 0) - COALESCE(oa.total_demand, 0))
  END AS remaining_after_posted,
  
  CASE
    WHEN b.demand_tracking_mode = TRUE THEN 999999
    ELSE GREATEST(0, COALESCE(ma.stock_qty, 0) - COALESCE(oa.delivered_qty, 0))
  END AS remaining_after_delivered
FROM branches b
JOIN branch_item_prices bip ON b.id = bip.branch_id
JOIN items i ON i.item_id = bip.item_id
LEFT JOIN order_agg oa ON oa.branch_id = b.id AND oa.item_id = i.item_id
LEFT JOIN movement_agg ma ON ma.branch_id = b.id AND ma.item_id = i.item_id
WHERE bip.price IS NOT NULL;

-- Helpful comments
COMMENT ON VIEW v_inventory_status IS 'Optimized inventory status view using aggregated joins; no ORDER BY in view.';

-- Supporting indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_branch_item_prices_branch_item ON branch_item_prices(branch_id, item_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id_item ON order_lines(order_id, item_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_branch_status ON orders(delivery_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_item ON inventory_movements(branch_id, item_id);