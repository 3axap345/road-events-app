# Duplicate prevention: implementation and validation

## Contract

New active reports conflict with an existing event when the type matches, the
existing status is `active`, its expiry is later than the server's check time,
and spherical distance is <=150 metres. The database is authoritative. Neither
the device clock, cached map data, nor client-provided check results authorize
an INSERT. TTL remains four hours. No vote, count, confidence, trust, ban, or
lifecycle rule changes.

The existing direct `road_events` INSERT and column grants remain in place.
Migration `0005_prevent_duplicate_road_events.sql` installs a SECURITY INVOKER,
VOLATILE BEFORE INSERT trigger. It takes transaction advisory lock
`(150005, type_key)` where road_check=1, accident=2, road_hazard=3,
road_closure=4. All reports of one type share a lock, even across cities.
The subsequent separate SELECT takes a fresh READ COMMITTED snapshot after
waiting. Other isolation levels fail closed with `0A000`. Do not combine the
lock and lookup into one SQL statement or mark the trigger STABLE.

Existing SELECT RLS exposes all active, unexpired candidates to authenticated
callers. Preserve that property if read policies change: a future per-user or
geographic read restriction would require a security review of this invoker
guard. No RLS bypass or security-definer writer is introduced.

The duplicate error is SQLSTATE `P1501`, with JSON in PostgreSQL DETAIL:

```json
{"existing_event_id":"<uuid>"}
```

PostgREST's `code` and `details` fields are parsed and validated by the creation
boundary. The message text is not a discriminator. Malformed details remain a
failure; they never become success. Multiple matches resolve by distance,
created_at, then ID. The SQL and TypeScript distance functions use Earth radius
6,371,000m, clamp the Haversine term to [0,1], and round distances to nanometres
to avoid floating-point noise at the inclusive boundary. This is not an added
GPS uncertainty allowance. PostGIS and new native dependencies are unnecessary.

## Client behavior

The existing report panel shows the duplicate message with View event, Back,
and Cancel. It does not retry creation or vote automatically. Viewing performs
a fresh RLS-protected lookup. A visible event is put in the existing active
query cache, selected, and focused at zoom 16 with no animation; GPS following
is disabled while that focus is active. The existing details/voting card is reused.
Closing details clears the focus. GPS permission is not required to view it.

Both creation and duplicate outcomes invalidate the active list. A later read
failure never repeats the write. A failed event lookup preserves the draft and
offers another read. A null response (expired, removed, or no longer visible)
returns to report review with an explanation and an explicit submit action.
Cancelling or going Back during a lookup prevents its late result reopening
the event. Repeated view taps are ignored while loading. A report whose response
was lost can be manually retried: while the first event remains active and
unexpired, the retry returns the existing event instead of creating another.
This does not introduce a separate idempotency key or promise deduplication
after the original event has expired/been removed.

## Deployment and SQL validation (not performed by the implementation task)

1. Use an isolated staging/local Supabase project with test auth users and no
   production data. Back up the staging database as appropriate.
2. Verify migrations 0001-0004 and the existing lifecycle/Cron setup, then apply
   0005 through the normal owner migration process. It creates functions, one
   trigger, and one index, and changes no existing rows, RLS policies, grants,
   defaults, or scheduled jobs. Installation/index creation takes table locks;
   schedule for low traffic. Existing clients are protected but show their old
   generic error until the updated JavaScript is loaded.
3. Reserve the test coordinates in the SQL script. It requires two existing auth
   users with profiles; its data and temporary account changes roll back.
4. Run each SQL file with stop-on-error. These commands require a staging
   connection configured outside source control:

```powershell
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/duplicate-prevention.sql
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/community-validation.sql
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/event-lifecycle.sql
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/event-lifecycle-cron.sql
```

The existing community/lifecycle scripts have their own user-count and fixture
requirements (lifecycle needs four users). Keep their test locations clear too.
Run the separate [concurrency plan](duplicate-prevention-concurrency.md).
Single-session SQL and mocked SDK tests do not prove concurrent behavior.

Audit preexisting duplicates after installation; do not delete or merge them:

```sql
select a.id, b.id, a.event_type
from public.road_events a join public.road_events b
  on a.id < b.id and a.event_type = b.event_type
where a.status = 'active' and b.status = 'active'
  and a.expires_at > statement_timestamp() and b.expires_at > statement_timestamp()
  and public.road_event_distance_meters(a.latitude,a.longitude,b.latitude,b.longitude) <= 150;
```

