begin;
-- Supabase: enable the Cron integration before applying this migration.
-- Fail explicitly rather than shipping silently without automatic expiration.
do $$ begin
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    raise exception 'Enable Supabase Cron (pg_cron) before applying 0004';
  end if;
end $$;
-- Apply as the database owner (postgres). Same name/owner updates the job.
select cron.schedule(
  'road-event-lifecycle', '* * * * *',
  'select public.sweep_road_event_lifecycle();'
);
commit;
