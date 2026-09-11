-- Seed only against a local Supabase instance that already has an Auth user.
-- The first user is used solely to satisfy road_events.reporter_id's foreign key.
do $$
declare
  seed_user_id uuid;
begin
  select id
  into seed_user_id
  from auth.users
  order by created_at
  limit 1;

  if seed_user_id is null then
    raise notice 'No Auth user exists; Bishkek road-event seed rows were skipped.';
    return;
  end if;

  insert into public.road_events (
    reporter_id,
    event_type,
    latitude,
    longitude
  )
  select
    seed_user_id,
    seed.event_type,
    seed.latitude,
    seed.longitude
  from (
    values
      ('road_hazard'::text, 42.8746::double precision, 74.5698::double precision),
      ('road_closure'::text, 42.8615::double precision, 74.6057::double precision)
  ) as seed(event_type, latitude, longitude)
  where not exists (
    select 1
    from public.road_events existing
    where existing.reporter_id = seed_user_id
      and existing.event_type = seed.event_type
      and existing.latitude = seed.latitude
      and existing.longitude = seed.longitude
      and existing.status = 'active'
  );
end;
$$;
