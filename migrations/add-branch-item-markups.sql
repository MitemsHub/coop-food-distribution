-- Add branch-specific item markups
-- Creates a table to add fixed markups (e.g., ₦500) per item per branch

CREATE TABLE IF NOT EXISTS branch_item_markups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  cycle_id INTEGER REFERENCES cycles(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, item_id, cycle_id)
);

COMMENT ON TABLE branch_item_markups IS 'Fixed markup per item per branch (e.g., ₦500)';
COMMENT ON COLUMN branch_item_markups.amount IS 'Markup amount added to base price';

CREATE INDEX IF NOT EXISTS idx_branch_item_markups_branch ON branch_item_markups(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_item_markups_item ON branch_item_markups(item_id);
CREATE INDEX IF NOT EXISTS idx_branch_item_markups_cycle ON branch_item_markups(cycle_id);

DO $$
DECLARE
  v_active_cycle_id INTEGER;
  r RECORD;
BEGIN
  ALTER TABLE public.branch_item_markups
    ADD COLUMN IF NOT EXISTS cycle_id INTEGER REFERENCES public.cycles(id);

  BEGIN
    SELECT id INTO v_active_cycle_id
    FROM public.cycles
    WHERE is_active = TRUE
    LIMIT 1;
  EXCEPTION WHEN undefined_column THEN
    SELECT id INTO v_active_cycle_id
    FROM public.cycles
    ORDER BY id DESC
    LIMIT 1;
  END;

  IF v_active_cycle_id IS NOT NULL THEN
    UPDATE public.branch_item_markups
    SET cycle_id = v_active_cycle_id
    WHERE cycle_id IS NULL;
  END IF;

  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'branch_item_markups'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY ck.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ck.attnum
      )::text[] = ARRAY['branch_id','item_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.branch_item_markups DROP CONSTRAINT %I', r.conname);
  END LOOP;

  CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_item_markups_cycle
    ON public.branch_item_markups(branch_id, item_id, cycle_id);
END $$;

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
