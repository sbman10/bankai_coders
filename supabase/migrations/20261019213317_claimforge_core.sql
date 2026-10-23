create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  brand text,
  model text,
  category text,
  seller text,
  purchase_date date,
  warranty_end date,
  serial_number text,
  replenishment_days integer check (replenishment_days is null or replenishment_days between 1 and 3650),
  replenishment_remind_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.product_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null,
  document_kind text not null check (document_kind in ('invoice', 'warranty', 'manual', 'other')),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  foreign key (product_id, user_id) references public.products (id, user_id) on delete cascade,
  unique (id, user_id)
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null,
  page_number integer check (page_number is null or page_number > 0),
  content text not null check (length(trim(content)) between 1 and 12000),
  search_vector tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  foreign key (document_id, user_id) references public.product_documents (id, user_id) on delete cascade,
  unique (id, user_id)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null,
  idempotency_key text not null check (idempotency_key ~ '^[0-9a-f-]{36}$'),
  fault_description text not null check (length(trim(fault_description)) between 1 and 4000),
  failure_date date,
  status text not null default 'received' check (status in ('received', 'processing', 'needs_information', 'ready_for_review', 'approved', 'action_failed', 'resolved', 'rejected', 'needs_human_help')),
  assessment text check (assessment is null or assessment in ('likely within stated term', 'unclear', 'appears outside stated term')),
  claim_draft text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, user_id) references public.products (id, user_id) on delete cascade,
  unique (id, user_id),
  unique (user_id, idempotency_key)
);

create table public.claim_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_id uuid not null,
  document_id uuid,
  evidence_kind text not null check (evidence_kind in ('fact', 'warranty_clause', 'missing_item', 'inference')),
  content text not null check (length(content) <= 4000),
  source_page integer check (source_page is null or source_page > 0),
  confidence numeric(4, 3) check (confidence is null or confidence between 0 and 1),
  created_at timestamptz not null default now(),
  foreign key (claim_id, user_id) references public.claims (id, user_id) on delete cascade,
  foreign key (document_id, user_id) references public.product_documents (id, user_id) on delete cascade
);

create table public.claim_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_id uuid not null,
  approved_content text not null check (length(trim(approved_content)) between 1 and 10000),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  idempotency_key text not null unique,
  approved_at timestamptz not null default now(),
  action_status text not null default 'draft_only' check (action_status in ('draft_only', 'queued', 'sent', 'failed')),
  foreign key (claim_id, user_id) references public.claims (id, user_id) on delete cascade,
  unique (claim_id, user_id, content_sha256)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid,
  claim_id uuid,
  remind_at timestamptz not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'email')),
  reason text not null check (length(trim(reason)) between 1 and 500),
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  foreign key (product_id, user_id) references public.products (id, user_id) on delete cascade,
  foreign key (claim_id, user_id) references public.claims (id, user_id) on delete cascade,
  check ((product_id is not null)::integer + (claim_id is not null)::integer = 1)
);

create table public.price_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid,
  product_url text,
  current_price numeric(12, 2) check (current_price is null or current_price >= 0),
  target_price numeric(12, 2) check (target_price is null or target_price >= 0),
  currency char(3) not null default 'INR',
  checking_mode text not null default 'manual' check (checking_mode in ('manual', 'automated')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (product_id, user_id) references public.products (id, user_id) on delete cascade,
  check (product_url is null or length(product_url) <= 2048),
  check (checking_mode <> 'automated' or product_url is not null)
);

create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_id uuid not null,
  event_id text not null,
  event_type text not null,
  status text not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (claim_id, user_id) references public.claims (id, user_id) on delete cascade,
  unique (event_id)
);

create index products_user_id_idx on public.products (user_id);
create index document_chunks_search_idx on public.document_chunks using gin (search_vector);
create index document_chunks_document_id_idx on public.document_chunks (document_id, user_id);
create index claims_user_id_created_at_idx on public.claims (user_id, created_at desc);
create index reminders_user_id_remind_at_idx on public.reminders (user_id, remind_at) where status = 'scheduled';
create index price_watches_user_id_idx on public.price_watches (user_id);
create index workflow_events_claim_id_created_at_idx on public.workflow_events (claim_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.claims enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.claim_approvals enable row level security;
alter table public.reminders enable row level security;
alter table public.price_watches enable row level security;
alter table public.workflow_events enable row level security;

create policy "profiles_owner_access" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "products_owner_access" on public.products for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "product_documents_owner_access" on public.product_documents for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "document_chunks_owner_read" on public.document_chunks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "document_chunks_owner_insert" on public.document_chunks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "claims_owner_access" on public.claims for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "claim_evidence_owner_access" on public.claim_evidence for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "claim_approvals_owner_select" on public.claim_approvals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "claim_approvals_owner_insert" on public.claim_approvals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "reminders_owner_access" on public.reminders for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "price_watches_owner_access" on public.price_watches for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workflow_events_owner_select" on public.workflow_events for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.search_document_chunks(query_text text, result_limit integer default 5)
returns table (chunk_id uuid, document_id uuid, page_number integer, content text, relevance real)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.document_id, c.page_number, c.content,
    ts_rank(c.search_vector, websearch_to_tsquery('english', query_text)) as relevance
  from public.document_chunks as c
  where c.user_id = (select auth.uid())
    and c.search_vector @@ websearch_to_tsquery('english', query_text)
  order by relevance desc
  limit least(greatest(result_limit, 1), 10);
$$;
revoke execute on function public.search_document_chunks(text, integer) from public, anon;
grant execute on function public.search_document_chunks(text, integer) to authenticated;

create function public.create_claim_intake(
  p_idempotency_key text,
  p_product_name text,
  p_fault_description text,
  p_failure_date date,
  p_documents jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_claim_id uuid;
  v_product_id uuid;
  v_duplicate boolean := false;
  v_document record;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select c.id, c.product_id into v_claim_id, v_product_id
  from public.claims as c
  where c.user_id = v_user_id and c.idempotency_key = p_idempotency_key;

  if v_claim_id is not null then
    v_duplicate := true;
  else
    insert into public.products (user_id, name)
    values (v_user_id, trim(p_product_name))
    returning id into v_product_id;

    for v_document in
      select * from jsonb_to_recordset(coalesce(p_documents, '[]'::jsonb)) as d(
        document_kind text,
        storage_path text,
        original_filename text,
        mime_type text,
        size_bytes bigint
      )
    loop
      if split_part(v_document.storage_path, '/', 1) <> v_user_id::text then
        raise exception 'Document path must belong to the signed-in user';
      end if;

      insert into public.product_documents (
        user_id, product_id, document_kind, storage_path, original_filename, mime_type, size_bytes
      ) values (
        v_user_id, v_product_id, v_document.document_kind, v_document.storage_path,
        v_document.original_filename, v_document.mime_type, v_document.size_bytes
      );
    end loop;

    insert into public.claims (user_id, product_id, idempotency_key, fault_description, failure_date)
    values (v_user_id, v_product_id, p_idempotency_key, trim(p_fault_description), p_failure_date)
    returning id into v_claim_id;
  end if;

  return jsonb_build_object(
    'claim_id', v_claim_id,
    'product_id', v_product_id,
    'duplicate', v_duplicate
  );
end;
$$;

revoke execute on function public.create_claim_intake(text, text, text, date, jsonb) from public, anon;
grant execute on function public.create_claim_intake(text, text, text, date, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claim-documents', 'claim-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "claim_documents_owner_read" on storage.objects for select to authenticated
  using (bucket_id = 'claim-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "claim_documents_owner_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'claim-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "claim_documents_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'claim-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
