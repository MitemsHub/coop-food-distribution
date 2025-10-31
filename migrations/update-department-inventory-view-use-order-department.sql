-- Migration: Align v_inventory_status_by_department with order-selected department and delivery branch
-- This replaces member-based or item-based department filtering with orders.department_id,
-- and uses orders.delivery_branch_id for branch context.

CREATE OR REPLACE VIEW v_inventory_status_by_department AS
WITH 
  order_agg AS (
    SELECT 
      o.branch_id     AS branch_id,
      o.department_id AS department_id,
      ol.item_id,
      SUM(ol.qty) AS total_demand,
      SUM(CASE WHEN o.status = 'Pending' THEN ol.qty ELSE 0 END) AS pending_demand,
      SUM(CASE WHEN o.status = 'Posted'  THEN ol.qty ELSE 0 END) AS confirmed_demand,
      SUM(CASE WHEN o.status = 'Delivered' THEN ol.qty ELSE 0 END) AS delivered_qty,
      SUM(CASE WHEN o.status = 'Posted' THEN ol.qty ELSE 0 END) AS pending_delivery_qty
    FROM order_lines ol
    JOIN orders o ON o.order_id = ol.order_id
    GROUP BY o.branch_id, o.department_id, ol.item_id
  ),
  movement_agg AS (
    SELECT 
      branch_id,
      item_id,
      SUM(CASE 
            WHEN movement_type = 'In'  THEN quantity
            WHEN movement_type = 'Out' THEN -quantity
            ELSE 0
          END) AS available_stock
    FROM inventory_movements
    GROUP BY branch_id, item_id
  )
SELECT 
  b.code AS branch_code,
  b.name AS branch_name,
  d.id   AS department_id,
  d.name AS department_name,
  i.sku,
  i.name AS item_name,
  i.unit,
  i.category,
  i.image_url,
  bip.price,
  COALESCE(ma.available_stock, 0) AS available_stock,
  COALESCE(oa.total_demand, 0)        AS total_demand,
  COALESCE(oa.pending_demand, 0)      AS pending_demand,
  COALESCE(oa.confirmed_demand, 0)    AS confirmed_demand,
  COALESCE(oa.delivered_qty, 0)       AS delivered_qty,
  COALESCE(oa.pending_delivery_qty, 0) AS pending_delivery_qty
FROM branches b
CROSS JOIN departments d
CROSS JOIN items i
LEFT JOIN order_agg oa ON oa.branch_id = b.id AND oa.department_id = d.id AND oa.item_id = i.item_id
LEFT JOIN branch_item_prices bip ON bip.branch_id = b.id AND bip.item_id = i.item_id
LEFT JOIN movement_agg ma ON ma.branch_id = b.id AND ma.item_id = i.item_id
WHERE bip.id IS NOT NULL
AND d.id IS NOT NULL
ORDER BY b.name, d.name, i.name;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_orders_branch_department_status ON orders(branch_id, department_id, status);
CREATE INDEX IF NOT EXISTS idx_order_lines_order_item ON order_lines(order_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_item ON inventory_movements(branch_id, item_id);