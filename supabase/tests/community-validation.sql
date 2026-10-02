-- Run in Supabase SQL Editor on a staging project AFTER migration 0002.
-- Needs two existing auth.users (for example two anonymous Android sessions).
-- Everything, including fixture events and temporary profile changes, rolls back.
begin;

create temporary table vote_test_ids as
select (array_agg(id order by created_at, id))[1] as reporter,
       (array_agg(id order by created_at, id))[2] as voter,
       gen_random_uuid() as event_id
from auth.users;
do $$ begin
  if (select voter is null from vote_test_ids) then
    raise exception 'Create two test users before running this script';
  end if;
end $$;
grant select on vote_test_ids to authenticated, anon;
insert into public.profiles (id)
select reporter from vote_test_ids union select voter from vote_test_ids
on conflict (id) do nothing;
update public.profiles set is_banned = false
where id in (select reporter from vote_test_ids union select voter from vote_test_ids);
insert into public.road_events (id, reporter_id, event_type, latitude, longitude)
select event_id, reporter, 'road_hazard', 42.87, 74.59 from vote_test_ids;
create temporary table vote_test_original as
select status, confidence, expires_at from public.road_events
where id = (select event_id from vote_test_ids);

create function pg_temp.expect_counts(c integer, g integer) returns void
language plpgsql security invoker as $$ begin
  if not exists (
    select 1 from public.road_events e, vote_test_ids t
    where e.id = t.event_id and e.confirmation_count = c and e.gone_count = g
  ) then raise exception 'Unexpected counters: expected %, %', c, g; end if;
end $$;
create function pg_temp.expect_rejected(statement text) returns void
language plpgsql security invoker as $$
declare rejected boolean := false;
begin
  begin execute statement;
  exception when others then
    -- Syntax/function-resolution errors are test failures, not successful rejection.
    if sqlstate in ('42501', '22023', '23514', 'P0001') then
      rejected := true;
    else raise; end if;
  end;
  if not rejected then raise exception 'Statement was not rejected: %', statement; end if;
end $$;

select set_config('request.jwt.claim.sub', voter::text, true) from vote_test_ids;
select set_config('request.jwt.claims', json_build_object('sub', voter, 'role', 'authenticated')::text, true) from vote_test_ids;
set local role authenticated;
select pg_temp.expect_counts(0, 0); -- reporter is not counted
select public.cast_event_vote(event_id, 'confirm') from vote_test_ids;
select pg_temp.expect_counts(1, 0);
reset role;
create temporary table vote_test_saved as
select v.id, v.created_at, v.updated_at, e.last_confirmed_at,
       v.ctid::text as vote_tuple, e.ctid::text as event_tuple
from public.event_votes v join public.road_events e on e.id = v.event_id
where e.id = (select event_id from vote_test_ids);
set local role authenticated;
select public.cast_event_vote(event_id, 'confirm') from vote_test_ids;
select pg_temp.expect_counts(1, 0);
update public.event_votes set vote_type = 'confirm' where event_id = (select event_id from vote_test_ids);
select pg_temp.expect_counts(1, 0);
reset role;
do $$ begin
  if exists (
    select 1 from public.event_votes v join public.road_events e on e.id = v.event_id
    cross join vote_test_saved s
    where e.id = (select event_id from vote_test_ids)
      and (v.id <> s.id or v.created_at <> s.created_at or v.updated_at <> s.updated_at
        or e.last_confirmed_at is distinct from s.last_confirmed_at
        or v.ctid::text <> s.vote_tuple or e.ctid::text <> s.event_tuple)
  ) then raise exception 'Repeated vote was not a no-op'; end if;
end $$;
set local role authenticated;
select public.cast_event_vote(event_id, 'gone') from vote_test_ids;
select pg_temp.expect_counts(0, 1);
update public.event_votes set vote_type = 'confirm' where event_id = (select event_id from vote_test_ids);
select pg_temp.expect_counts(1, 0);
reset role;
do $$ begin
  if (select count(*) from public.event_votes where event_id = (select event_id from vote_test_ids)) <> 1
    or not exists (select 1 from public.event_votes v, vote_test_saved s where v.id = s.id)
    or not exists (select 1 from public.road_events where id = (select event_id from vote_test_ids) and last_confirmed_at is not null)
  then raise exception 'Switch did not preserve row / confirmation timestamp'; end if;
end $$;
-- Delete as administrator to independently test INSERT gone (client DELETE tested below).
delete from public.event_votes where event_id = (select event_id from vote_test_ids);
set local role authenticated;
select pg_temp.expect_counts(0, 0);
insert into public.event_votes (event_id, user_id, vote_type)
select event_id, voter, 'gone' from vote_test_ids;
select pg_temp.expect_counts(0, 1);
select public.cast_event_vote(event_id, 'gone') from vote_test_ids;
select pg_temp.expect_counts(0, 1);

