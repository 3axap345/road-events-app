
begin;

create function public.enforce_road_event_rate_limit()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  checked_at timestamptz;
  recent_count integer;
  daily_count integer;
begin
  -- Preserve privileged maintenance operations.
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  if auth.uid() is null
     or new.reporter_id is distinct from auth.uid() then
    raise exception 'Reporting unavailable'
      using errcode = '42501';
  end if;

  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Road event creation requires READ COMMITTED'
      using errcode = '0A000';
  end if;

  -- Serialize creation attempts by the same user.
  perform pg_advisory_xact_lock(
    150006,
    hashtext(new.reporter_id::text)
  );

  checked_at := clock_timestamp();

  -- Count all statuses, including expired and removed.
  select
    count(*) filter (
      where created_at > checked_at - interval '10 minutes'
    ),
    count(*) filter (
      where created_at > checked_at - interval '24 hours'
    )
  into recent_count, daily_count
  from public.road_events
  where reporter_id = new.reporter_id
    and created_at > checked_at - interval '24 hours';

  if recent_count >= 3 then
    raise exception 'Road event rate limit exceeded'
      using errcode = 'P1502',
            detail = '10-minute limit exceeded';
  end if;

  if daily_count >= 15 then
    raise exception 'Road event rate limit exceeded'
      using errcode = 'P1502',
            detail = '24-hour limit exceeded';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_road_event_rate_limit()
from public, anon, authenticated;

-- Runs after the existing duplicate-prevention trigger.
create trigger zz_enforce_road_event_rate_limit_before_insert
before insert on public.road_events
for each row
execute function public.enforce_road_event_rate_limit();

commit;
