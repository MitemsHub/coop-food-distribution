create table if not exists ram_vendor_payment_status (
  id bigserial primary key,
  ram_delivery_location_id bigint not null references ram_delivery_locations(id) on delete cascade,
  ram_cycle_id bigint,
  is_paid boolean not null default false,
  paid_at timestamptz,
  paid_by_role text,
  paid_by_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ram_vendor_payment_status_loc_cycle
  on ram_vendor_payment_status (ram_delivery_location_id, ram_cycle_id);

create index if not exists ram_vendor_payment_status_paid_idx
  on ram_vendor_payment_status (ram_cycle_id, is_paid);
