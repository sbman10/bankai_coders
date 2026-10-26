begin;

-- Uses the existing vector(384) column from the RAG embeddings draft.
-- Supabase's vector-index guide pairs <=> with vector_cosine_ops for HNSW.
-- Verify the target vector extension version supports indexed 384-dimension vectors before applying.
create index if not exists document_chunks_embedding_cosine_hnsw_idx
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.search_selected_document_chunks_by_embedding(
  p_query_embedding extensions.vector(384),
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
  extraction_confidence numeric,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    d.id,
    d.original_filename,
    c.page_number,
    c.section_path,
    left(c.content, 1200),
    c.extraction_confidence,
    1 - (c.embedding operator(extensions.<=>) p_query_embedding)::double precision
  from public.document_chunks as c
  join public.product_documents as d
    on d.id = c.document_id
    and d.user_id = c.user_id
  where c.user_id = (select auth.uid())
    and d.user_id = (select auth.uid())
    and d.product_id = p_product_id
    and d.ingestion_status = 'indexed'
    and c.index_version = d.index_version
    and c.document_id = any(coalesce(p_document_ids, array[]::uuid[]))
    and c.embedding is not null
    and c.embedding_provider = 'supabase_edge_runtime'
    and c.embedding_model_alias = 'gte-small'
    and c.embedding_model_repository = 'Supabase/gte-small'
    and c.embedding_model_revision is null
    and c.embedding_dimension = 384
    and c.embedding_pooling = 'mean'
    and c.embedding_normalized is true
  order by
    c.embedding operator(extensions.<=>) p_query_embedding asc,
    c.document_id,
    c.page_number nulls last,
    c.chunk_index nulls last
  limit least(greatest(coalesce(p_result_limit, 8), 1), 8);
$$;

revoke all on function public.search_selected_document_chunks_by_embedding(
  extensions.vector(384), uuid, uuid[], integer
) from public, anon, service_role;
grant execute on function public.search_selected_document_chunks_by_embedding(
  extensions.vector(384), uuid, uuid[], integer
) to authenticated;

commit;
