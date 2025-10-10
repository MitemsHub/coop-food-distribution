-- Add PIN column to members table
-- This migration adds a PIN field for member authentication

-- Add the PIN column to the members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS pin VARCHAR(5) NULL;

-- Add a comment to document the column
COMMENT ON COLUMN members.pin IS 'Optional 5-digit numeric PIN for member authentication';

-- Create an index on the pin column for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_members_pin ON members(pin) WHERE pin IS NOT NULL;

-- Add updated_at column to match the standard schema
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'members' AND column_name IN ('pin', 'updated_at')
ORDER BY column_name;