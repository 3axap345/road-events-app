# MVP event lifecycle validation and rollout

## Rules

- Four-hour TTL from creation for all event types. Votes never extend it.
- Early removal: gone >= 3 AND gone > confirmations, evaluated on post-vote totals.
- Existing terminal statuses stay terminal. Expiry takes precedence over new removal.
- No automatic stale transitions or confidence changes.
- Client polling: one minute foreground only, immediate read on resume.

## Deployment order (not applied by this change)

1. In a local/staging Supabase database, apply migrations through `0003_event_lifecycle.sql` as the database owner.
2. Enable the Supabase Cron integration (`pg_cron`), then apply `0004_schedule_event_lifecycle.sql` as the same owner (`postgres`). It fails explicitly if Cron is absent. The named job is scheduled once a minute; repeating registration with the same owner/name updates that job.
3. Run `supabase/tests/community-validation.sql` and `supabase/tests/event-lifecycle.sql` in SQL Editor as postgres (or psql with `ON_ERROR_STOP=1`). They use existing test auth users and roll back fixtures. Lifecycle needs four users with profiles. Use a small staging dataset: the sweep is bounded to 500 rows per run.
4. Run `supabase/tests/event-lifecycle-cron.sql` and inspect successful job runs after at least two minutes. Check job owner/database as well as command/schedule.
5. Deploy the client only AFTER 0003: its read path now relies on server-time RLS instead of the phone clock. Older clients remain compatible with the stricter RLS.

Sources: [Supabase Cron installation](https://supabase.com/docs/guides/cron/install), [scheduling and history](https://supabase.com/docs/guides/cron/quickstart).

## Physical Android checks

On staging, open an active event, then expire or remove it using another session. Leave Android foregrounded: within the next successful minute refresh, its marker/details should disappear. Background the app, change another event, then resume: a refresh should start immediately. Verify no periodic requests while backgrounded, normal report submission, same-vote no-op, switching votes, loading/errors, and persistent anonymous identity. No native changes: Metro Reload is sufficient.

## Concurrency checks (two independent staging SQL sessions)

Use a fresh test event with two gone votes and two additional eligible users. In session A begin a transaction, set the JWT user claims, SET LOCAL ROLE authenticated, and call `cast_event_vote(event_id,'gone')`; leave it uncommitted. In session B do the same for the other user: it should wait at the event lock. Commit A. B must reject the now-removed event and must not add a fourth vote. Roll back B. Check counters against `event_votes` as postgres.

Repeat with a confirm/gone race near the threshold: either valid serialization is acceptable, but counters must match vote rows and a removed event must not resurrect. Run the sweep in another session while the event is locked: it should skip that row and process it on the next run. Recheck expiry eligibility after lock acquisition (existing vote BEFORE trigger).

## Operational and security boundaries

The scheduled job and privileged aggregate function have fixed empty search paths; lifecycle functions are not executable by anon/authenticated/PUBLIC. No new client write grants, no DELETE/unvote, no user-supplied identity, and no RLS bypass were added to the client. Existing ban, own-event, active, and expiry vote checks remain in place.

The sweep changes status only, not counts, confidence, expiry, or votes. It does not delete events. Backlogs over 500 due rows or persistent locks may delay stored status changes; server-time SELECT RLS still hides expired rows. Monitor failed Cron runs and backlog; retained Cron history requires operator retention planning. Query failures keep the existing error state/cache; this is periodic refresh, not realtime or an offline visibility guarantee.

Automated TypeScript tests do not validate PostgreSQL permissions, triggers, transaction ordering, or the scheduler. The executable SQL and two-session checks are required before production rollout.
