begin;

-- A signed-in customer may record the exact version they approved, but only as
-- a draft-only decision. Server-side workflow credentials own later outcomes.
revoke all on table public.claim_approvals from public, anon, authenticated;
grant select, insert on table public.claim_approvals to authenticated;

drop policy if exists "claim_approvals_owner_insert" on public.claim_approvals;

create policy "claim_approvals_owner_insert_draft_only"
  on public.claim_approvals
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and action_status = 'draft_only'
    and exists (
      select 1
      from public.claims as c
      where c.id = claim_id
        and c.user_id = (select auth.uid())
        and c.status = 'ready_for_review'
        and c.claim_draft is not null
    )
  );

commit;
