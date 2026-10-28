-- ProductVault reminder lifecycle, inbox, email outbox, and idempotent price checks.
-- Additive only: existing reminder and price history rows remain intact.

alter table public.reminders
  add column if not exists reminder_type text not null default 'replenishment',
  add column if not exists title text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists coverage_expires_at date,
  add column if not exists coverage_label text,
  add column if not exists source_key text;

alter table public.reminders drop constraint if exists reminders_status_check;
alter table public.reminders add constraint reminders_status_check
  check (status in ('scheduled', 'sent', 'cancelled', 'failed', 'completed'));
alter table public.reminders drop constraint if exists reminders_reminder_type_check;
alter table public.reminders add constraint reminders_reminder_type_check
  check (reminder_type in ('warranty_expiry', 'policy_expiry', 'service', 'replenishment', 'claim_follow_up'));
alter table public.reminders drop constraint if exists reminders_title_length_check;
alter table public.reminders add constraint reminders_title_length_check
  check (title is null or length(trim(title)) between 1 and 120);
alter table public.reminders drop constraint if exists reminders_coverage_label_length_check;
alter table public.reminders add constraint reminders_coverage_label_length_check
  check (coverage_label is null or length(trim(coverage_label)) <= 100);

create unique index if not exists reminders_source_key_uidx
  on public.reminders (source_key);
create unique index if not exists reminders_id_user_id_uidx on public.reminders (id, user_id);
create index if not exists reminders_due_dispatch_idx
  on public.reminders (remind_at, id) where status = 'scheduled';
create index if not exists reminders_owner_status_due_idx
  on public.reminders (user_id, status, remind_at);

create unique index if not exists price_watches_id_user_id_uidx on public.price_watches (id, user_id);

create or replace function public.guard_reminder_user_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.status <> 'scheduled' or new.channel <> 'in_app' or new.source_key is not null then
        raise exception 'Reminder system fields are managed by the server';
      end if;
    else
      if new.user_id is distinct from old.user_id or new.product_id is distinct from old.product_id
        or new.claim_id is distinct from old.claim_id or new.reminder_type is distinct from old.reminder_type
        or new.coverage_expires_at is distinct from old.coverage_expires_at
        or new.coverage_label is distinct from old.coverage_label or new.source_key is distinct from old.source_key then
        raise exception 'Reminder ownership and source fields cannot be changed';
      end if;
      if new.status not in ('scheduled', 'cancelled', 'completed') then
        raise exception 'This reminder status is managed by the system';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reminders_guard_user_mutation on public.reminders;
create trigger reminders_guard_user_mutation
before insert or update on public.reminders
for each row execute function public.guard_reminder_user_mutation();

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reminder_email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_notification_preferences()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_touch on public.notification_preferences;
create trigger notification_preferences_touch
before update on public.notification_preferences
for each row execute function public.touch_notification_preferences();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_id uuid,
  price_watch_id uuid,
  product_id uuid,
  claim_id uuid,
  kind text not null check (kind in ('warranty_expiry', 'policy_expiry', 'service', 'replenishment', 'claim_follow_up', 'price_watch')),
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null check (length(trim(body)) between 1 and 500),
  href text,
  event_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (reminder_id, user_id) references public.reminders (id, user_id) on delete cascade,
  foreign key (price_watch_id, user_id) references public.price_watches (id, user_id) on delete cascade,
  foreign key (product_id, user_id) references public.products (id, user_id) on delete cascade,
  foreign key (claim_id, user_id) references public.claims (id, user_id) on delete cascade,
  unique (id, user_id),
  unique (user_id, event_key)
);

create index if not exists notifications_owner_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_owner_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id uuid not null,
  channel text not null default 'email' check (channel = 'email'),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'unknown', 'suppressed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  provider_message_id text,
  safe_error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key (notification_id, user_id) references public.notifications (id, user_id) on delete cascade,
  unique (notification_id, user_id, channel)
);

create or replace function public.suppress_opted_out_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.reminder_email_enabled and not new.reminder_email_enabled then
    update public.notification_deliveries d set status = 'suppressed', lease_expires_at = null
    where d.user_id = new.user_id and d.status in ('pending', 'failed');
  end if;
  return new;
end;
$$;

drop trigger if exists notification_preferences_suppress_pending on public.notification_preferences;
create trigger notification_preferences_suppress_pending
after update on public.notification_preferences
for each row execute function public.suppress_opted_out_notification_deliveries();

