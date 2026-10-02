-- Staging/local only, as postgres, after 0001-0003. All fixtures roll back.
-- Requires four existing auth users. Never run against production data.
begin;
create temporary table lifecycle_ids as
select (array_agg(id order by created_at, id))[1:4] as users,
       gen_random_uuid() as event_id from auth.users;
do $$ begin
  if (select cardinality(users) < 4 or users is null from lifecycle_ids) then
    raise exception 'Four test auth users are required';
  end if;
end $$;
grant select on lifecycle_ids to authenticated;
update public.profiles set is_banned=false where id = any((select users from lifecycle_ids)::uuid[]);
insert into public.road_events(id, reporter_id, event_type, latitude, longitude)
select event_id, users[1], 'road_hazard', 42.87, 74.59 from lifecycle_ids;
create temporary table lifecycle_original as
select e.* from public.road_events e join lifecycle_ids t on t.event_id=e.id;

do $$
declare t timestamptz := now(); r record;
begin
  if exists(select 1 from lifecycle_original where expires_at-created_at <> interval '4 hours') then
    raise exception 'TTL must be four hours';
  end if;
  for r in select * from (values
    ('active', 2, 0, 'active'), ('active', 3, 2, 'removed'),
    ('active', 3, 3, 'active'), ('active', 3, 4, 'active'),
    ('stale', 3, 0, 'stale'), ('removed', 0, 10, 'removed'),
    ('expired', 0, 10, 'expired')
  ) as cases(status, gone, confirmations, expected) loop
    if public.road_event_lifecycle_status(r.status, t+interval '1 hour', r.confirmations, r.gone, t) <> r.expected then
      raise exception 'Lifecycle rule failed: %', r;
    end if;
  end loop;
  if public.road_event_lifecycle_status('active', t, 0, 3, t) <> 'expired'
    or public.road_event_lifecycle_status('stale', t, 0, 0, t) <> 'expired'
    or public.road_event_lifecycle_status('removed', t, 0, 0, t) <> 'removed' then
    raise exception 'Expiry precedence/terminal preservation failed';
  end if;
end $$;

-- Real RPC and direct writes share the same aggregate/removal trigger.
do $$
declare ids uuid[] := (select users from lifecycle_ids); eid uuid := (select event_id from lifecycle_ids); i integer;
begin
  for i in 2..4 loop
    perform set_config('request.jwt.claim.sub', ids[i]::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub',ids[i],'role','authenticated')::text, true);
    execute 'set local role authenticated';
    if i=2 then
      perform public.cast_event_vote(eid,'confirm');
      perform public.cast_event_vote(eid,'confirm'); -- no-op
      perform public.cast_event_vote(eid,'gone'); -- switch
    else
      insert into public.event_votes(event_id,user_id,vote_type) values(eid,ids[i],'gone');
    end if;
    execute 'reset role';
    if not exists(select 1 from public.road_events where id=eid and gone_count=i-1
      and confirmation_count=0 and status=case when i=4 then 'removed' else 'active' end) then
      raise exception 'Vote totals / transactional removal failed at voter %', i;
    end if;
  end loop;
  if exists(select 1 from public.road_events e, lifecycle_original o where e.id=eid
    and (e.expires_at<>o.expires_at or e.confidence<>o.confidence or e.last_confirmed_at is null)) then
    raise exception 'Votes changed TTL/confidence or lost confirmation timestamp';
  end if;
  execute 'set local role authenticated';
  begin
    perform public.cast_event_vote(eid,'confirm');
    raise exception 'Removed event accepted a vote';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.road_events where id=eid) then raise exception 'Removed event visible'; end if;
  execute 'reset role';
  delete from public.event_votes where event_id=eid; -- admin cleanup cannot resurrect
  if (select status from public.road_events where id=eid)<>'removed' then raise exception 'Resurrection'; end if;
end $$;

-- A switch can cross the threshold as well as a new INSERT.
do $$
declare ids uuid[] := (select users from lifecycle_ids); eid uuid := gen_random_uuid(); i integer;
begin
  insert into public.road_events(id,reporter_id,event_type,latitude,longitude)
  values(eid,ids[1],'accident',42.87,74.59);
  for i in 2..4 loop
    perform set_config('request.jwt.claim.sub', ids[i]::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub',ids[i],'role','authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.cast_event_vote(eid,case when i=2 then 'confirm' else 'gone' end);
    execute 'reset role';
  end loop;
  if not exists(select 1 from public.road_events where id=eid and status='active'
    and confirmation_count=1 and gone_count=2) then raise exception 'Premature removal'; end if;
  perform set_config('request.jwt.claim.sub', ids[2]::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub',ids[2],'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update public.event_votes set vote_type='gone' where event_id=eid and user_id=ids[2];
  execute 'reset role';
  if not exists(select 1 from public.road_events where id=eid and status='removed'
    and confirmation_count=0 and gone_count=3) then raise exception 'Switch removal failed'; end if;
end $$;

-- Simulate time passing as administrator. SELECT must hide expiry before Cron.
update public.road_events set status='active', expires_at=now() where id=(select event_id from lifecycle_ids);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.road_events where id=(select event_id from lifecycle_ids)) then
    raise exception 'Expired event leaked before sweep';
  end if;
end $$;
reset role;
select public.sweep_road_event_lifecycle();
select public.sweep_road_event_lifecycle();
do $$ begin
  if (select status from public.road_events where id=(select event_id from lifecycle_ids))<>'expired' then
    raise exception 'Sweep failed';
  end if;
  if has_function_privilege('authenticated','public.sweep_road_event_lifecycle()','EXECUTE')
    or has_function_privilege('anon','public.sweep_road_event_lifecycle()','EXECUTE')
    or has_function_privilege('authenticated','public.road_event_lifecycle_status(text,timestamp with time zone,integer,integer,timestamp with time zone)','EXECUTE')
    or has_column_privilege('authenticated','public.road_events','status','UPDATE')
    or has_column_privilege('authenticated','public.road_events','expires_at','UPDATE')
    or has_table_privilege('authenticated','public.event_votes','DELETE') then
    raise exception 'Client lifecycle privilege leak';
  end if;
end $$;

-- Reserved stale status expires; ordinary aging alone never creates stale.
do $$
declare uid uuid := (select users[1] from lifecycle_ids);
  stale_id uuid := gen_random_uuid(); aging_id uuid := gen_random_uuid();
begin
  insert into public.road_events(id,reporter_id,event_type,latitude,longitude,status,created_at,expires_at)
  values
    (stale_id,uid,'road_closure',42.87,74.59,'stale',now()-interval '4 hours',now()),
    (aging_id,uid,'road_check',42.87,74.59,'active',now()-interval '3 hours',now()+interval '1 hour');
  perform public.sweep_road_event_lifecycle();
  if (select status from public.road_events where id=stale_id)<>'expired'
    or (select status from public.road_events where id=aging_id)<>'active' then
    raise exception 'Stale/aging sweep behavior failed';
  end if;
end $$;
select 'Lifecycle checks passed; rolling back' as result;
rollback;
