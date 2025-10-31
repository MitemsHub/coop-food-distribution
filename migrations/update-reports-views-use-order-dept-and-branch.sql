-- Migration: Fix reports views to use member branch and order-selected department
-- v_applications_by_branch        => groups by orders.branch_id
-- v_applications_by_branch_department => groups by orders.branch_id and orders.department_id

CREATE OR REPLACE VIEW v_applications_by_branch AS
SELECT 
  b.name AS branch_name,
  COALESCE(SUM(CASE WHEN o.status = 'Pending'  THEN 1 ELSE 0 END), 0) AS pending,
  COALESCE(SUM(CASE WHEN o.status = 'Posted'   THEN 1 ELSE 0 END), 0) AS posted,
  COALESCE(SUM(CASE WHEN o.status = 'Delivered' THEN 1 ELSE 0 END), 0) AS delivered
FROM branches b
LEFT JOIN orders o ON b.id = o.branch_id
GROUP BY b.id, b.name
ORDER BY b.name;

CREATE OR REPLACE VIEW v_applications_by_branch_department AS
SELECT 
  b.name AS branch_name,
  d.name AS department_name,
  COALESCE(SUM(CASE WHEN o.status = 'Pending'  THEN 1 ELSE 0 END), 0) AS pending,
  COALESCE(SUM(CASE WHEN o.status = 'Posted'   THEN 1 ELSE 0 END), 0) AS posted,
  COALESCE(SUM(CASE WHEN o.status = 'Delivered' THEN 1 ELSE 0 END), 0) AS delivered
FROM branches b
CROSS JOIN departments d
LEFT JOIN orders o 
  ON o.branch_id     = b.id 
 AND o.department_id = d.id
GROUP BY b.id, b.name, d.id, d.name
ORDER BY b.name, d.name;

-- Optional: category view remains unchanged; ensure consistent naming