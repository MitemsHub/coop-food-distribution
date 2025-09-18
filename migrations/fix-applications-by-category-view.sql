-- Migration: Fix Applications by Category view to use member categories
-- This updates the v_applications_by_category view to show member categories (A/R/P/E) instead of item categories
-- Run this in Supabase SQL Editor AFTER running the add-member-category-field.sql migration

-- Drop the existing view
DROP VIEW IF EXISTS v_applications_by_category;

-- Create updated view for applications by member category with status breakdown
CREATE VIEW v_applications_by_category AS
SELECT 
    CASE 
        WHEN m.category = 'A' THEN 'Active'
        WHEN m.category = 'R' THEN 'Retiree'
        WHEN m.category = 'P' THEN 'Pensioner'
        WHEN m.category = 'E' THEN 'Coop Staff'
        ELSE COALESCE(m.category, 'Unknown')
    END as category,
    SUM(CASE WHEN o.status = 'Pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN o.status = 'Posted' THEN 1 ELSE 0 END) as posted,
    SUM(CASE WHEN o.status = 'Delivered' THEN 1 ELSE 0 END) as delivered
FROM members m
JOIN orders o ON m.member_id = o.member_id
WHERE m.category IS NOT NULL
GROUP BY m.category
ORDER BY m.category;

-- Add comment for documentation
COMMENT ON VIEW v_applications_by_category IS 'Applications grouped by member category (A/R/P/E) with status breakdown';

-- Test the updated view
SELECT 'Applications by Category (Updated)' as view_name, COUNT(*) as row_count FROM v_applications_by_category;

-- Show sample data
SELECT * FROM v_applications_by_category ORDER BY category;