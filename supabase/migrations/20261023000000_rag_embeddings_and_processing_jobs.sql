begin;

-- The vector extension is required for the embedding column. No vector index
-- is created here; target-environment index support has not been verified.
create extension if not exists vector with schema extensions;

alter table public.document_chunks
  add column embedding extensions.vector(384),
  add column embedding_provider text,
  add column embedding_model_alias text,
  add column embedding_model_repository text,
  add column embedding_model_revision text,
  add column embedding_dimension smallint,
  add column embedding_pooling text,
  add column embedding_normalized boolean,
  add constraint document_chunks_embedding_dimension_check
    check (embedding_dimension is null or embedding_dimension = 384),
  add constraint document_chunks_embedding_metadata_check
    check (
      embedding is null
      or (
        embedding_provider = 'supabase_edge_runtime'
        and embedding_model_alias = 'gte-small'
        and embedding_model_repository = 'Supabase/gte-small'
        and embedding_dimension = 384
      )
    );

create table public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null,
  target_index_version integer not null check (target_index_version > 0),
  idempotency_key uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'retry_wait', 'succeeded', 'needs_review', 'failed', 'cancelled')),
  dispatch_status text not null default 'pending'
    check (dispatch_status in ('pending', 'dispatching', 'dispatched')),
  dispatch_attempt_count integer not null default 0 check (dispatch_attempt_count >= 0),
  dispatch_lease_expires_at timestamptz,
  dispatched_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  safe_error_code text check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{1,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  foreign key (document_id, user_id)
    references public.product_documents (id, user_id) on delete cascade,
  unique (user_id, idempotency_key),
  check (attempt_count <= max_attempts)
);

alter table public.document_processing_jobs enable row level security;

create policy document_processing_jobs_owner_select
  on public.document_processing_jobs
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.document_processing_jobs from public, anon, authenticated;
grant select on table public.document_processing_jobs to authenticated;

-- Only the server-side Next.js integration may create jobs or advance their
-- processing/dispatch state. service_role bypasses RLS, so keep it server-only
-- and restrict its table privileges to required columns.
grant select on table public.document_processing_jobs to service_role;
grant insert (user_id, document_id, target_index_version, idempotency_key)
  on table public.document_processing_jobs to service_role;
grant update (
  status, dispatch_status, dispatch_attempt_count, dispatch_lease_expires_at,
  dispatched_at, attempt_count, max_attempts, available_at, lease_expires_at,
  safe_error_code, updated_at, started_at, completed_at
) on table public.document_processing_jobs to service_role;

create index document_processing_jobs_owner_status_updated_idx
  on public.document_processing_jobs (user_id, status, updated_at desc);

create index document_processing_jobs_dispatch_idx
  on public.document_processing_jobs (status, available_at)
  where status in ('queued', 'retry_wait');

create index document_processing_jobs_outbox_idx
  on public.document_processing_jobs (dispatch_status, created_at)
  where dispatch_status in ('pending', 'dispatching');

create unique index document_processing_jobs_active_document_version_uidx
  on public.document_processing_jobs (document_id, target_index_version)
  where status in ('queued', 'processing', 'retry_wait');

commit;
