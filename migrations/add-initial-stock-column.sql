-- Add initial_stock column to branch_item_prices table
-- Run this SQL in Supabase SQL Editor to add the missing column

ALTER TABLE branch_item_prices 
ADD COLUMN IF NOT EXISTS initial_stock INTEGER DEFAULT 0;

-- Update any existing records to have initial_stock = 0
UPDATE branch_item_prices 
SET initial_stock = 0 
WHERE initial_stock IS NULL;