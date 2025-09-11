-- Migration: Add image support to items table
-- This adds an image_url column to store relative paths to item images
-- Run this after the existing database-schema.sql

-- Add image_url column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN items.image_url IS 'Relative path to item image (e.g., /images/items/RICE50KG.jpg)';

-- Create index for faster image queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_items_image_url ON items(image_url) WHERE image_url IS NOT NULL;

-- Example update statements (uncomment and modify as needed)
-- UPDATE items SET image_url = '/images/items/' || sku || '.jpg' WHERE sku = 'RICE50KG';
-- UPDATE items SET image_url = '/images/items/' || sku || '.jpg' WHERE sku = 'BEANS25KG';

-- Verify the changes
-- SELECT item_id, sku, name, image_url FROM items LIMIT 5;