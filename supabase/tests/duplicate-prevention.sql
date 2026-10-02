-- Staging/local only, as postgres, after 0001-0005. Requires two auth users.
-- Run with psql -v ON_ERROR_STOP=1 -f supabase/tests/duplicate-prevention.sql
-- All fixtures and account changes roll back. Reserve (-70, -120) for this test.
begin isolation level read committed;
create temporary table duplicate_ids as
select (array_agg(id order by created_at, id))[1:2] as users,
  gen_random_uuid() as existing_id from auth.users;
grant select on duplicate_ids to authenticated;
do $$ begin
  if (select cardinality(users) < 2 or users is null from duplicate_ids) then
    raise exception 'Two test auth users are required';
  end if;
end $$;
update public.profiles set is_banned = false
where id = any((select users from duplicate_ids)::uuid[]);

-- Seed a committed-looking active event; capture all fields for no-mutation checks.
insert into public.road_events(id,reporter_id,event_type,latitude,longitude)
select existing_id,users[1],'accident',-70,-120 from duplicate_ids;
create temporary table original_duplicate_event as
select e.* from public.road_events e join duplicate_ids t on e.id=t.existing_id;

do $$
declare
  ids uuid[] := (select users from duplicate_ids);
  expected uuid := (select existing_id from duplicate_ids);
  detail text;
  candidate_lat double precision;
begin
  perform set_config('request.jwt.claim.sub',ids[2]::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',ids[2],'role','authenticated')::text,true);
  execute 'set local role authenticated';
  -- Exact match, just inside, exact boundary (equator), and direct multi-row writes.
  foreach candidate_lat in array array[-70::double precision, -70 + degrees(149.99 / 6371000.0)] loop
    begin
      insert into public.road_events(reporter_id,event_type,latitude,longitude)
      values(ids[2],'accident',candidate_lat,-120);
      raise exception 'Nearby duplicate accepted';
    exception when sqlstate 'P1501' then
      get stacked diagnostics detail = pg_exception_detail;
      if (detail::jsonb->>'existing_event_id')::uuid is distinct from expected then raise exception 'Wrong duplicate ID'; end if;
    end;
  end loop;
  insert into public.road_events(reporter_id,event_type,latitude,longitude)
  values(ids[2],'accident',-70 + degrees(150.01 / 6371000.0),-120);
  -- Different types remain independent at identical coordinates.
  insert into public.road_events(reporter_id,event_type,latitude,longitude)
  values(ids[2],'road_hazard',-70,-120),(ids[2],'road_check',-70,-120),(ids[2],'road_closure',-70,-120);
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    values(ids[2],'accident',-60,-120),(ids[2],'accident',-60,-120);
    raise exception 'Same-statement duplicates accepted';
  exception when sqlstate 'P1501' then null;
  end;
  if exists(select 1 from public.road_events where latitude=-60 and longitude=-120) then
    raise exception 'Multi-row statement did not roll back atomically';
  end if;
  insert into public.road_events(reporter_id,event_type,latitude,longitude)
  values(ids[2],'accident',0,-120);
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    values(ids[2],'accident',degrees(150.0/6371000.0),-120);
    raise exception 'Inclusive 150m boundary accepted';
  exception when sqlstate 'P1501' then null;
  end;
  -- Existing RLS and column grants remain authoritative.
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    values(ids[1],'accident',-50,-120);
    raise exception 'Spoofed reporter accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude,status,expires_at,confidence)
    values(ids[2],'accident',-50,-120,'active',now()+interval '8 hours',10);
    raise exception 'Protected fields accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    values(ids[2],'accident',91,-120);
    raise exception 'Invalid coordinates accepted';
  exception when invalid_parameter_value or check_violation then null;
  end;
  execute 'reset role';
  if exists(select 1 from public.road_events e join original_duplicate_event o using(id) where e is distinct from o) then
    raise exception 'Duplicate attempt mutated existing event';
  end if;
  if exists(select 1 from public.event_votes where event_id=expected) then raise exception 'Duplicate cast a vote'; end if;
  if exists(select 1 from public.road_events where longitude=-120 and expires_at-created_at <> interval '4 hours') then
    raise exception 'Report TTL changed';
  end if;
end $$;

-- Each excluded status and active-but-expired data must allow a new report.
do $$
declare ids uuid[] := (select users from duplicate_ids); s text; lat double precision := -40;
begin
  foreach s in array array['stale','removed','expired','active'] loop
    insert into public.road_events(reporter_id,event_type,latitude,longitude,status,expires_at)
    values(ids[1],'accident',lat,-120,s,case when s='active' then clock_timestamp() else now()+interval '4 hours' end);
    execute 'set local role authenticated';
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    values(ids[2],'accident',lat,-120);
    execute 'reset role';
    lat := lat+1;
  end loop;
  update public.profiles set is_banned=true where id=ids[2];
  execute 'set local role authenticated';
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    values(ids[2],'accident',-30,-120);
    raise exception 'Banned account report accepted';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  execute 'set local role anon';
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    values(ids[2],'accident',-30,-120);
    raise exception 'Unauthenticated report accepted';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;
rollback;

-- Multiple eligible matches can surround a new point without duplicating each
-- other. The nearer event must win, regardless of insertion order.
begin isolation level read committed;
do $$
declare uid uuid := (select id from auth.users order by created_at,id limit 1);
  near_id uuid; detail text;
begin
  update public.profiles set is_banned=false where id=uid;
  insert into public.road_events(reporter_id,event_type,latitude,longitude)
  values(uid,'road_hazard',20+degrees(200.0/6371000.0),-120);
  insert into public.road_events(reporter_id,event_type,latitude,longitude)
  values(uid,'road_hazard',20,-120) returning id into near_id;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    values(uid,'road_hazard',20+degrees(80.0/6371000.0),-120);
    raise exception 'Overlapping-radius duplicate accepted';
  exception when sqlstate 'P1501' then
    get stacked diagnostics detail = pg_exception_detail;
    if (detail::jsonb->>'existing_event_id')::uuid is distinct from near_id then
      raise exception 'Nearest duplicate not selected';
    end if;
  end;
  execute 'reset role';
end $$;
rollback;

-- A stale transaction snapshot must fail closed, never accept unchecked inserts.
begin isolation level repeatable read;
do $$ begin
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    select id,'accident',-30,-120 from auth.users limit 1;
    raise exception 'Unsupported isolation accepted';
  exception when feature_not_supported then null;
  end;
end $$;
rollback;

begin isolation level serializable;
do $$ begin
  begin
    insert into public.road_events(reporter_id,event_type,latitude,longitude)
    select id,'accident',-30,-120 from auth.users limit 1;
    raise exception 'Unsupported isolation accepted';
  exception when feature_not_supported then null;
  end;
end $$;
rollback;