For a rollback of this feature, remove its trigger before its trigger function,
then its distance function and new index, in an owner transaction. This restores
the old unprotected INSERT behavior; it does not alter events or lifecycle data.
Keep the rollback decision explicit.

## Automated and physical checks

```powershell
npm test
npm run typecheck
npm run lint
git diff --check
```

Unit coverage includes duplicate error validation, expiry/type/status/radius
boundaries, deterministic matching, refresh invalidation, retained drafts,
cancelled reads, repeated taps, RLS-hidden lookup responses, button contracts,
and camera longitude/latitude/GPS-following props. Native components are stubbed
in Node; these tests do not assert physical rendering.

With one Android phone and the existing development client:

- Load the updated JavaScript through Metro. No new EAS development build is
  required; no native library/configuration changed.
- Long-press to report, then report the same type nearby. Check that the duplicate
  message replaces submission, one marker exists, and counts/votes are unchanged.
- View the event. Check map centering, marker visibility above the card, correct
  details, no GPS snap-back while viewing, and normal behavior after dismissing.
- Test another type, a point clearly outside 150m, own report, and another user's
  report created from a computer client. Do not rely on GPS for exact boundaries;
  the SQL tests use known coordinates.
- Deny location permission; select locations manually and repeat the flow.
- Disconnect before submission, retry explicitly, and test a lost response after
  an accepted write. Confirm no automatic repeat/vote occurs.
- Disconnect before viewing. Retry the read; also cancel/go Back while loading.
- Remove/expire the event on staging between the duplicate response and View.
  Confirm the explanation, preserved draft, and explicit resubmission.
- Check narrow and tablet-sized layouts, large text, readable message/buttons,
  accessible announcements, and that buttons remain reachable by scrolling.
- Background/resume; verify existing lifecycle refresh still hides closed events.

Use two computer connections for concurrency; a second phone is unnecessary.
iOS physical verification remains separate. Distributing a standalone updated
binary may require a build because this repository does not configure OTA updates.

## Files in this change

- Database: `supabase/migrations/0005_prevent_duplicate_road_events.sql`,
  `supabase/tests/duplicate-prevention.sql`.
- Event domain/repository: `src/features/events/create-event.ts`,
  `src/features/events/event-distance.ts`, `src/features/events/event-duplicates.ts`,
  `src/features/events/event-repository.ts`.
- Supabase adapter: `src/services/supabase/client.ts` (adds the lookup gateway;
  preserves the existing direct INSERT and lifecycle read changes).
- Report/view flow: `src/features/map/report-location.ts`,
  `src/features/map/submit-report.ts`, `src/features/map/view-duplicate.ts`,
  `src/features/map/use-submit-report.ts`, `src/features/map/ReportLocationControls.tsx`.
- Map/selection: `src/features/map/MapScreen.tsx`, `src/features/map/map-types.ts`,
  `src/features/map/react-native-map-provider.tsx`, `src/stores/map-selection-store.ts`.
- Tests: `tests/features/events/duplicate-prevention.test.ts`,
  `tests/features/events/event-domain.test.ts` (adds explicit test time only),
  `tests/features/map/view-duplicate.test.ts`,
  `tests/features/map/duplicate-presentation.test.tsx`.
- Docs: `ARCHITECTURE.md`, this file, `docs/duplicate-prevention-concurrency.md`.

Existing uncommitted lifecycle code, migrations 0003/0004, SQL tests, and refresh
tests are preserved. Shared files only add the duplicate feature alongside them.

## Limitations

Per-type serialization trades throughput for a simple correct MVP guard. Measure
lock wait and query latency before considering spatial partitions/PostGIS. Keep
transactions short. Multi-type bulk INSERTs in opposite orders can deadlock;
PostgreSQL aborts one transaction rather than allowing duplicates. The app sends
one row per request and does not automatically retry writes.

An event may expire or be removed immediately after the duplicate check or view
lookup; the client handles a missing event and normal foreground refresh updates
the card. Existing lifecycle writers are not forced into the creation lock.
Privileged admins can edit coordinates/types or restore states; such maintenance
must enforce the invariant separately. Ordinary clients cannot do those writes.
Two genuine same-type incidents within 150m are intentionally treated as duplicates.
