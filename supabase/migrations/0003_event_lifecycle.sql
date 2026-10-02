begin;

-- Internal, deterministic evaluator. Terminal states never resurrect; no stale
-- transition, confidence scoring, or TTL extension is introduced.
create function public.road_event_lifecycle_status(
  p_status text, p_expires_at timestamptz, p_confirmation_count integer,
  p_gone_count integer, p_now timestamptz
) returns text language sql immutable strict security invoker set search_path = ''
as $$
  select case
    when p_status in ('removed','expired') then p_status
    when p_expires_at <= p_now then 'expired'
    when p_status = 'active' and p_gone_count >= 3
      and p_gone_count > p_confirmation_count then 'removed'
    else p_status
  end;
$$;
revoke all on function public.road_event_lifecycle_status(text,timestamptz,integer,integer,timestamptz)
from public, anon, authenticated;

-- Existing BEFORE trigger locks/checks the event, identity, ban, and eligibility.
-- Preserve its protections and the RPC/direct-write contracts from 0002.
create or replace function public.apply_event_vote_counters()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
  confirm_delta integer := 0;
  gone_delta integer := 0;
  newly_confirmed boolean := false;
begin
  if tg_op = 'UPDATE' and new.vote_type = old.vote_type then return null; end if;
  if tg_op in ('UPDATE','DELETE') then
    target_id := old.event_id;
    confirm_delta := confirm_delta - case when old.vote_type = 'confirm' then 1 else 0 end;
    gone_delta := gone_delta - case when old.vote_type = 'gone' then 1 else 0 end;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    target_id := new.event_id;
    confirm_delta := confirm_delta + case when new.vote_type = 'confirm' then 1 else 0 end;
    gone_delta := gone_delta + case when new.vote_type = 'gone' then 1 else 0 end;
    newly_confirmed := new.vote_type = 'confirm';
  end if;
  -- Evaluate the POST-vote totals in this same locked row update. Existing
  -- nonnegative constraints still reject inconsistent counters transactionally.
  update public.road_events set
    status = public.road_event_lifecycle_status(status, expires_at,
      confirmation_count + confirm_delta, gone_count + gone_delta, clock_timestamp()),
    confirmation_count = confirmation_count + confirm_delta,
    gone_count = gone_count + gone_delta,
    last_confirmed_at = case when newly_confirmed then now() else last_confirmed_at end
  where id = target_id;
  return null;
end;
$$;
revoke all on function public.apply_event_vote_counters() from public, anon, authenticated;

-- Owner-only scheduled work. Bounded batches avoid long-running transactions;
-- locked rows are retried on the next run, not allowed to block all expiration.
create function public.sweep_road_event_lifecycle()
returns integer language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  with due as (
    select id from public.road_events
    where status in ('active','stale') and (
      expires_at <= statement_timestamp()
      or (status = 'active' and gone_count >= 3 and gone_count > confirmation_count)
    )
    order by expires_at, id
    limit 500 for update skip locked
  )
  update public.road_events e set status = public.road_event_lifecycle_status(
    e.status, e.expires_at, e.confirmation_count, e.gone_count, clock_timestamp())
  from due where e.id = due.id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.sweep_road_event_lifecycle() from public, anon, authenticated;

-- Read-time filtering is not a status mutation. Server time prevents a skewed
-- device clock or delayed Cron run from exposing an already expired event.
alter policy "Authenticated users can read active events" on public.road_events
using (status = 'active' and expires_at > statement_timestamp());

-- Defense in depth for server-owned fields; no change to report INSERT grants.
revoke update (status, expires_at, confidence, confirmation_count, gone_count, last_confirmed_at)
on public.road_events from public, anon, authenticated;

commit;
