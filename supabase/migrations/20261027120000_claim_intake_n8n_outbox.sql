begin;

alter table public.workflow_events
  add column if not exists dispatch_status text not null default 'not_applicable'
    check (dispatch_status in ('not_applicable', 'pending', 'dispatching', 'dispatched', 'failed')),
  add column if not exists dispatch_attempt_count integer not null default 0
    check (dispatch_attempt_count between 0 and 5),
  add column if not exists dispatch_available_at timestamptz not null default now(),
  add column if not exists dispatch_lease_expires_at timestamptz,
  add column if not exists dispatched_at timestamptz,
  add column if not exists safe_dispatch_error_code text
    check (safe_dispatch_error_code is null or safe_dispatch_error_code in ('n8n_unavailable', 'n8n_rejected', 'invalid_response', 'dispatch_limit_reached'));

alter table public.workflow_events
  add column if not exists processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'completed', 'failed')),
  add column if not exists processing_attempt_count integer not null default 0
    check (processing_attempt_count between 0 and 5),
  add column if not exists processing_lease_expires_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists safe_processing_error_code text
    check (safe_processing_error_code is null or safe_processing_error_code in ('claim_unavailable', 'document_unreadable', 'model_unavailable', 'invalid_result', 'processing_limit_reached'));

create index if not exists workflow_events_dispatch_due_idx
  on public.workflow_events (dispatch_available_at, created_at)
  where event_type = 'claim.intake.received' and dispatch_status in ('pending', 'dispatching');

