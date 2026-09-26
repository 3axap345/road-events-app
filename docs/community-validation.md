# Community validation: deployment and verification

This increment adds `confirm` / `gone` voting only. It does not expire, remove,
extend, re-score, or otherwise change an event's lifecycle. No automatic mutation
retries, optimistic counters, cooldowns, or Realtime are introduced.

## Deployment

1. Back up the database and use a staging Supabase project first.
2. Verify migration `0001_initial_schema.sql` is already installed.
3. Run the preflight queries below. Resolve any historical inconsistency as a
   separate, reviewed operator decision; do not blindly zero counters/delete votes.
4. Apply `supabase/migrations/0002_community_validation.sql` through the project's
   migration process (or run the complete file in SQL Editor). It is transactional.
   Do not apply the new app UI before the RPC is deployed.
5. Run the rollback-only verification script described below.
6. Reload the existing Android development client through Metro and perform the
   two-user checks. This increment adds no native dependencies/configuration and
   needs no EAS build. The earlier AsyncStorage native dependency must already
   exist in that build.

No migration has been applied to a remote project by this implementation.

### Preflight: existing data

Run in SQL Editor as the administrator:

```sql
select e.id, e.confirmation_count, e.gone_count,
       coalesce(v.confirmations, 0) as actual_confirmations,
       coalesce(v.gone, 0) as actual_gone
from public.road_events e
left join (
  select event_id,
    count(*) filter (where vote_type = 'confirm') as confirmations,
    count(*) filter (where vote_type = 'gone') as gone
  from public.event_votes group by event_id
) v on v.event_id = e.id
where e.confirmation_count <> coalesce(v.confirmations, 0)
   or e.gone_count <> coalesce(v.gone, 0);

select v.event_id, v.user_id
from public.event_votes v join public.road_events e on e.id = v.event_id
where v.user_id = e.reporter_id;
```

Both result sets must be empty. Migration 0002 refuses inconsistent counters or
self-votes. It neither deletes votes nor reconciles historical aggregates.

## Database write contract

App calls:

```sql
select public.cast_event_vote('<event UUID>'::uuid, 'confirm');
-- or 'gone'
```

The RPC is SECURITY INVOKER, returns void, and derives the voter only from
`auth.uid()`. The normal SQL Editor administrator session has no app identity;
calling it there without simulated claims must fail.

Authenticated users retain SELECT of their own vote rows, INSERT of only
`event_id,user_id,vote_type`, and UPDATE of only `vote_type`. This is necessary
for the invoker RPC. Direct writes remain possible but have the same eligibility
protection. DELETE/TRUNCATE and timestamp/identity edits are not granted.

RLS and `prepare_event_vote` reject missing/mismatched identity, missing/banned
profile, own-event voting, non-active status, and expiry. The privileged BEFORE
trigger locks the profile and event, rechecking eligibility after waiting for
locks. RLS may filter an ineligible direct UPDATE to zero rows rather than throw;
it must never change the vote or its aggregates.

The UPSERT uses the existing `(event_id,user_id)` unique constraint. Identical
votes do not update the row or timestamps. Switching preserves the row ID.
The AFTER trigger changes only these fields:

| Change | confirmation_count | gone_count | last_confirmed_at |
| --- | --- | --- | --- |
| insert confirm | +1 | unchanged | now() |
| insert gone | unchanged | +1 | unchanged |
| confirm → gone | -1 | +1 | unchanged |
| gone → confirm | +1 | -1 | now() |
| same vote | unchanged | unchanged | unchanged |

Administrator/FK deletion subtracts the removed vote without enabling client
unvote. The timestamp remains the historical last confirmation; deletion/gone
does not reset it. Atomic updates and existing nonnegative CHECK constraints
prevent negative counters: inconsistent data fails the transaction instead of
being silently clamped. Both internal trigger functions have fixed empty
search_path, qualified application objects, and no PUBLIC/anon/authenticated
EXECUTE. The RPC has EXECUTE granted only to authenticated (plus its owner).

## Manual SQL verification

Use **staging**, with two existing Auth users. The script temporarily unbans the
fixture users inside a transaction, creates an event, tests real policies/RPCs/
triggers, then rolls everything back. Never paste access/refresh tokens.

1. Open `supabase/tests/community-validation.sql`.
2. Run the entire file in SQL Editor as administrator, after applying 0002.
3. Expect `All community validation checks passed; rolling back fixtures` and
   no SQL errors. Any exception is a failure; if the editor retains the failed
   transaction, run `ROLLBACK;` before retrying.
4. No fixture vote/event or profile change should remain after rollback.

The script sets local JWT claims and role to simulate authenticated/anonymous
requests; it does not bypass RLS for the client operations. It checks insert
confirm/gone, no-op RPC/direct UPDATE (including unchanged physical tuples),
both switches, immutable row identity, self-voting, bans, every inactive status,
exact expiry, invalid inputs, unauthenticated calls, spoofing, own-only SELECT,
counter tampering, timestamp tampering, DELETE permission, internal function
execution, and unchanged lifecycle fields. Counts and selection are additionally
checked in client tests, but those tests are not proof of SQL execution.

Audit installed functions and privileges:

