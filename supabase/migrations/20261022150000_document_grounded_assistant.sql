begin;

alter table public.product_documents
  add column if not exists ingestion_status text not null default 'uploaded'
    check (ingestion_status in ('uploaded', 'extracting', 'indexed', 'needs_review', 'failed')),
  add column if not exists ingestion_warning_code text,
  add column if not exists indexed_at timestamptz,
  add column if not exists index_version integer not null default 0
    check (index_version >= 0);

alter table public.document_chunks
  add column if not exists section_path text,
  add column if not exists chunk_index integer,
  add column if not exists extraction_confidence numeric(4, 3)
    check (extraction_confidence is null or extraction_confidence between 0 and 1),
  add column if not exists content_hash text,
  add column if not exists index_version integer not null default 0
    check (index_version >= 0);

create index if not exists product_documents_ingestion_idx
  on public.product_documents (user_id, product_id, ingestion_status);

create index if not exists document_chunks_selected_search_idx
  on public.document_chunks (document_id, user_id, index_version);

create unique index if not exists document_chunks_version_position_uidx
  on public.document_chunks (document_id, index_version, chunk_index)
  where chunk_index is not null;

drop policy if exists "document_chunks_owner_insert" on public.document_chunks;
drop policy if exists document_chunks_owner_delete on public.document_chunks;
revoke insert, update, delete on table public.document_chunks from public, anon, authenticated;
grant select on table public.document_chunks to authenticated;

-- Only trusted server routes may publish extraction state or indexed chunks.
drop policy if exists "product_documents_owner_access" on public.product_documents;
create policy product_documents_owner_select on public.product_documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy product_documents_owner_insert on public.product_documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy product_documents_owner_delete on public.product_documents
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke insert, update on table public.product_documents from public, anon, authenticated;
grant select, delete on table public.product_documents to authenticated;
grant insert (user_id, product_id, document_kind, storage_path, original_filename, mime_type, size_bytes)
  on table public.product_documents to authenticated;

create or replace function public.search_selected_document_chunks(
  p_query_text text,
  p_product_id uuid,
  p_document_ids uuid[],
  p_result_limit integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  page_number integer,
  section_path text,
  content text,
  extraction_confidence numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id,
    d.id,
    d.original_filename,
    c.page_number,
    c.section_path,
    c.content,
    c.extraction_confidence
  from public.document_chunks as c
  join public.product_documents as d
    on d.id = c.document_id and d.user_id = c.user_id
  where c.user_id = (select auth.uid())
    and d.user_id = (select auth.uid())
    and d.product_id = p_product_id
    and d.ingestion_status = 'indexed'
    and c.index_version = d.index_version
    and c.document_id = any(coalesce(p_document_ids, array[]::uuid[]))
    and c.search_vector @@ websearch_to_tsquery('english', left(trim(p_query_text), 2000))
  order by ts_rank(c.search_vector, websearch_to_tsquery('english', left(trim(p_query_text), 2000))) desc,
    c.document_id,
    c.page_number nulls last,
    c.chunk_index nulls last
  limit least(greatest(coalesce(p_result_limit, 8), 1), 8);
$$;

revoke all on function public.search_selected_document_chunks(text, uuid, uuid[], integer) from public, anon;
grant execute on function public.search_selected_document_chunks(text, uuid, uuid[], integer) to authenticated;

commit;