select pg_temp.expect_rejected(format('select public.cast_event_vote(%L, ''invalid'')', event_id)) from vote_test_ids;
select pg_temp.expect_rejected(format('select public.cast_event_vote(%L, null)', event_id)) from vote_test_ids;
select pg_temp.expect_rejected('select public.cast_event_vote(null, ''confirm'')');
select pg_temp.expect_rejected(format('insert into public.event_votes(event_id,user_id,vote_type) values (%L,%L,''confirm'')', event_id, reporter)) from vote_test_ids;
select pg_temp.expect_rejected(format('update public.event_votes set user_id=%L where event_id=%L', reporter, event_id)) from vote_test_ids;
select pg_temp.expect_rejected(format('update public.event_votes set event_id=gen_random_uuid() where event_id=%L', event_id)) from vote_test_ids;
select pg_temp.expect_rejected(format('update public.event_votes set updated_at=now() where event_id=%L', event_id)) from vote_test_ids;
select pg_temp.expect_rejected('delete from public.event_votes');
select pg_temp.expect_rejected('update public.road_events set confirmation_count=100');
select pg_temp.expect_rejected('update public.road_events set gone_count=100');

reset role;
select set_config('request.jwt.claim.sub', reporter::text, true) from vote_test_ids;
select set_config('request.jwt.claims', json_build_object('sub', reporter, 'role', 'authenticated')::text, true) from vote_test_ids;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.event_votes where event_id = (select event_id from vote_test_ids)) then
    raise exception 'Other user vote leaked through SELECT policy';
  end if;
end $$;
select pg_temp.expect_rejected(format('select public.cast_event_vote(%L,''confirm'')', event_id)) from vote_test_ids;
select pg_temp.expect_rejected(format('insert into public.event_votes(event_id,user_id,vote_type) values (%L,%L,''gone'')', event_id, reporter)) from vote_test_ids;
reset role;
select set_config('request.jwt.claim.sub', voter::text, true) from vote_test_ids;
select set_config('request.jwt.claims', json_build_object('sub', voter, 'role', 'authenticated')::text, true) from vote_test_ids;
update public.profiles set is_banned = true where id = (select voter from vote_test_ids);
set local role authenticated;
select pg_temp.expect_rejected(format('select public.cast_event_vote(%L,''confirm'')', event_id)) from vote_test_ids;
select pg_temp.expect_rejected(format('insert into public.event_votes(event_id,user_id,vote_type) values (%L,%L,''confirm'')', event_id, voter)) from vote_test_ids;
-- RLS may filter an ineligible UPDATE to zero rows rather than raise. It must not change anything.
update public.event_votes set vote_type = 'confirm' where event_id = (select event_id from vote_test_ids);
select pg_temp.expect_counts(0, 1);
reset role;
update public.profiles set is_banned = false where id = (select voter from vote_test_ids);

-- Test each inactive status using the real RPC and direct INSERT/UPDATE.
do $$
declare s text; eid uuid := (select event_id from vote_test_ids); uid uuid := (select voter from vote_test_ids);
begin
  foreach s in array array['stale','removed','expired'] loop
    update public.road_events set status=s where id=eid;
    execute 'set local role authenticated';
    perform pg_temp.expect_rejected(format('select public.cast_event_vote(%L,''confirm'')', eid));
    perform pg_temp.expect_rejected(format('insert into public.event_votes(event_id,user_id,vote_type) values (%L,%L,''confirm'')', eid, uid));
    update public.event_votes set vote_type='confirm' where event_id=eid;
    execute 'reset role';
    if (select vote_type from public.event_votes where event_id=eid) <> 'gone' then raise exception 'Inactive vote changed'; end if;
  end loop;
end $$;
update public.road_events set status='active', expires_at=now() where id=(select event_id from vote_test_ids);
set local role authenticated;
select pg_temp.expect_rejected(format('select public.cast_event_vote(%L,''confirm'')', event_id)) from vote_test_ids;
select pg_temp.expect_rejected(format('insert into public.event_votes(event_id,user_id,vote_type) values (%L,%L,''confirm'')', event_id, voter)) from vote_test_ids;
update public.event_votes set vote_type='confirm' where event_id=(select event_id from vote_test_ids);
reset role;
-- Expired rows are hidden from authenticated SELECT after migration 0003.
select pg_temp.expect_counts(0, 1);
update public.road_events set expires_at=o.expires_at from vote_test_original o where id=(select event_id from vote_test_ids);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select pg_temp.expect_rejected(format('select public.cast_event_vote(%L,''confirm'')', event_id)) from vote_test_ids;
set local role anon;
select pg_temp.expect_rejected(format('select public.cast_event_vote(%L,''confirm'')', event_id)) from vote_test_ids;
reset role;

do $$ begin
  if exists (
    select 1 from public.road_events e cross join vote_test_original o
    where e.id=(select event_id from vote_test_ids)
      and (e.status<>o.status or e.confidence<>o.confidence or e.expires_at<>o.expires_at)
  ) then raise exception 'Lifecycle fields changed'; end if;
  if has_function_privilege('authenticated','public.prepare_event_vote()','EXECUTE')
    or has_function_privilege('anon','public.apply_event_vote_counters()','EXECUTE')
    or has_table_privilege('authenticated','public.event_votes','DELETE') then
    raise exception 'Internal execution or client DELETE still granted';
  end if;
end $$;
select 'All community validation checks passed; rolling back fixtures' as result;
rollback;
