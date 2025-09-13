-- Fix inventory_movements table structure
-- Run this SQL in Supabase SQL Editor to ensure the table exists with all required columns

-- Create inventory_movements table with all required columns
CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(item_id),
    branch_id INTEGER REFERENCES branches(id),
    cycle_id INTEGER REFERENCES cycles(id),
    movement_type VARCHAR(50) NOT NULL, -- 'In', 'Out', 'Adjustment'
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(50), -- 'order', 'adjustment', 'initial'
    reference_id INTEGER,
    notes TEXT,
    movement_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if they don't exist
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference_id INTEGER;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS movement_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_id ON inventory_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_cycle_id ON inventory_movements(cycle_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;