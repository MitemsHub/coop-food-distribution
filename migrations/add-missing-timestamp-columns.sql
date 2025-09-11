-- Add missing timestamp columns to orders table
-- This fixes the issue where RPC functions try to update non-existent columns

-- Add posted_at column to track when order was posted
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE;

-- Add delivered_at column to track when order was delivered
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- Add cancelled_at column for future use
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- Add admin_note column to track who performed actions
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Add delivery_branch_id to track delivery branch (if different from member branch)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_branch_id INTEGER REFERENCES branches(id);

-- Create indexes for better performance on timestamp queries
CREATE INDEX IF NOT EXISTS idx_orders_posted_at ON orders(posted_at) WHERE posted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON orders(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- Verify the columns were added successfully
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('posted_at', 'delivered_at', 'cancelled_at', 'admin_note', 'delivery_branch_id')
ORDER BY column_name;