create or replace function public.create_claim_intake_with_event(
  p_idempotency_key text,
  p_product_name text,
  p_fault_description text,
  p_failure_date date,
  p_documents jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intake jsonb;
  v_claim_id uuid;
  v_product_id uuid;
  v_duplicate boolean;
  v_event_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_intake := public.create_claim_intake(
    p_idempotency_key,
    p_product_name,
    p_fault_description,
    p_failure_date,
    p_documents
  );
  v_claim_id := (v_intake ->> 'claim_id')::uuid;
  v_product_id := (v_intake ->> 'product_id')::uuid;
  v_duplicate := coalesce((v_intake ->> 'duplicate')::boolean, false);

  if not v_duplicate then
    v_event_id := p_idempotency_key;
    insert into public.workflow_events (
      user_id, claim_id, event_id, event_type, status, safe_metadata, dispatch_status
    ) values (
      auth.uid(), v_claim_id, v_event_id, 'claim.intake.received', 'queued',
      jsonb_build_object('product_id', v_product_id), 'pending'
    );
  else
    select e.event_id into v_event_id
    from public.workflow_events as e
    where e.claim_id = v_claim_id
      and e.user_id = auth.uid()
      and e.event_type = 'claim.intake.received'
    order by e.created_at
    limit 1;
  end if;

  return jsonb_build_object(
    'claim_id', v_claim_id,
    'product_id', v_product_id,
    'event_id', v_event_id,
    'duplicate', v_duplicate
  );
end;
$$;

revoke all on function public.create_claim_intake_with_event(text, text, text, date, jsonb) from public, anon;
grant execute on function public.create_claim_intake_with_event(text, text, text, date, jsonb) to authenticated;

create or replace function public.lease_claim_intake_event(p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.workflow_events%rowtype;
begin
  select e.* into v_event
  from public.workflow_events as e
  where e.event_id = p_event_id
    and e.event_type = 'claim.intake.received'
    and e.dispatch_attempt_count < 5
    and e.dispatch_available_at <= now()
    and (
      e.dispatch_status = 'pending'
      or (e.dispatch_status = 'dispatching' and e.dispatch_lease_expires_at <= now())
    )
  for update skip locked;

  if not found then
    return jsonb_build_object('leased', false);
  end if;

  update public.workflow_events
  set dispatch_status = 'dispatching',
      dispatch_attempt_count = dispatch_attempt_count + 1,
      dispatch_lease_expires_at = now() + interval '30 seconds',
      safe_dispatch_error_code = null
  where id = v_event.id;

  return jsonb_build_object(
    'leased', true,
    'event_id', v_event.event_id,
    'claim_id', v_event.claim_id,
    'product_id', v_event.safe_metadata ->> 'product_id'
  );
end;
$$;

revoke all on function public.lease_claim_intake_event(text) from public, anon, authenticated;
grant execute on function public.lease_claim_intake_event(text) to service_role;

create or replace function public.finish_claim_intake_event_dispatch(
  p_event_id text,
  p_succeeded boolean,
  p_safe_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.workflow_events%rowtype;
begin
  if p_event_id is null or length(p_event_id) not between 1 and 180
    or p_succeeded is null
    or (not p_succeeded and (p_safe_error_code is null or p_safe_error_code not in ('n8n_unavailable', 'n8n_rejected', 'invalid_response'))) then
    raise exception 'Invalid claim dispatch result';
  end if;

  update public.workflow_events as e
  set dispatch_status = case
        when p_succeeded then 'dispatched'
        when e.dispatch_attempt_count >= 5 then 'failed'
        else 'pending'
      end,
      dispatch_available_at = case
        when p_succeeded then e.dispatch_available_at
        else now() + make_interval(mins => least(e.dispatch_attempt_count, 5))
      end,
      dispatch_lease_expires_at = null,
      dispatched_at = case when p_succeeded then now() else e.dispatched_at end,
      safe_dispatch_error_code = case
        when p_succeeded then null
        when e.dispatch_attempt_count >= 5 then 'dispatch_limit_reached'
        else p_safe_error_code
      end
  where e.event_id = p_event_id
    and e.event_type = 'claim.intake.received'
    and e.dispatch_status = 'dispatching'
  returning e.* into v_event;

  if not found then
    return jsonb_build_object('updated', false);
  end if;

  return jsonb_build_object('updated', true, 'dispatch_status', v_event.dispatch_status);
end;
$$;

revoke all on function public.finish_claim_intake_event_dispatch(text, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_claim_intake_event_dispatch(text, boolean, text) to service_role;

create or replace function public.lease_claim_intake_processing(p_event_id text, p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.workflow_events%rowtype;
  v_claim_status text;
begin
  select e.* into v_event
  from public.workflow_events e
  where e.event_id = p_event_id
    and e.claim_id = p_claim_id
    and e.event_type = 'claim.intake.received'
  for update skip locked;

  if not found then
    return jsonb_build_object('leased', false, 'reason', 'event_unavailable');
  end if;

  select c.status into v_claim_status
  from public.claims c
  where c.id = p_claim_id;

  if v_claim_status is null then
    return jsonb_build_object('leased', false, 'reason', 'claim_unavailable');
  end if;

  if v_event.processing_status = 'completed' then
    return jsonb_build_object('leased', false, 'duplicate', true, 'status', v_claim_status);
  end if;

  if v_event.processing_status = 'processing' and v_event.processing_lease_expires_at > now() then
    return jsonb_build_object('leased', false, 'duplicate', true, 'status', 'processing');
  end if;

  if v_event.processing_attempt_count >= 5 then
    update public.workflow_events
      set processing_status = 'failed',
          safe_processing_error_code = 'processing_limit_reached',
          processing_lease_expires_at = null
    where id = v_event.id;
    update public.claims
      set status = 'needs_human_help', updated_at = now()
    where id = p_claim_id and status = 'processing';
    return jsonb_build_object('leased', false, 'status', 'failed');
  end if;

  update public.workflow_events
    set processing_status = 'processing',
        processing_attempt_count = processing_attempt_count + 1,
        processing_lease_expires_at = now() + interval '3 minutes',
        safe_processing_error_code = null,
        status = 'processing'
  where id = v_event.id;

  update public.claims
    set status = 'processing', updated_at = now()
  where id = p_claim_id and status in ('received', 'processing', 'needs_information', 'needs_human_help');

  return jsonb_build_object('leased', true, 'duplicate', false, 'status', 'processing');
end;
$$;

revoke all on function public.lease_claim_intake_processing(text, uuid) from public, anon, authenticated;
grant execute on function public.lease_claim_intake_processing(text, uuid) to service_role;

create or replace function public.finish_claim_intake_processing(
  p_event_id text,
  p_succeeded boolean,
  p_safe_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.workflow_events%rowtype;
begin
  if p_event_id is null or length(p_event_id) not between 1 and 180
    or p_succeeded is null
    or (not p_succeeded and (p_safe_error_code is null or p_safe_error_code not in ('claim_unavailable', 'document_unreadable', 'model_unavailable', 'invalid_result'))) then
    raise exception 'Invalid claim processing state';
  end if;

  update public.workflow_events e
    set processing_status = case
          when p_succeeded then 'completed'
          when e.processing_attempt_count >= 5 then 'failed'
          else 'pending'
        end,
        processing_lease_expires_at = null,
        processed_at = case when p_succeeded then now() else e.processed_at end,
        safe_processing_error_code = case
          when p_succeeded then null
          when e.processing_attempt_count >= 5 then 'processing_limit_reached'
          else p_safe_error_code
        end,
        status = case when p_succeeded then 'completed' else 'processing_failed' end
    where e.event_id = p_event_id
      and e.event_type = 'claim.intake.received'
      and e.processing_status = 'processing'
  returning e.* into v_event;

  if not found then
    return jsonb_build_object('updated', false);
  end if;

  if v_event.processing_status = 'failed' then
    update public.claims
      set status = 'needs_human_help', updated_at = now()
    where id = v_event.claim_id and status = 'processing';
  end if;

  return jsonb_build_object('updated', true, 'processing_status', v_event.processing_status);
end;
$$;

revoke all on function public.finish_claim_intake_processing(text, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_claim_intake_processing(text, boolean, text) to service_role;

commit;
