-- Migration: Cross-Store Price Intelligence, Price Observations & Alert Enhancements

-- 1. Extend price_watches with tolerance, platform scope, and statistical price history fields
alter table public.price_watches
  add column if not exists tolerance numeric(12, 2) default 0 check (tolerance is null or tolerance >= 0),
  add column if not exists platform_scope text[] default array['Amazon']::text[],
  add column if not exists lowest_recorded_price numeric(12, 2) check (lowest_recorded_price is null or lowest_recorded_price >= 0),
  add column if not exists median_recorded_price numeric(12, 2) check (median_recorded_price is null or median_recorded_price >= 0),
  add column if not exists highest_recorded_price numeric(12, 2) check (highest_recorded_price is null or highest_recorded_price >= 0),
  add column if not exists last_alerted_price numeric(12, 2),
  add column if not exists last_alerted_at timestamptz,
  add column if not exists last_alerted_platform text;

-- 2. Create price_observations table for recording individual verified quotes over time
create table if not exists public.price_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid,
  price_watch_id uuid references public.price_watches (id) on delete cascade,
  platform text not null,
  product_url text not null,
  title text,
  price numeric(12, 2) not null check (price >= 0),
  mrp numeric(12, 2) check (mrp is null or mrp >= 0),
  currency char(3) not null default 'INR',
  availability text not null check (availability in ('IN_STOCK', 'OUT_OF_STOCK', 'NOT_FOUND', 'UNKNOWN')),
  availability_evidence text,
  seller text,
  match_confidence numeric(5, 2) check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 100)),
  observed_at timestamptz not null default now(),
  check (length(product_url) <= 2048)
);

-- Indexes for efficient lookup by user, watch, or product
create index if not exists price_observations_user_id_idx on public.price_observations (user_id);
create index if not exists price_observations_price_watch_id_idx on public.price_observations (price_watch_id);
create index if not exists price_observations_product_platform_idx on public.price_observations (product_id, platform);
create index if not exists price_observations_observed_at_idx on public.price_observations (observed_at desc);

-- Row Level Security
alter table public.price_observations enable row level security;

create policy "price_observations_owner_access" on public.price_observations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
