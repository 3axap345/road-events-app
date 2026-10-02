begin;

-- Spherical Haversine, matching event-distance.ts. Nanometre rounding removes
-- floating-point noise at the inclusive boundary; it is not a GPS tolerance.
create function public.road_event_distance_meters(
  lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision
) returns double precision language sql immutable strict parallel safe
security invoker set search_path = ''
as $$
  select round((2 * 6371000.0 * atan2(sqrt(a),sqrt(1-a)))::numeric,9)::double precision
  from (select greatest(0.0,least(1.0,
    power(sin(radians(lat2-lat1)/2),2)
    + cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2)
  )) as a) h;
$$;
revoke all on function public.road_event_distance_meters(double precision,double precision,double precision,double precision)
from public, anon, authenticated;
grant execute on function public.road_event_distance_meters(double precision,double precision,double precision,double precision)
to authenticated;

create function public.prevent_duplicate_road_event()
returns trigger language plpgsql volatile security invoker set search_path = ''
as $$
declare
  type_key integer;
  checked_at timestamptz;
  existing_id uuid;
begin
  -- Fresh snapshots after waiting are required. Never silently accept a request
  -- running with a transaction-wide snapshot (including maintenance sessions).
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Road event creation requires READ COMMITTED' using errcode='0A000';
  end if;
  -- Mirror the existing INSERT policy for authenticated callers before exposing
  -- duplicate details. Do not change its missing-profile or reporting semantics.
  if current_user = 'authenticated' and (
    auth.uid() is null or new.reporter_id is distinct from auth.uid()
    or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_banned)
  ) then
    raise exception 'Reporting unavailable for this account' using errcode='42501';
  end if;
  type_key := case new.event_type
    when 'road_check' then 1 when 'accident' then 2
    when 'road_hazard' then 3 when 'road_closure' then 4 end;
  if type_key is null or new.latitude is null or new.longitude is null
    or not (new.latitude between -90 and 90 and new.longitude between -180 and 180) then
    raise exception 'Invalid road event type or coordinates' using errcode='22023';
  end if;
  -- Only privileged maintenance can supply non-active/expired new rows. Ordinary
  -- INSERT column grants do not expose status or expiry and remain unchanged.
  if new.status <> 'active' or new.expires_at <= clock_timestamp() then return new; end if;

  -- Namespace 150005 is reserved for road-event creation. Lock by TYPE, not
  -- reporter/coordinate/cell: nearby points must always share a lock.
  perform pg_advisory_xact_lock(150005,type_key);
  checked_at := clock_timestamp();
  -- MUST remain a separate statement after the lock in this VOLATILE function.
  -- Under READ COMMITTED this sees the preceding lock holder's committed INSERT.
  select e.id into existing_id from public.road_events e
  where e.event_type=new.event_type and e.status='active' and e.expires_at>checked_at
    and public.road_event_distance_meters(new.latitude,new.longitude,e.latitude,e.longitude)<=150
  order by public.road_event_distance_meters(new.latitude,new.longitude,e.latitude,e.longitude),e.created_at,e.id
  limit 1;
  if existing_id is not null then
    raise exception 'Nearby road event already exists'
      using errcode='P1501',detail=json_build_object('existing_event_id',existing_id)::text;
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_duplicate_road_event() from public, anon, authenticated;
create trigger prevent_duplicate_road_event_before_insert
before insert on public.road_events
for each row execute function public.prevent_duplicate_road_event();

create index road_events_active_type_expires_at_idx
on public.road_events(event_type,expires_at) where status='active';

-- No RLS, table/column grants, lifecycle, defaults, votes, or existing rows change.
commit;
