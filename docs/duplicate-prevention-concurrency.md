# Staging concurrency plan (two independent connections)

Run only after 0005 in isolated staging. This plan has NOT been executed by the
implementation task. Use psql terminals A, B and optionally observer C, each with
its own database connection. A shared SQL editor connection is insufficient.
Use two existing non-banned test users with profiles. Replace the example user
UUIDs below. Do not use service-role HTTP requests to prove client authorization.

Reserve coordinate (-25,-120) for the first test. Identify created rows using
reporter/type/coordinates and record their returned IDs. Never delete unrelated
staging rows for cleanup.

## A commits; B must see the committed event after waiting

Terminal A (replace user UUID):

```sql
begin isolation level read committed;
select set_config('request.jwt.claim.sub','AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',true);
select set_config('request.jwt.claims','{"sub":"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA","role":"authenticated"}',true);
set local role authenticated;
insert into public.road_events(reporter_id,event_type,latitude,longitude)
values(auth.uid(),'accident',-25,-120) returning id;
-- Leave the transaction open. Record the ID.
```

Terminal B (different test user):

```sql
\set VERBOSITY verbose
begin isolation level read committed;
set local statement_timeout = '60s';
select set_config('request.jwt.claim.sub','BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',true);
select set_config('request.jwt.claims','{"sub":"BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB","role":"authenticated"}',true);
set local role authenticated;
insert into public.road_events(reporter_id,event_type,latitude,longitude)
values(auth.uid(),'accident',-25.0001,-120) returning id;
-- This must wait. While it waits, COMMIT in terminal A.
```

Optional observer C (owner):

```sql
select pid,locktype,classid,objid,granted
from pg_locks where locktype='advisory' and classid=150005;
```

Then A: `commit;`. B must finish with SQLSTATE `P1501` and DETAIL containing
A's ID. B: `rollback;`. Query as owner: exactly one new active event in the
reserved area. Confirm A's TTL is four hours and no votes/counters changed.
This test specifically starts B's INSERT before A commits: a lookup using B's
original statement snapshot instead of a fresh post-lock snapshot would fail it.

## A rolls back; B must succeed

Use a fresh reserved point, e.g. (-24,-120), and repeat the same steps. While B
waits, run `rollback;` in A. B must return its new ID. Commit B. Exactly one new
row must exist; A's attempted row must be absent. Record B's ID for cleanup.

## Additional concurrency cases

Repeat with fresh reserved coordinates per case and record all successful IDs:

| Case | Expected |
| --- | --- |
| Same user in both sessions | Still only one nearby same-type event |
| Different types at same point | Both succeed; different type locks |
| Same type >150m apart | B waits for A, then succeeds |
| 10-20 parallel authenticated HTTP reports within a tiny area | One success; all others P1501 referencing that row |
| Repeat HTTP request after discarding first success response | P1501; no second row while first is active/unexpired |
| B times out waiting | Transaction fails; no B row; later explicit retry checks again |
| A's existing event passes expiry while B waits | B checks current server time and can insert after expiry |
| Existing event removed while B waits | After removal commits, B can insert |
| Existing event removed immediately after duplicate response | View lookup returns null; client retains draft and explains |
| Opposite-order multi-type bulk inserts | May deadlock; aborted transaction leaves no partial rows or duplicates |
| REPEATABLE READ or SERIALIZABLE insert | 0A000, no row; retry only in a new READ COMMITTED transaction |

For the expiry-wait case, owner setup may shorten a test fixture's expiry solely
for the test. Hold `pg_advisory_xact_lock(150005,2)` in A; start B's authenticated
INSERT; release A after the fixture expires. Verify B does not depend on Cron.
For removal, hold the same lock in A, commit a test removal in C, then release A.
These are staging fixtures, not changes to production TTL/lifecycle rules.

For authenticated HTTP checks, use test-user JWTs and the public anon key. Send
only reporter_id, event_type, latitude, longitude via the actual direct REST
INSERT path. Validate `code=P1501` and parse `details` as JSON containing the
existing UUID. Send spoofed reporter/derived fields and a banned-user request;
all must fail. Repeat via the phone to verify user-facing handling.

## Cleanup and evidence

Rollback any open transactions first. As owner, delete only the successful test
event IDs you recorded (and associated test votes if created), and restore any
test profile bans changed for the exercise. Never use a broad coordinate DELETE.
Keep timestamps, request counts, returned IDs, error codes/details, isolation
level, migration version, and before/after row counts. Remove JWTs, credentials,
and sensitive connection strings from saved output. A pass requires real waiting
and the post-commit duplicate result; sequential requests alone are insufficient.
