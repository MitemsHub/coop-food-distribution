-- Migration: Add department support to items table
-- This adds department_id column to link items with departments for department-level inventory tracking
-- Run this in Supabase SQL Editor

-- Add department_id column to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);

-- Add comment for documentation
COMMENT ON COLUMN items.department_id IS 'Links items to departments for department-level inventory tracking';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_items_department_id ON items(department_id);

-- Update existing items to assign them to departments based on item names
-- You can customize these assignments based on your business logic
-- Note: Make sure you have created your departments first before running this

-- Example department assignments (uncomment and modify as needed):
-- UPDATE items SET department_id = (
--     SELECT id FROM departments WHERE name = 'Your Department Name'
-- ) WHERE department_id IS NULL AND (name ILIKE '%keyword%');

-- Set remaining items to a default department if needed
-- UPDATE items SET department_id = (
--     SELECT id FROM departments WHERE name = 'Default Department'
-- ) WHERE department_id IS NULL;

-- Verify the changes
SELECT 
    i.sku, 
    i.name as item_name, 
    i.category,
    d.name as department_name
FROM items i
LEFT JOIN departments d ON i.department_id = d.id
ORDER BY d.name, i.name
LIMIT 20;