-- Migration: Add category field to members table
-- This adds the category column to store member categories: A (Active), R (Retiree), P (Pensioner), E (Coop Staff)
-- Run this in Supabase SQL Editor

-- Add category column to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS category VARCHAR(1) DEFAULT 'A';

-- Add comment for documentation
COMMENT ON COLUMN members.category IS 'Member category: A (Active), R (Retiree), P (Pensioner), E (Coop Staff)';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_members_category ON members(category);

-- Add constraint to ensure only valid categories
ALTER TABLE members 
ADD CONSTRAINT chk_member_category 
CHECK (category IN ('A', 'R', 'P', 'E'));

-- Update existing members to set category based on member_id prefix if available
-- This assumes member IDs start with the category letter (common pattern)
UPDATE members 
SET category = CASE 
    WHEN member_id LIKE 'A%' THEN 'A'
    WHEN member_id LIKE 'R%' THEN 'R' 
    WHEN member_id LIKE 'P%' THEN 'P'
    WHEN member_id LIKE 'E%' THEN 'E'
    ELSE 'A'  -- Default to Active if pattern doesn't match
END
WHERE category IS NULL OR category = 'A';

-- Verify the changes
SELECT 
    category,
    COUNT(*) as member_count,
    CASE 
        WHEN category = 'A' THEN 'Active'
        WHEN category = 'R' THEN 'Retiree'
        WHEN category = 'P' THEN 'Pensioner'
        WHEN category = 'E' THEN 'Coop Staff'
        ELSE 'Unknown'
    END as category_name
FROM members
GROUP BY category
ORDER BY category;