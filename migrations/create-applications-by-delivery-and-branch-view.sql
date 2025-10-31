-- Migration: Create view for Applications by Delivery Branch & Branch
-- Provides counts of orders grouped by DELIVERY branch (o.delivery_branch_id)
-- and MEMBER branch (o.branch_id), across statuses Pending, Posted, Delivered.

CREATE OR REPLACE VIEW v_applications_by_delivery_branch_member_branch AS
SELECT 
  db.name AS delivery_branch_name,
  mb.name AS branch_name,
  COALESCE(SUM(CASE WHEN o.status = 'Pending'  THEN 1 ELSE 0 END), 0) AS pending,
  COALESCE(SUM(CASE WHEN o.status = 'Posted'   THEN 1 ELSE 0 END), 0) AS posted,
  COALESCE(SUM(CASE WHEN o.status = 'Delivered' THEN 1 ELSE 0 END), 0) AS delivered
FROM branches db
CROSS JOIN branches mb
LEFT JOIN orders o 
  ON o.delivery_branch_id = db.id
 AND o.branch_id          = mb.id
GROUP BY db.id, db.name, mb.id, mb.name
ORDER BY db.name, mb.name;

-- Helpful index to speed up aggregation on (delivery_branch_id, branch_id, status)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_branch_member_branch_status 
  ON orders(delivery_branch_id, branch_id, status);

COMMENT ON VIEW v_applications_by_delivery_branch_member_branch IS 
  'Applications grouped by delivery branch and member branch with status counts.';