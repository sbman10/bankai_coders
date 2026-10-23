begin;

drop policy if exists claims_owner_access on public.claims;

create policy claims_owner_select on public.claims
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy claims_owner_insert_received on public.claims
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'received'
    and assessment is null
    and claim_draft is null
  );

revoke update, delete on table public.claims from public, anon, authenticated;

create or replace function public.create_claim_intake(
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
  v_new_product_id uuid;
  v_duplicate boolean := false;
  v_document record;
  v_seen_kinds text[] := array[]::text[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is null
    or p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_product_name is null or length(trim(p_product_name)) not between 1 and 160
    or p_fault_description is null or length(trim(p_fault_description)) not between 1 and 4000 then
    raise exception 'Invalid claim intake fields';
  end if;

  if jsonb_typeof(coalesce(p_documents, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid claim documents';
  end if;
  if jsonb_array_length(coalesce(p_documents, '[]'::jsonb)) > 2 then
    raise exception 'Invalid claim documents';
  end if;

  select c.id, c.product_id into v_claim_id, v_product_id
  from public.claims as c
  where c.user_id = v_user_id and c.idempotency_key = p_idempotency_key;

  if v_claim_id is not null then
    v_duplicate := true;
  else
    insert into public.products (user_id, name)
    values (v_user_id, trim(p_product_name))
    returning id into v_new_product_id;
    v_product_id := v_new_product_id;

    insert into public.claims (user_id, product_id, idempotency_key, fault_description, failure_date)
    values (v_user_id, v_new_product_id, p_idempotency_key, trim(p_fault_description), p_failure_date)
    on conflict (user_id, idempotency_key) do nothing
    returning id into v_claim_id;

    if v_claim_id is null then
      select c.id, c.product_id into v_claim_id, v_product_id
      from public.claims as c
      where c.user_id = v_user_id and c.idempotency_key = p_idempotency_key;

      delete from public.products as p
      where p.id = v_new_product_id and p.user_id = v_user_id;

      v_duplicate := true;
    else
      for v_document in
        select * from jsonb_to_recordset(coalesce(p_documents, '[]'::jsonb)) as d(
          document_kind text,
          storage_path text,
          original_filename text,
          mime_type text,
          size_bytes bigint
        )
      loop
        if v_document.document_kind is null
          or v_document.document_kind not in ('invoice', 'warranty')
          or v_document.document_kind = any(v_seen_kinds)
          or v_document.storage_path is null
          or length(v_document.storage_path) > 512
          or split_part(v_document.storage_path, '/', 1) <> v_user_id::text
          or v_document.storage_path !~ ('^' || v_user_id::text || '/[0-9a-f-]{36}-[A-Za-z0-9][A-Za-z0-9._-]{0,139}$')
          or v_document.storage_path ~ '(^|/)\.\.?(/|$)'
          or position('//' in v_document.storage_path) > 0
          or v_document.original_filename is null
          or length(v_document.original_filename) not between 1 and 240
          or v_document.original_filename ~ '[[:cntrl:]]'
          or v_document.mime_type is null
          or v_document.mime_type not in ('application/pdf', 'image/jpeg', 'image/png')
          or v_document.size_bytes is null
          or v_document.size_bytes not between 1 and 10485760 then
          raise exception 'Invalid claim document metadata';
        end if;

        v_seen_kinds := array_append(v_seen_kinds, v_document.document_kind);
        insert into public.product_documents (
          user_id, product_id, document_kind, storage_path, original_filename, mime_type, size_bytes
        ) values (
          v_user_id, v_product_id, v_document.document_kind, v_document.storage_path,
          v_document.original_filename, v_document.mime_type, v_document.size_bytes
        );
      end loop;
    end if;
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

commit;
