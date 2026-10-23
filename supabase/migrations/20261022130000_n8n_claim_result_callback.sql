begin;

create or replace function public.apply_claim_processing_result(
  p_claim_id uuid,
  p_event_id text,
  p_status text,
  p_assessment text,
  p_claim_draft text,
  p_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims%rowtype;
  v_event_id text := p_event_id;
  v_evidence record;
  v_evidence_count integer := 0;
begin
  if p_claim_id is null
    or p_event_id is null
    or length(p_event_id) not between 1 and 180
    or p_status is null
    or p_status not in ('processing', 'needs_information', 'ready_for_review', 'needs_human_help')
    or p_assessment is null
    or p_assessment not in ('likely within stated term', 'unclear', 'appears outside stated term')
    or (p_claim_draft is not null and length(p_claim_draft) > 10000)
    or (p_status = 'ready_for_review' and (p_claim_draft is null or length(trim(p_claim_draft)) = 0))
    or jsonb_typeof(coalesce(p_evidence, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) > 12 then
    raise exception 'Invalid claim processing result';
  end if;

  select c.* into v_claim
  from public.claims c
  where c.id = p_claim_id
  for update;

  if not found then
    raise exception 'Claim not found';
  end if;

  if v_claim.status not in ('received', 'processing', 'needs_information', 'needs_human_help') then
    return jsonb_build_object('conflict', true, 'duplicate', false, 'status', v_claim.status);
  end if;

  insert into public.workflow_events (user_id, claim_id, event_id, event_type, status, safe_metadata)
  values (
    v_claim.user_id,
    v_claim.id,
    v_event_id,
    'claim.processing.result',
    p_status,
    jsonb_build_object('assessment', p_assessment, 'evidence_count', jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)))
  )
  on conflict (event_id) do nothing;

  if not found then
    return jsonb_build_object('conflict', false, 'duplicate', true, 'status', v_claim.status);
  end if;

  for v_evidence in
    select * from jsonb_to_recordset(coalesce(p_evidence, '[]'::jsonb)) as e(
      kind text,
      content text,
      source_page integer,
      confidence numeric,
      document_id uuid
    )
  loop
    if v_evidence.kind is null
      or v_evidence.kind not in ('fact', 'warranty_clause', 'missing_item', 'inference')
      or v_evidence.content is null
      or length(trim(v_evidence.content)) not between 1 and 4000
      or (v_evidence.source_page is not null and v_evidence.source_page not between 1 and 100000)
      or (v_evidence.confidence is not null and v_evidence.confidence not between 0 and 1)
      or (v_evidence.document_id is not null and not exists (
        select 1 from public.product_documents d
        where d.id = v_evidence.document_id
          and d.user_id = v_claim.user_id
          and d.product_id = v_claim.product_id
      )) then
      raise exception 'Invalid claim evidence';
    end if;

    insert into public.claim_evidence (user_id, claim_id, document_id, evidence_kind, content, source_page, confidence)
    values (v_claim.user_id, v_claim.id, v_evidence.document_id, v_evidence.kind, trim(v_evidence.content), v_evidence.source_page, v_evidence.confidence);
    v_evidence_count := v_evidence_count + 1;
  end loop;

  update public.claims
  set status = p_status,
      assessment = p_assessment,
      claim_draft = p_claim_draft,
      updated_at = now()
  where id = v_claim.id;

  return jsonb_build_object('conflict', false, 'duplicate', false, 'status', p_status, 'evidence_count', v_evidence_count);
end;
$$;

revoke all on function public.apply_claim_processing_result(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_claim_processing_result(uuid, text, text, text, text, jsonb) to service_role;

commit;
