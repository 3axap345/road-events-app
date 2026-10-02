-- Read-only, after 0004, run as the deployment owner (postgres).
do $$ begin
  if (select count(*) from cron.job where jobname='road-event-lifecycle'
    and active and schedule='* * * * *'
    and command='select public.sweep_road_event_lifecycle();'
    and username=current_user and database=current_database()) <> 1 then
    raise exception 'Expected exactly one active owner/database lifecycle job';
  end if;
end $$;
select j.jobid, j.jobname, j.username, j.database, j.schedule, j.active,
       r.status, r.return_message, r.start_time, r.end_time
from cron.job j left join cron.job_run_details r on r.jobid=j.jobid
where j.jobname='road-event-lifecycle'
order by r.start_time desc limit 10;
