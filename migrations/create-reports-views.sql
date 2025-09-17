-- Migration: Create Reports Views
-- This creates the necessary views for the Reports page

-- Drop existing views if they exist
DROP VIEW IF EXISTS v_applications_by_branch;
DROP VIEW IF EXISTS v_applications_by_branch_department;
DROP VIEW IF EXISTS v_applications_by_category;

-- Create view for applications by branch with status breakdown
CREATE VIEW v_applications_by_branch AS
SELECT 
    b.name as branch_name,
    COALESCE(SUM(CASE WHEN o.status = 'Pending' THEN 1 ELSE 0 END), 0) as pending,
    COALESCE(SUM(CASE WHEN o.status = 'Posted' THEN 1 ELSE 0 END), 0) as posted,
    COALESCE(SUM(CASE WHEN o.status = 'Delivered' THEN 1 ELSE 0 END), 0) as delivered
FROM branches b
LEFT JOIN orders o ON b.id = o.branch_id
GROUP BY b.id, b.name
ORDER BY b.name;

-- Create view for applications by branch and department with status breakdown
CREATE VIEW v_applications_by_branch_department AS
SELECT 
    b.name as branch_name,
    d.name as department_name,
    COALESCE(SUM(CASE WHEN o.status = 'Pending' THEN 1 ELSE 0 END), 0) as pending,
    COALESCE(SUM(CASE WHEN o.status = 'Posted' THEN 1 ELSE 0 END), 0) as posted,
    COALESCE(SUM(CASE WHEN o.status = 'Delivered' THEN 1 ELSE 0 END), 0) as delivered
FROM branches b
CROSS JOIN departments d
LEFT JOIN members m ON m.department_id = d.id
LEFT JOIN orders o ON b.id = o.branch_id AND o.member_id = m.member_id
GROUP BY b.id, b.name, d.id, d.name
HAVING COALESCE(SUM(CASE WHEN o.status IN ('Pending', 'Posted', 'Delivered') THEN 1 ELSE 0 END), 0) > 0
ORDER BY b.name, d.name;

-- Create view for applications by category with status breakdown
CREATE VIEW v_applications_by_category AS
SELECT 
    CASE 
        WHEN i.category = 'A' THEN 'Active'
        WHEN i.category = 'R' THEN 'Retired'
        WHEN i.category = 'P' THEN 'Pensioner'
        WHEN i.category = 'E' THEN 'Employee'
        ELSE COALESCE(i.category, 'Unknown')
    END as category,
    SUM(CASE WHEN o.status = 'Pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN o.status = 'Posted' THEN 1 ELSE 0 END) as posted,
    SUM(CASE WHEN o.status = 'Delivered' THEN 1 ELSE 0 END) as delivered
FROM items i
JOIN order_lines ol ON i.item_id = ol.item_id
JOIN orders o ON ol.order_id = o.order_id
WHERE i.category IS NOT NULL
GROUP BY i.category
ORDER BY i.category;

-- Test the views
SELECT 'Applications by Branch' as view_name, COUNT(*) as row_count FROM v_applications_by_branch;
SELECT 'Applications by Branch & Department' as view_name, COUNT(*) as row_count FROM v_applications_by_branch_department;
SELECT 'Applications by Category' as view_name, COUNT(*) as row_count FROM v_applications_by_category;