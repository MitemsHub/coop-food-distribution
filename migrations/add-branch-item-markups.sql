-- Add branch-specific item markups
-- Creates a table to add fixed markups (e.g., ₦500) per item per branch

CREATE TABLE IF NOT EXISTS branch_item_markups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, item_id)
);

COMMENT ON TABLE branch_item_markups IS 'Fixed markup per item per branch (e.g., ₦500)';
COMMENT ON COLUMN branch_item_markups.amount IS 'Markup amount added to base price';

CREATE INDEX IF NOT EXISTS idx_branch_item_markups_branch ON branch_item_markups(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_item_markups_item ON branch_item_markups(item_id);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp_branch_item_markups ON branch_item_markups;
CREATE TRIGGER set_timestamp_branch_item_markups
BEFORE UPDATE ON branch_item_markups
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();