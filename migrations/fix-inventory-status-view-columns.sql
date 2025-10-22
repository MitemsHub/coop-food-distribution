-- Migration: Fix v_inventory_status view to remove initial_stock and align columns with app
-- This migration recreates v_inventory_status to provide consistent fields used by the UI/API
-- It also adds useful calculated columns using inventory_movements for physical stock tracking

-- Drop existing view to avoid column conflicts
DROP VIEW IF EXISTS v_inventory_status;

-- Recreate the unified inventory status view
CREATE OR REPLACE VIEW v_inventory_status AS
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

    -- Demand aggregates
    COALESCE((
      SELECT SUM(ol.qty)
      FROM order_lines ol
      JOIN orders o ON ol.order_id = o.order_id
      WHERE o.delivery_branch_id = b.id
        AND ol.item_id = i.item_id
    ), 0) AS total_demand,

    COALESCE((
      SELECT SUM(ol.qty)
      FROM order_lines ol
      JOIN orders o ON ol.order_id = o.order_id
      WHERE o.delivery_branch_id = b.id
        AND ol.item_id = i.item_id
        AND o.status = 'Pending'
    ), 0) AS pending_demand,

    COALESCE((
      SELECT SUM(ol.qty)
      FROM order_lines ol
      JOIN orders o ON ol.order_id = o.order_id
      WHERE o.delivery_branch_id = b.id
        AND ol.item_id = i.item_id
        AND o.status = 'Posted'
    ), 0) AS confirmed_demand,

    COALESCE((
      SELECT SUM(ol.qty)
      FROM order_lines ol
      JOIN orders o ON ol.order_id = o.order_id
      WHERE o.delivery_branch_id = b.id
        AND ol.item_id = i.item_id
        AND o.status IN ('Pending', 'Posted')
    ), 0) AS allocated_qty,

    COALESCE((
      SELECT SUM(ol.qty)
      FROM order_lines ol
      JOIN orders o ON ol.order_id = o.order_id
      WHERE o.delivery_branch_id = b.id
        AND ol.item_id = i.item_id
        AND o.status = 'Delivered'
    ), 0) AS delivered_qty,

    COALESCE((
      SELECT SUM(ol.qty)
      FROM order_lines ol
      JOIN orders o ON ol.order_id = o.order_id
      WHERE o.delivery_branch_id = b.id
        AND ol.item_id = i.item_id
        AND o.status = 'Posted'
    ), 0) AS pending_delivery_qty,

    -- Alias for UI expecting delivered_demand
    COALESCE((
      SELECT SUM(ol.qty)
      FROM order_lines ol
      JOIN orders o ON ol.order_id = o.order_id
      WHERE o.delivery_branch_id = b.id
        AND ol.item_id = i.item_id
        AND o.status = 'Delivered'
    ), 0) AS delivered_demand,

    -- Physical stock from movements (only In/Out affect stock)
    CASE 
      WHEN b.demand_tracking_mode = true THEN 999999
      ELSE GREATEST(0, COALESCE((
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
    END AS available_stock,

    -- Remaining after posted orders (approximation using physical stock minus all demand)
    CASE
      WHEN b.demand_tracking_mode = true THEN 999999
      ELSE GREATEST(0, COALESCE((
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
      ), 0) - COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id
          AND ol.item_id = i.item_id
          AND o.status IN ('Pending', 'Posted', 'Delivered')
      ), 0))
    END AS remaining_after_posted,

    -- Remaining after delivered orders (physical stock minus delivered)
    CASE
      WHEN b.demand_tracking_mode = true THEN 999999
      ELSE GREATEST(0, COALESCE((
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
      ), 0) - COALESCE((
        SELECT SUM(ol.qty)
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.order_id
        WHERE o.delivery_branch_id = b.id
          AND ol.item_id = i.item_id
          AND o.status = 'Delivered'
      ), 0))
    END AS remaining_after_delivered

FROM branches b
CROSS JOIN items i
LEFT JOIN branch_item_prices bip ON b.id = bip.branch_id AND i.item_id = bip.item_id
WHERE bip.id IS NOT NULL  -- Only include items that have prices set for the branch
ORDER BY b.name, i.name;

-- Helpful comments
COMMENT ON VIEW v_inventory_status IS 'Unified inventory status view (no initial_stock). Provides demand fields and movement-based stock.';

-- Indexes to support queries
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_item ON inventory_movements(branch_id, item_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_branch_status ON orders(delivery_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_order_lines_item_qty ON order_lines(item_id, qty);