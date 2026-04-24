ALTER TABLE grade_limits
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Undefined';

UPDATE grade_limits SET category = 'Executive' WHERE lower(grade) IN (
  'deputy governor',
  'director',
  'deputy director',
  'assistant director'
);

UPDATE grade_limits SET category = 'Senior' WHERE lower(grade) IN (
  'principal manager',
  'senior manager',
  'manager',
  'deputy manager',
  'assistant manager',
  'senior supervisor 1',
  'senior supervisor 2'
);

UPDATE grade_limits SET category = 'Junior' WHERE lower(grade) IN (
  'supervisor',
  'senior clerk',
  'treasury assistant',
  'clerk',
  'treasury assistant 1',
  'drivers',
  'pensioner',
  'retiree',
  'coop staff'
);

INSERT INTO grade_limits (grade, global_limit, category)
VALUES ('Undefined', 0, 'Undefined')
ON CONFLICT (grade) DO UPDATE SET global_limit = EXCLUDED.global_limit, category = EXCLUDED.category;

CREATE TABLE IF NOT EXISTS ram_cycles (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION get_active_ram_cycle_id()
RETURNS BIGINT
LANGUAGE sql
AS $$
  SELECT id FROM ram_cycles WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1
$$;

CREATE TABLE IF NOT EXISTS ram_delivery_locations (
  id BIGSERIAL PRIMARY KEY,
  delivery_location TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ram_delivery_locations
ADD COLUMN IF NOT EXISTS delivery_location TEXT NOT NULL DEFAULT '';

ALTER TABLE ram_delivery_locations
ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';

ALTER TABLE ram_delivery_locations
ADD COLUMN IF NOT EXISTS rep_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ram_delivery_locations_rep_code_uidx
ON ram_delivery_locations(rep_code)
WHERE rep_code IS NOT NULL AND rep_code <> '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ram_delivery_locations'
      AND column_name = 'vendor_name'
  ) THEN
    UPDATE ram_delivery_locations
    SET name = COALESCE(NULLIF(name, ''), vendor_name)
    WHERE (name = '') AND vendor_name IS NOT NULL;
  END IF;
END
$$;

ALTER TABLE ram_delivery_locations
DROP COLUMN IF EXISTS vendor_name;

CREATE INDEX IF NOT EXISTS ram_delivery_locations_active_idx ON ram_delivery_locations(is_active);
CREATE INDEX IF NOT EXISTS ram_delivery_locations_sort_idx ON ram_delivery_locations(sort_order, delivery_location);

CREATE TABLE IF NOT EXISTS ram_orders (
  id BIGSERIAL PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  ram_cycle_id BIGINT NULL REFERENCES ram_cycles(id) ON DELETE SET NULL,
  ram_delivery_location_id BIGINT NOT NULL REFERENCES ram_delivery_locations(id) ON DELETE RESTRICT,
  payment_option TEXT NOT NULL CHECK (payment_option IN ('Cash', 'Loan', 'Savings')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Cancelled')),
  member_grade TEXT NOT NULL DEFAULT '',
  member_category TEXT NOT NULL DEFAULT 'Undefined',
  unit_price BIGINT NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 0,
  principal_amount BIGINT NOT NULL DEFAULT 0,
  interest_amount BIGINT NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ram_orders
ADD COLUMN IF NOT EXISTS ram_delivery_location_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ram_orders_ram_delivery_location_id_fkey'
      AND conrelid = 'public.ram_orders'::regclass
  ) THEN
    ALTER TABLE ram_orders
    ADD CONSTRAINT ram_orders_ram_delivery_location_id_fkey
    FOREIGN KEY (ram_delivery_location_id)
    REFERENCES ram_delivery_locations(id)
    ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM ram_orders WHERE ram_delivery_location_id IS NULL) = 0 THEN
    ALTER TABLE ram_orders
    ALTER COLUMN ram_delivery_location_id SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ram_orders_ram_delivery_location_id_idx ON ram_orders(ram_delivery_location_id);

CREATE INDEX IF NOT EXISTS ram_orders_member_id_idx ON ram_orders(member_id);
CREATE INDEX IF NOT EXISTS ram_orders_status_idx ON ram_orders(status);
CREATE INDEX IF NOT EXISTS ram_orders_ram_cycle_id_idx ON ram_orders(ram_cycle_id);

CREATE OR REPLACE FUNCTION set_ram_cycle_id_from_active_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ram_cycle_id IS NULL THEN
    NEW.ram_cycle_id := get_active_ram_cycle_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ram_cycle_id ON ram_orders;
CREATE TRIGGER trg_set_ram_cycle_id
BEFORE INSERT ON ram_orders
FOR EACH ROW
EXECUTE FUNCTION set_ram_cycle_id_from_active_cycle();
