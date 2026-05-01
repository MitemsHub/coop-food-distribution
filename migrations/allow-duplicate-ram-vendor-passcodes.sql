DROP INDEX IF EXISTS ram_delivery_locations_rep_code_uidx;

CREATE INDEX IF NOT EXISTS ram_delivery_locations_rep_code_idx
ON ram_delivery_locations(rep_code)
WHERE rep_code IS NOT NULL AND rep_code <> '';

