begin;

-- Prevent writes during the preflight/trigger installation. Never silently repair
-- legacy counters or remove historical votes: the operator must review them.
lock table public.event_votes, public.road_events in share row exclusive mode;
do $$
begin
  if exists (
    select 1 from public.road_events e
    left join (
      select event_id,
        count(*) filter (where vote_type = 'confirm') as confirmations,
        count(*) filter (where vote_type = 'gone') as gone
      from public.event_votes group by event_id
    ) v on v.event_id = e.id
    where e.confirmation_count <> coalesce(v.confirmations, 0)
       or e.gone_count <> coalesce(v.gone, 0)
  ) or exists (
    select 1 from public.event_votes v
    join public.road_events e on e.id = v.event_id
    where v.user_id = e.reporter_id
  ) then
    raise exception 'Community validation preflight failed: review legacy votes/counters before applying 0002';
  end if;
end;
$$;

-- This trigger needs privileged row locks, not caller UPDATE grants on events
-- or profiles. It still validates the request identity from auth.uid().
create function public.prepare_event_vote()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  voter uuid := auth.uid();
  banned boolean;
  target public.road_events%rowtype;
begin
  if voter is null or new.user_id is distinct from voter then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if new.vote_type is null or new.vote_type not in ('confirm', 'gone') then
    raise exception 'Invalid vote type' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.event_id is distinct from old.event_id
    or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Vote identity is immutable' using errcode = '42501';
  end if;

  -- Locks make concurrent bans/event changes and aggregate updates serialize.
  select p.is_banned into banned from public.profiles p where p.id = voter for share;
  if not found or banned then
    raise exception 'Voting unavailable for this account' using errcode = '42501';
  end if;
  select e.* into target from public.road_events e
    where e.id = new.event_id for no key update;
  if not found then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;
  if target.reporter_id = voter then
    raise exception 'Cannot vote on your own event' using errcode = '42501';
  end if;
  if target.status <> 'active' or target.expires_at <= clock_timestamp() then
    raise exception 'Event is no longer open for voting' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.vote_type = old.vote_type then
    return null; -- Direct same-vote UPDATE also changes no timestamps/counters.
  end if;
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  new.updated_at := now();
  return new;
end;
$$;

create function public.apply_event_vote_counters()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
  confirm_delta integer := 0;
  gone_delta integer := 0;
  newly_confirmed boolean := false;
begin
  if tg_op = 'UPDATE' and new.vote_type = old.vote_type then return null; end if;
  if tg_op in ('UPDATE', 'DELETE') then
    target_id := old.event_id;
    confirm_delta := confirm_delta - case when old.vote_type = 'confirm' then 1 else 0 end;
    gone_delta := gone_delta - case when old.vote_type = 'gone' then 1 else 0 end;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    target_id := new.event_id;
    confirm_delta := confirm_delta + case when new.vote_type = 'confirm' then 1 else 0 end;
    gone_delta := gone_delta + case when new.vote_type = 'gone' then 1 else 0 end;
    newly_confirmed := new.vote_type = 'confirm';
  end if;
  -- Atomic deltas plus the existing nonnegative CHECK constraints: inconsistent
  -- data rejects the transaction rather than allowing negative/fictional totals.
  -- DELETE is for administrator/FK cleanup only; clients have no DELETE grant.
  update public.road_events set
    confirmation_count = confirmation_count + confirm_delta,
    gone_count = gone_count + gone_delta,
    last_confirmed_at = case when newly_confirmed then now() else last_confirmed_at end
  where id = target_id;
  return null;
end;
$$;

revoke all on function public.prepare_event_vote() from public, anon, authenticated;
revoke all on function public.apply_event_vote_counters() from public, anon, authenticated;
create trigger prepare_event_vote_before_write
  before insert or update on public.event_votes
  for each row execute function public.prepare_event_vote();
create trigger apply_event_vote_counters_after_write
  after insert or update or delete on public.event_votes
  for each row execute function public.apply_event_vote_counters();

drop policy if exists "Non-banned users can create their own votes" on public.event_votes;
drop policy if exists "Non-banned users can update their own votes" on public.event_votes;
drop policy if exists "Non-banned users can delete their own votes" on public.event_votes;
-- Existing own-row SELECT policy remains unchanged, even after an event closes.
create policy "Eligible users can insert their own votes"
on public.event_votes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_banned)
  and exists (
    select 1 from public.road_events e where e.id = event_id
      and e.reporter_id <> auth.uid() and e.status = 'active' and e.expires_at > clock_timestamp()
  )
);
create policy "Eligible users can update their own votes"
on public.event_votes for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_banned)
  and exists (
    select 1 from public.road_events e where e.id = event_id
      and e.reporter_id <> auth.uid() and e.status = 'active' and e.expires_at > clock_timestamp()
  )
)
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_banned)
  and exists (
    select 1 from public.road_events e where e.id = event_id
      and e.reporter_id <> auth.uid() and e.status = 'active' and e.expires_at > clock_timestamp()
  )
);

revoke all on public.event_votes from public, anon, authenticated;
-- Table-level REVOKE does not remove existing column-level grants.
revoke insert (id, event_id, user_id, vote_type, created_at, updated_at),
       update (id, event_id, user_id, vote_type, created_at, updated_at)
on public.event_votes from public, anon, authenticated;
grant select on public.event_votes to authenticated;
grant insert (event_id, user_id, vote_type) on public.event_votes to authenticated;
grant update (vote_type) on public.event_votes to authenticated;
revoke update on public.road_events from public, anon, authenticated;
revoke update (confirmation_count, gone_count, last_confirmed_at)
on public.road_events from public, anon, authenticated;

create function public.cast_event_vote(p_event_id uuid, p_vote_type text)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  voter uuid := auth.uid();
  target public.road_events%rowtype;
begin
  if voter is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_event_id is null or p_vote_type is null or p_vote_type not in ('confirm', 'gone') then
    raise exception 'Invalid vote' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = voter and not p.is_banned) then
    raise exception 'Voting unavailable for this account' using errcode = '42501';
  end if;
  select e.* into target from public.road_events e where e.id = p_event_id;
  if not found then
    raise exception 'Event unavailable' using errcode = '42501';
  end if;
  if target.reporter_id = voter then
    raise exception 'Cannot vote on your own event' using errcode = '42501';
  end if;
  if target.status <> 'active' or target.expires_at <= clock_timestamp() then
    raise exception 'Event is no longer open for voting' using errcode = '42501';
  end if;
  insert into public.event_votes as v (event_id, user_id, vote_type)
  values (p_event_id, voter, p_vote_type)
  on conflict (event_id, user_id) do update
    set vote_type = excluded.vote_type
    where v.vote_type is distinct from excluded.vote_type;
end;
$$;
revoke all on function public.cast_event_vote(uuid, text) from public, anon, authenticated;
grant execute on function public.cast_event_vote(uuid, text) to authenticated;

commit;