create index if not exists notification_deliveries_dispatch_idx
  on public.notification_deliveries (available_at, created_at)
  where status in ('pending', 'failed');
create index if not exists notification_deliveries_owner_created_idx
  on public.notification_deliveries (user_id, created_at desc);

alter table public.price_watches
  add column if not exists last_check_status text not null default 'not_checked',
  add column if not exists last_check_error_code text,
  add column if not exists next_check_at timestamptz,
  add column if not exists alert_state boolean not null default false,
  add column if not exists current_price_source text not null default 'manual',
  add column if not exists manual_price numeric(12, 2),
  add column if not exists manual_price_entered_at timestamptz;
alter table public.price_watches drop constraint if exists price_watches_last_check_status_check;
alter table public.price_watches add constraint price_watches_last_check_status_check
  check (last_check_status in ('not_checked', 'verified', 'failed', 'unavailable', 'unsupported'));
alter table public.price_watches drop constraint if exists price_watches_current_price_source_check;
alter table public.price_watches add constraint price_watches_current_price_source_check
  check (current_price_source in ('manual', 'verified', 'unverified'));
alter table public.price_watches drop constraint if exists price_watches_manual_price_check;
alter table public.price_watches add constraint price_watches_manual_price_check
  check (manual_price is null or manual_price >= 0);
create index if not exists price_watches_automated_due_idx
  on public.price_watches (next_check_at, id)
  where checking_mode = 'automated';

alter table public.price_observations
  add column if not exists check_key text,
  add column if not exists source_verified boolean not null default false;

do $$
begin
  if exists (
    select 1 from public.price_observations o
    where o.price_watch_id is not null
      and not exists (select 1 from public.price_watches w where w.id = o.price_watch_id and w.user_id = o.user_id)
  ) then
    raise exception 'Existing price observations contain a watch-owner mismatch; audit these rows before applying the reminder migration.';
  end if;
  if exists (
    select 1 from public.price_observations o
    where o.product_id is not null
      and not exists (select 1 from public.products p where p.id = o.product_id and p.user_id = o.user_id)
  ) then
    raise exception 'Existing price observations contain a product-owner mismatch; audit these rows before applying the reminder migration.';
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.price_observations'::regclass and conname = 'price_observations_watch_owner_fk') then
    alter table public.price_observations add constraint price_observations_watch_owner_fk
      foreign key (price_watch_id, user_id) references public.price_watches (id, user_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.price_observations'::regclass and conname = 'price_observations_product_owner_fk') then
    alter table public.price_observations add constraint price_observations_product_owner_fk
      foreign key (product_id, user_id) references public.products (id, user_id) on delete cascade;
  end if;
end;
$$;

create unique index if not exists price_observations_watch_check_uidx
  on public.price_observations (price_watch_id, check_key)
  where price_watch_id is not null and check_key is not null;
create index if not exists price_observations_watch_history_idx
  on public.price_observations (user_id, price_watch_id, observed_at desc);

create table if not exists public.price_watch_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  price_watch_id uuid not null,
  check_date date not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'retry_wait', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  safe_error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (price_watch_id, user_id) references public.price_watches (id, user_id) on delete cascade,
  unique (price_watch_id, check_date)
);

create index if not exists price_watch_checks_dispatch_idx
  on public.price_watch_checks (available_at, created_at)
  where status in ('pending', 'retry_wait', 'processing');
create index if not exists price_watch_checks_owner_created_idx
  on public.price_watch_checks (user_id, created_at desc);

create table if not exists public.price_discovery_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  retailer text not null check (retailer in ('Amazon', 'Flipkart', 'Meesho', 'Croma')),
  quota_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, retailer, quota_date)
);

alter table public.price_discovery_usage enable row level security;
revoke all on public.price_discovery_usage from anon, authenticated;
grant all on public.price_discovery_usage to service_role;

