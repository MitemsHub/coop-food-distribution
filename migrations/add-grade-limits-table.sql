-- Create table to store default global limits per grade
CREATE TABLE IF NOT EXISTS grade_limits (
  grade TEXT PRIMARY KEY,
  global_limit BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default limits (values in Naira)
INSERT INTO grade_limits (grade, global_limit) VALUES
  ('Deputy Governor', 0),
  ('Director', 40000000),
  ('Deputy Director', 35000000),
  ('Assistant Director', 32000000), -- Note: original spelling preserved
  ('Principal Manager', 28000000),
  ('Senior Manager', 25000000),
  ('Manager', 22000000),
  ('Deputy Manager', 19000000),
  ('Assistant Manager', 16000000),
  ('Senior Supervisor 1', 11000000),
  ('Senior Supervisor 2', 10000000),
  ('Supervisor', 7500000),
  ('Senior Clerk', 6000000),
  ('Treasury Assistant', 3000000),
  ('Clerk', 3500000),
  ('Treasury Assistant 1', 3000000),
  ('Drivers', 5000000),
  ('Pensioner', 0),
  ('Retiree', 0),
  ('Coop Staff', 0)
ON CONFLICT (grade) DO UPDATE SET global_limit = EXCLUDED.global_limit;

-- Helpful index for case-insensitive lookup
CREATE UNIQUE INDEX IF NOT EXISTS grade_limits_grade_lower_idx ON grade_limits ((lower(grade)));