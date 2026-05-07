create table if not exists ram_vendor_bank_accounts (
  id bigserial primary key,
  ram_delivery_location_id bigint not null references ram_delivery_locations(id) on delete cascade,
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  is_current boolean not null default true,
  created_by_role text,
  created_by_code text,
  created_at timestamptz not null default now()
);

create unique index if not exists ram_vendor_bank_accounts_one_current
  on ram_vendor_bank_accounts (ram_delivery_location_id)
  where is_current;

create index if not exists ram_vendor_bank_accounts_location_idx
  on ram_vendor_bank_accounts (ram_delivery_location_id);

create table if not exists ram_vendor_invoices (
  id bigserial primary key,
  ram_delivery_location_id bigint not null references ram_delivery_locations(id) on delete cascade,
  ram_cycle_id bigint,
  invoice_ref text,
  invoice_date date,
  amount numeric,
  notes text,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  created_by_role text,
  created_by_code text,
  created_at timestamptz not null default now()
);

create index if not exists ram_vendor_invoices_location_idx
  on ram_vendor_invoices (ram_delivery_location_id, created_at desc);

create index if not exists ram_vendor_invoices_cycle_idx
  on ram_vendor_invoices (ram_cycle_id);
