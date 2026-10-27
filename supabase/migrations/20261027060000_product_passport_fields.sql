begin;

-- Fields already used by the ProductVault product API. Keep the original
-- ownership policy and existing rows; all new fields are nullable.
alter table public.products
  add column if not exists owner_name text,
  add column if not exists buying_method text,
  add column if not exists purchase_platform text,
  add column if not exists price_paid numeric(12, 2),
  add column if not exists currency text,
  add column if not exists invoice_number text,
  add column if not exists order_id text,
  add column if not exists warranty_duration_months integer,
  add column if not exists image_url text,
  add column if not exists source_url text,
  add column if not exists asin text;

commit;