```sql
select p.proname, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('cast_event_vote','prepare_event_vote','apply_event_vote_counters');
-- RPC: prosecdef=false. Internal triggers: true. All have a fixed search_path.

select signature,
  has_function_privilege('authenticated', signature, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', signature, 'EXECUTE') as anon_execute
from (values ('public.cast_event_vote(uuid,text)'),
             ('public.prepare_event_vote()'),
             ('public.apply_event_vote_counters()')) f(signature);
-- Expected: true/false for RPC; false/false for internal functions.

select has_table_privilege('authenticated','public.event_votes','DELETE') as can_delete,
       has_table_privilege('authenticated','public.event_votes','TRUNCATE') as can_truncate,
       has_column_privilege('authenticated','public.road_events','confirmation_count','UPDATE') as can_edit_confirmations,
       has_column_privilege('authenticated','public.road_events','gone_count','UPDATE') as can_edit_gone,
       has_column_privilege('authenticated','public.event_votes','user_id','UPDATE') as can_change_voter;
-- All false.

select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public' and tablename='event_votes';
-- Own SELECT + eligible INSERT + eligible UPDATE. No DELETE/ALL policy.
```

### Concurrent calls (two SQL Editor sessions, staging only)

Choose one active unexpired event and one non-banned non-reporter user. Substitute
their UUIDs in both sessions. No tokens are needed. To avoid production effects,
use a disposable staging event, and record its starting counts.

Session A:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<voter UUID>', true);
select public.cast_event_vote('<event UUID>', 'confirm');
-- Leave transaction open, then start session B.
commit;
```

Session B (start before A commits):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<same voter UUID>', true);
select public.cast_event_vote('<same event UUID>', 'confirm');
commit;
```

After A commits, B should complete as a no-op: one row, one effective confirmation.
Repeat with distinct eligible users to check both increments are retained.
Arbitrary concurrent multi-row direct writes may deadlock due to lock ordering;
PostgreSQL rolls back a participant. This is a retryable *failed write*, not an
automatic application retry, and must not produce partial aggregate updates.

## Client architecture and failure behavior

`getEventVotesGateway` centralizes `.from('event_votes')` and `.rpc(...)`.
`vote-repository.ts` validates inputs and external rows with Zod, reuses domain
EventVoteType, and checks the existing authenticated-user boundary before casting.
Only `p_event_id` and `p_vote_type` go to the RPC.

`useEventVote` resolves identity through the existing auth gateway, reads the
selected event's vote, and wires a pure operation controller to TanStack Query.
`EventVoteDetails` is keyed by event ID and feeds the presentational
`EventDetailsCard`. MapScreen owns selection as before and calls no Supabase API.

- Identity query: `['event-vote-user']` (read only, no automatic retry).
- Vote query: `['event-vote', eventId, userId]`.
- Vote mutation: `['cast-event-vote', eventId, userId]`, `retry: false`.
- After success: invalidate/refetch the exact vote key and exact
  `['road-events','active']` key, including cached queries whose card was closed.
- Both reads are awaited. A failed read sets a distinct saved-but-refresh-failed
  state with **Retry refresh**, which only performs reads.
- Failed writes preserve the last server-provided selection/counts and offer
  an explicit retry; a lost response is safe to retry because the RPC is idempotent.
- The synchronous controller guard prevents duplicate taps; pending mutation
  lookup additionally protects a close/reopen while the write is pending.
  Background vote/event reads keep the reopened card disabled until refreshed;
  cached successful mutation status restores refresh-only recovery after remount.
- Counts and selected styling come only from query responses, never optimistic deltas.
- Missing/loading identity or vote, query failure, pending operation, own event,
  and inactive/expired events prevent voting. Bans are enforced authoritatively
  by the database rather than maintaining a second client profile store.

## Physical Android verification

Use two different persisted anonymous users (two installations/devices). Do not
clear the app's storage to switch users on your primary test installation.

1. User A reports an event. Its card shows zero counts and the reporter explanation,
   without vote actions. Close, another marker, and long-press reporting still work.
2. User B opens the event: both actions are available after the vote query loads.
3. Tap Confirm rapidly twice. After refresh: one confirmation, Confirm selected.
4. Tap Confirm again: totals unchanged. Switch to No longer there: confirmation
   decreases by one, gone increases by one. Switch back: inverse change.
5. Reopen the card and force-stop/relaunch: B's vote is restored from Supabase.
6. Go offline before a vote: counts/selection do not change; retry appears.
   Reconnect and explicitly retry.
7. If network drops after the RPC succeeds but before reads complete, expect
   the saved/refresh-error message. Retry refresh must not send another RPC.
   Use development network inspection to distinguish this from a lost RPC response.
8. Verify 48-point actions, readable selected/disabled states, large font scaling,
   safe-area placement, map gestures, attribution, and no overlap with controls.

Native pixel/layout/touch behavior and SQL security require these real checks;
Node tests use native primitive doubles and cannot establish either.

## Remaining security boundaries

- Anonymous identities are installation/session identities, not one-person proof.
  Clearing app data can create another identity. No Sybil protection/cooldown is
  added here, as requested.
- Existing profiles must be present; voting fails closed if a profile is missing.
- Privileged administrators/service-role can change protected data; never ship
  those credentials. Keep project schema CREATE privileges restricted.
- Direct INSERT/UPDATE is intentionally permitted only under column grants,
  RLS, constraints, and validation triggers. It is not an RPC-only deployment.
- Audit remote policy/grant drift before rollout; local files cannot prove the
  live project's configuration or custom triggers match the repository.