create or replace function public.consume_price_discovery_quota(p_retailer text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null or p_retailer not in ('Amazon', 'Flipkart', 'Meesho', 'Croma') then
    return false;
  end if;
  insert into public.price_discovery_usage (user_id, retailer, quota_date, request_count)
  values (v_user_id, p_retailer, (now() at time zone 'Asia/Kolkata')::date, 1)
  on conflict (user_id, retailer, quota_date) do update
    set request_count = public.price_discovery_usage.request_count + 1, updated_at = now()
    where public.price_discovery_usage.request_count < 5
  returning request_count into v_count;
  return v_count is not null;
end;
$$;

create or replace function public.enqueue_due_reminders(p_now timestamptz default now(), p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auto_count integer := 0;
  v_notification_count integer := 0;
  v_delivery_count integer := 0;
begin
  if p_limit < 1 or p_limit > 250 then
    raise exception 'p_limit must be between 1 and 250';
  end if;

  insert into public.reminders (
    user_id, product_id, reminder_type, title, remind_at, channel, reason,
    status, coverage_expires_at, coverage_label, source_key
  )
  select p.user_id, p.id, 'warranty_expiry',
    coalesce(nullif(trim(p.name), ''), 'Product') || ' warranty expires in ' || offsets.days || ' days',
    ((p.warranty_end - offsets.days)::timestamp + time '09:00') at time zone 'Asia/Kolkata',
    'in_app', 'Review the warranty before its expiry date.', 'scheduled', p.warranty_end,
    'Warranty', 'auto-coverage:' || p.id::text || ':warranty_expiry:' || p.warranty_end::text || ':' || offsets.days::text
  from public.products p
  cross join (values (30), (7)) as offsets(days)
  where p.warranty_end is not null
    and (p.warranty_end - offsets.days) >= (p_now at time zone 'Asia/Kolkata')::date
  on conflict (source_key) do nothing;
  get diagnostics v_auto_count = row_count;

  update public.reminders r set status = 'cancelled', updated_at = p_now
  where r.source_key like 'auto-coverage:%' and r.status = 'scheduled'
    and exists (
      select 1 from public.products p
      where p.id = r.product_id and p.user_id = r.user_id
        and (p.warranty_end is null or r.coverage_expires_at is distinct from p.warranty_end)
    );

  with due as materialized (
    select r.id, r.user_id, r.reminder_type, r.title, r.reason, r.product_id, r.claim_id, r.remind_at
    from public.reminders r
    where r.status = 'scheduled' and r.remind_at <= p_now
    order by r.remind_at, r.id
    for update skip locked
    limit p_limit
  ), inserted as (
    insert into public.notifications (user_id, reminder_id, product_id, claim_id, kind, title, body, href, event_key)
    select d.user_id, d.id, d.product_id, d.claim_id, d.reminder_type, d.title, d.reason,
      case when d.product_id is not null then '/dashboard/products?product=' || d.product_id::text
           when d.claim_id is not null then '/dashboard/claims?claim=' || d.claim_id::text end,
      'reminder:' || d.id::text || ':' || extract(epoch from d.remind_at)::bigint::text
    from due d
    on conflict (user_id, event_key) do nothing
    returning id, user_id
  ), delivery_rows as (
    insert into public.notification_deliveries (user_id, notification_id)
    select i.user_id, i.id
    from inserted i
    join public.notification_preferences prefs on prefs.user_id = i.user_id and prefs.reminder_email_enabled
    on conflict (notification_id, user_id, channel) do nothing
    returning id
  ), updated as (
    update public.reminders r set status = 'sent', updated_at = p_now
    from due d
    where r.id = d.id
    returning r.id
  )
  select (select count(*) from inserted), (select count(*) from delivery_rows)
  into v_notification_count, v_delivery_count;

  return jsonb_build_object(
    'expiry_reminders_created', v_auto_count,
    'notifications_created', v_notification_count,
    'email_deliveries_created', v_delivery_count
  );
end;
$$;

create or replace function public.claim_notification_email_deliveries(p_now timestamptz default now(), p_limit integer default 25)
returns table (delivery_id uuid, user_id uuid, recipient text, notification_title text, notification_body text, notification_href text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 50 then
    raise exception 'p_limit must be between 1 and 50';
  end if;

  -- A stale lease is ambiguous: do not resend and risk a duplicate email.
  update public.notification_deliveries d
    set status = 'unknown', lease_expires_at = null, safe_error_code = 'DELIVERY_RESULT_UNKNOWN'
  where d.status = 'sending' and d.lease_expires_at < p_now;

  return query
  with candidates as materialized (
    select d.id
    from public.notification_deliveries d
    where d.status in ('pending', 'failed') and d.available_at <= p_now and d.attempts < 5
    order by d.available_at, d.created_at, d.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.notification_deliveries d
      set status = 'sending', attempts = d.attempts + 1, lease_expires_at = p_now + interval '3 minutes', safe_error_code = null
    from candidates c
    where d.id = c.id
    returning d.id, d.user_id, d.notification_id
  )
  select c.id, c.user_id, u.email, n.title, n.body, n.href
  from claimed c
  join public.notifications n on n.id = c.notification_id and n.user_id = c.user_id
  join auth.users u on u.id = c.user_id
  where u.email is not null;
end;
$$;

create or replace function public.finish_notification_email_delivery(
  p_delivery_id uuid, p_status text, p_provider_message_id text default null, p_safe_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  if p_status not in ('sent', 'failed', 'unknown') then
    raise exception 'Invalid delivery status';
  end if;
  update public.notification_deliveries d
    set status = p_status,
      provider_message_id = case when p_status = 'sent' then p_provider_message_id else null end,
      safe_error_code = case when p_status = 'sent' then null else left(coalesce(p_safe_error_code, 'DELIVERY_FAILED'), 80) end,
      available_at = case when p_status = 'failed' then now() + interval '15 minutes' else d.available_at end,
      lease_expires_at = null,
      sent_at = case when p_status = 'sent' then now() else null end
  where d.id = p_delivery_id and d.status = 'sending';
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.claim_due_price_watch_checks(p_now timestamptz default now(), p_limit integer default 5)
returns table (check_id uuid, user_id uuid, price_watch_id uuid, product_id uuid, product_url text, target_price numeric, check_key text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'p_limit must be between 1 and 10';
  end if;

  insert into public.price_watch_checks (user_id, price_watch_id, check_date)
  select w.user_id, w.id, (p_now at time zone 'Asia/Kolkata')::date
  from public.price_watches w
  where w.checking_mode = 'automated'
    and coalesce(w.next_check_at, w.created_at) <= p_now
  on conflict (price_watch_id, check_date) do nothing;

  return query
  with candidates as materialized (
    select c.id
    from public.price_watch_checks c
    join public.price_watches w on w.id = c.price_watch_id and w.user_id = c.user_id
    where w.checking_mode = 'automated'
      and c.available_at <= p_now
      and c.attempts < 3
      and (c.status in ('pending', 'retry_wait') or (c.status = 'processing' and c.lease_expires_at < p_now))
    order by c.available_at, c.created_at, c.id
    for update of c skip locked
    limit p_limit
  ), claimed as (
    update public.price_watch_checks c
      set status = 'processing', attempts = c.attempts + 1, lease_expires_at = p_now + interval '3 minutes', safe_error_code = null
    from candidates x
    where c.id = x.id
    returning c.id, c.user_id, c.price_watch_id, c.check_date
  )
  select c.id, c.user_id, w.id, w.product_id, w.product_url,
    w.target_price, w.id::text || ':' || c.check_date::text
  from claimed c
  join public.price_watches w on w.id = c.price_watch_id and w.user_id = c.user_id;
end;
$$;

create or replace function public.record_verified_price_watch_observation(
  p_check_id uuid,
  p_user_id uuid,
  p_price numeric,
  p_mrp numeric,
  p_currency text,
  p_platform text,
  p_product_url text,
  p_title text,
  p_availability text,
  p_availability_evidence text,
  p_seller text,
  p_match_confidence numeric,
  p_check_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watch public.price_watches%rowtype;
  v_watch_check public.price_watch_checks%rowtype;
  v_observation_id uuid;
  v_notification_id uuid;
  v_crossed boolean := false;
begin
  if p_price is null or p_price < 0 or p_price > 9999999999.99
    or p_currency !~ '^[A-Z]{3}$'
    or p_availability <> 'IN_STOCK'
    or length(p_product_url) > 2048
    or p_match_confidence is null or p_match_confidence < 0 or p_match_confidence > 100 then
    raise exception 'Price observation is not verified';
  end if;

  select * into v_watch_check from public.price_watch_checks c
  where c.id = p_check_id and c.user_id = p_user_id and c.status = 'processing' for update;
  if not found then return jsonb_build_object('recorded', false, 'duplicate', true); end if;

  select * into v_watch from public.price_watches w
  where w.id = v_watch_check.price_watch_id and w.user_id = p_user_id and w.checking_mode = 'automated' for update;
  if not found then raise exception 'Price watch is unavailable'; end if;

  insert into public.price_observations (
    user_id, product_id, price_watch_id, platform, product_url, title, price, mrp, currency,
    availability, availability_evidence, seller, match_confidence, observed_at, check_key, source_verified
  ) values (
    p_user_id, v_watch.product_id, v_watch.id, p_platform, p_product_url, p_title, p_price, p_mrp,
    p_currency, p_availability, left(p_availability_evidence, 500), left(p_seller, 160), p_match_confidence,
    now(), p_check_key, true
  ) on conflict (price_watch_id, check_key) where price_watch_id is not null and check_key is not null do nothing
  returning id into v_observation_id;

  if v_observation_id is null then
    update public.price_watch_checks set status = 'succeeded', completed_at = now(), lease_expires_at = null
      where id = p_check_id;
    return jsonb_build_object('recorded', false, 'duplicate', true);
  end if;

  v_crossed := v_watch.target_price is not null and p_price <= v_watch.target_price and not v_watch.alert_state;
  update public.price_watches set
    current_price = p_price,
    current_price_source = 'verified',
    last_checked_at = now(),
    last_check_status = 'verified',
    last_check_error_code = null,
    next_check_at = (now() at time zone 'Asia/Kolkata')::date + 1,
    alert_state = (v_watch.target_price is not null and p_price <= v_watch.target_price),
    lowest_recorded_price = case when lowest_recorded_price is null then p_price else least(lowest_recorded_price, p_price) end,
    highest_recorded_price = case when highest_recorded_price is null then p_price else greatest(highest_recorded_price, p_price) end
  where id = v_watch.id and user_id = p_user_id;

  if v_crossed then
    insert into public.notifications (user_id, price_watch_id, product_id, kind, title, body, href, event_key)
    values (p_user_id, v_watch.id, v_watch.product_id, 'price_watch', 'Your price target was reached',
      coalesce(p_title, 'A tracked product') || ' is now ' || p_currency || ' ' || p_price::text || '.',
      '/dashboard/prices', 'price-watch:' || v_watch.id::text || ':' || p_check_key)
    on conflict (user_id, event_key) do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      insert into public.notification_deliveries (user_id, notification_id)
      select p_user_id, v_notification_id
      from public.notification_preferences prefs
      where prefs.user_id = p_user_id and prefs.reminder_email_enabled
      on conflict (notification_id, user_id, channel) do nothing;
    end if;
  end if;

  update public.price_watch_checks set status = 'succeeded', completed_at = now(), lease_expires_at = null
    where id = p_check_id;
  return jsonb_build_object('recorded', true, 'alert_created', v_notification_id is not null);
end;
$$;

create or replace function public.fail_price_watch_check(p_check_id uuid, p_user_id uuid, p_safe_error_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_retry boolean;
begin
  select attempts into v_attempts from public.price_watch_checks
  where id = p_check_id and user_id = p_user_id and status = 'processing' for update;
  if not found then return false; end if;
  v_retry := v_attempts < 3;
  update public.price_watch_checks set
    status = case when v_retry then 'retry_wait' else 'failed' end,
    available_at = case when v_retry then now() + interval '6 hours' else now() end,
    lease_expires_at = null,
    safe_error_code = left(coalesce(p_safe_error_code, 'PRICE_CHECK_FAILED'), 80),
    completed_at = case when v_retry then null else now() end
  where id = p_check_id;
  update public.price_watches w set
    last_checked_at = now(),
    last_check_status = case when v_retry then 'failed' else 'failed' end,
    last_check_error_code = left(coalesce(p_safe_error_code, 'PRICE_CHECK_FAILED'), 80),
    next_check_at = case when v_retry then now() + interval '6 hours' else (now() at time zone 'Asia/Kolkata')::date + 1 end
  from public.price_watch_checks c
  where c.id = p_check_id and w.id = c.price_watch_id and w.user_id = c.user_id;
  return true;
end;
$$;

create or replace function public.create_coverage_expiry_reminders(
  p_product_id uuid,
  p_reminder_type text,
  p_expires_at date,
  p_coverage_label text default null,
  p_title text default null,
  p_reason text default null
)
returns setof public.reminders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_user_id is null or p_product_id is null
    or p_reminder_type not in ('warranty_expiry', 'policy_expiry')
    or p_expires_at is null or p_expires_at < v_today
    or length(trim(coalesce(p_coverage_label, ''))) > 100
    or length(trim(coalesce(p_title, ''))) > 120
    or length(trim(coalesce(p_reason, ''))) > 500 then
    raise exception 'Invalid coverage reminder';
  end if;
  if not exists (select 1 from public.products p where p.id = p_product_id and p.user_id = v_user_id) then
    raise exception 'Product not found';
  end if;

  update public.reminders r set status = 'cancelled', updated_at = now()
  where r.user_id = v_user_id and r.product_id = p_product_id and r.reminder_type = p_reminder_type
    and r.status = 'scheduled' and r.source_key like 'coverage:' || p_product_id::text || ':' || p_reminder_type || ':%'
    and r.coverage_expires_at is distinct from p_expires_at;

  insert into public.reminders (
    user_id, product_id, reminder_type, title, remind_at, channel, reason, status,
    coverage_expires_at, coverage_label, source_key
  )
  select v_user_id, p_product_id, p_reminder_type,
    coalesce(nullif(trim(p_title), ''), coalesce(nullif(trim(p_coverage_label), ''), 'Coverage') || ' expires in ' || offsets.days || ' days'),
    ((p_expires_at - offsets.days)::timestamp + time '09:00') at time zone 'Asia/Kolkata',
    'in_app', coalesce(nullif(trim(p_reason), ''), 'Review ' || coalesce(nullif(trim(p_coverage_label), ''), 'your coverage') || ' before its expiry date.'),
    'scheduled', p_expires_at, nullif(trim(p_coverage_label), ''),
    'coverage:' || p_product_id::text || ':' || p_reminder_type || ':' || p_expires_at::text || ':' || offsets.days::text
  from (values (30), (7)) as offsets(days)
  where (p_expires_at - offsets.days) >= v_today
  on conflict (source_key) do nothing;

  return query select r.* from public.reminders r
  where r.user_id = v_user_id and r.product_id = p_product_id and r.reminder_type = p_reminder_type
    and r.coverage_expires_at = p_expires_at
    and r.source_key like 'coverage:' || p_product_id::text || ':' || p_reminder_type || ':%'
  order by r.remind_at;
end;
$$;

create or replace function public.create_price_watch_with_initial_observation(
  p_product_id uuid,
  p_product_url text,
  p_current_price numeric,
  p_target_price numeric,
  p_checking_mode text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_watch public.price_watches%rowtype;
begin
  if v_user_id is null or p_current_price is null or p_current_price < 0 or p_current_price > 9999999999.99
    or p_target_price is null or p_target_price < 0 or p_target_price > 9999999999.99
    or p_checking_mode not in ('manual', 'automated') or p_product_url is not null and length(p_product_url) > 2048 then
    raise exception 'Invalid price watch';
  end if;
  if not exists (select 1 from public.products p where p.id = p_product_id and p.user_id = v_user_id) then
    raise exception 'Product not found';
  end if;
  if p_checking_mode = 'automated' and p_product_url is null then
    raise exception 'Automated watches require a retailer URL';
  end if;

  insert into public.price_watches (
    user_id, product_id, product_url, current_price, target_price, currency, checking_mode,
    current_price_source, manual_price, manual_price_entered_at, last_check_status, next_check_at
  ) values (
    v_user_id, p_product_id, p_product_url, p_current_price, p_target_price, 'INR', p_checking_mode,
    case when p_checking_mode = 'automated' then 'unverified' else 'manual' end,
    case when p_checking_mode = 'manual' then p_current_price else null end,
    case when p_checking_mode = 'manual' then now() else null end,
    'not_checked', case when p_checking_mode = 'automated' then now() else null end
  ) returning * into v_watch;

  insert into public.price_observations (
    user_id, product_id, price_watch_id, platform, product_url, title, price, currency,
    availability, availability_evidence, observed_at, source_verified
  ) values (
    v_user_id, p_product_id, v_watch.id,
    case when p_checking_mode = 'automated' then 'Initial estimate' else 'Manual' end,
    coalesce(p_product_url, 'manual://price-watch/' || v_watch.id::text), null, p_current_price, 'INR',
    'UNKNOWN', case when p_checking_mode = 'automated' then 'Unverified initial estimate' else 'User-entered initial price' end,
    now(), false
  );
  return v_watch.id;
end;
$$;

create or replace function public.record_manual_price_watch_observation(p_watch_id uuid, p_price numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_watch public.price_watches%rowtype;
  v_observation_id uuid;
begin
  if v_user_id is null or p_price is null or p_price < 0 or p_price > 9999999999.99 then
    raise exception 'A signed-in owner and valid price are required';
  end if;
  select * into v_watch from public.price_watches w
  where w.id = p_watch_id and w.user_id = v_user_id for update;
  if not found then raise exception 'Price watch not found'; end if;

  insert into public.price_observations (
    user_id, product_id, price_watch_id, platform, product_url, title, price, currency,
    availability, availability_evidence, match_confidence, observed_at, source_verified
  ) values (
    v_user_id, v_watch.product_id, v_watch.id, 'Manual', coalesce(v_watch.product_url, 'manual://price-watch/' || v_watch.id::text),
    null, p_price, v_watch.currency, 'UNKNOWN', 'User-entered price', null, now(), false
  ) returning id into v_observation_id;

  if v_watch.current_price_source = 'verified' or v_watch.checking_mode = 'automated' then
    update public.price_watches set manual_price = p_price, manual_price_entered_at = now()
      where id = p_watch_id and user_id = v_user_id;
  else
    update public.price_watches set current_price = p_price, current_price_source = 'manual', last_checked_at = now()
      where id = p_watch_id and user_id = v_user_id;
  end if;
  return v_observation_id;
end;
$$;

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.price_watch_checks enable row level security;
alter table public.price_discovery_usage enable row level security;

drop policy if exists notification_preferences_owner_access on public.notification_preferences;
create policy notification_preferences_owner_access on public.notification_preferences
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists notification_deliveries_owner_select on public.notification_deliveries;
create policy notification_deliveries_owner_select on public.notification_deliveries
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists price_watch_checks_owner_select on public.price_watch_checks;
create policy price_watch_checks_owner_select on public.price_watch_checks
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists price_observations_owner_access on public.price_observations;
create policy price_observations_owner_select on public.price_observations
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update (reminder_email_enabled) on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

revoke all on public.notification_deliveries from anon, authenticated;
grant select on public.notification_deliveries to authenticated;
grant all on public.notification_deliveries to service_role;

revoke all on public.price_watch_checks from anon, authenticated;
grant select on public.price_watch_checks to authenticated;
grant all on public.price_watch_checks to service_role;

revoke insert, update, delete on public.price_observations from anon, authenticated;
grant select on public.price_observations to authenticated;
grant all on public.price_observations to service_role;

revoke all on public.reminders from anon, authenticated;
grant select, delete on public.reminders to authenticated;
grant insert (user_id, product_id, claim_id, remind_at, channel, reason, status, reminder_type, title)
  on public.reminders to authenticated;
grant update (remind_at, reason, title, status, completed_at) on public.reminders to authenticated;
grant all on public.reminders to service_role;

revoke all on function public.enqueue_due_reminders(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.enqueue_due_reminders(timestamptz, integer) to service_role;
revoke all on function public.claim_notification_email_deliveries(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_notification_email_deliveries(timestamptz, integer) to service_role;
revoke all on function public.finish_notification_email_delivery(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finish_notification_email_delivery(uuid, text, text, text) to service_role;
revoke all on function public.claim_due_price_watch_checks(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_due_price_watch_checks(timestamptz, integer) to service_role;
revoke all on function public.record_verified_price_watch_observation(uuid, uuid, numeric, numeric, text, text, text, text, text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.record_verified_price_watch_observation(uuid, uuid, numeric, numeric, text, text, text, text, text, text, text, numeric, text) to service_role;
revoke all on function public.fail_price_watch_check(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fail_price_watch_check(uuid, uuid, text) to service_role;
revoke all on function public.record_manual_price_watch_observation(uuid, numeric) from public, anon;
grant execute on function public.record_manual_price_watch_observation(uuid, numeric) to authenticated;
revoke all on function public.create_coverage_expiry_reminders(uuid, text, date, text, text, text) from public, anon;
grant execute on function public.create_coverage_expiry_reminders(uuid, text, date, text, text, text) to authenticated;
revoke all on function public.create_price_watch_with_initial_observation(uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.create_price_watch_with_initial_observation(uuid, text, numeric, numeric, text) to authenticated;
revoke all on function public.consume_price_discovery_quota(text) from public, anon;
grant execute on function public.consume_price_discovery_quota(text) to authenticated;

comment on table public.notifications is 'Durable user-owned in-app notification inbox; event_key makes worker retries idempotent.';
comment on table public.notification_deliveries is 'Private Postmark delivery outbox; ambiguous sends are held as unknown to avoid duplicate email.';
comment on table public.price_watch_checks is 'Daily idempotent check jobs and leases for automated retailer price observations.';
