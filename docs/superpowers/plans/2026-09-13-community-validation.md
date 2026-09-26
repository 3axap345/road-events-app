# Community Validation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, as requested. No commits or pushes.

**Goal:** Let authenticated community members confirm or mark an existing event gone.

**Architecture:** SECURITY INVOKER RPC plus equally protected direct writes; narrow SECURITY DEFINER triggers validate locked rows and maintain aggregates. A typed voting repository feeds a query/mutation hook and the existing compact card.

**Tech Stack:** Existing PostgreSQL/Supabase, TanStack Query, Zod, React Native, Vitest.

**Spec:** User-approved community validation requirements and invoker/direct-write design in this conversation.

## Global constraints

- Reuse event_votes, EventVoteType, and the existing auth gateway.
- No changes to lifecycle, TTL, status, confidence, reporting, or map behavior.
- No DELETE permission, optimistic counters, automatic mutation retries, dependencies, native changes, commits, or pushes.
- Current-user vote key: ['event-vote', eventId, userId]. Active events key: ['road-events', 'active'].
- Never send user_id to the RPC. Never expose IDs in product UI or errors.

## 1. Database protection

Files: supabase/migrations/0002_community_validation.sql; supabase/tests/community-validation.sql; docs/community-validation.md.

- [x] Write a rollback-only manual SQL verification script for confirm/gone insertion, repeated no-op, both switches, eligibility failures, spoofing, permissions, timestamps, and immutable lifecycle fields. The repo has no SQL execution harness; do not claim Vitest executes SQL.
- [x] Create cast_event_vote(p_event_id uuid, p_vote_type text) returning void. Validate nulls/type/auth/eligibility and use INSERT ON CONFLICT ... DO UPDATE SET vote_type = excluded.vote_type WHERE event_votes.vote_type IS DISTINCT FROM excluded.vote_type.
- [x] Enforce eligibility for direct writes through RLS and a BEFORE trigger; lock the profile and event during validation. Preserve vote identity and timestamps on no-op.
- [x] Maintain aggregate deltas in an AFTER trigger; only update confirmation_count, gone_count, last_confirmed_at. Handle privileged deletion/cascade without enabling client deletion. Revoke execution of internal functions and pin search_path.
- [x] Abort migration on inconsistent legacy counts or self-votes rather than silently rewriting existing data. Document remediation as an operator decision.
- [x] Review all grants, RLS, identity checks, no-op paths, and concurrent-write locking.

## 2. Voting service and query orchestration (TDD)

Files: src/features/voting/vote-repository.ts, vote-controller.ts, vote-card-model.ts, use-event-vote.ts; src/services/supabase/client.ts; tests/features/voting/*.test.ts.

- [x] Write failing tests for typed read/RPC boundaries, invalid inputs/outputs, both vote values, auth failure, database errors, retry:false, double taps, both query refreshes, and refresh-only retry after a successful write.
- [x] Run npm test -- tests/features/voting and confirm RED.
- [x] Implement the typed gateway (getUserId/read/cast), Zod parsing, mutation options, query refresh, and controller. Controller states are idle/submitting/refreshing/submit-error/refresh-error; refresh recovery performs reads without a new cast, including after card remount.
- [x] Test the card view model: counts, selected vote, reporter explanation, unavailable event, loading/error, and no selected-vote unvote action.
- [x] Run focused tests to GREEN and self-review.

## 3. Existing details card integration

Files: src/features/map/EventDetailsCard.tsx, MapScreen.tsx; src/features/voting/EventVoteDetails.tsx; tests/features/voting/event-details-card.test.tsx. Existing map-screen-model.ts needed no modification.

- [x] Add tests against the real presentational card using mocked native primitives (no React Native runtime under Node). Check counts, selected states, callbacks, and disabled/reporter behavior.
- [x] Pass the selected event to a keyed container that owns useEventVote; keep the existing card presentational and Supabase out of MapScreen/card.
- [x] Render counts, Confirm / No longer there, selected accessibility state, neutral own-event message, loading, and explicit read/write retry. Keep the current visual language and close behavior.
- [x] Run npm test -- --run, npm run typecheck, npm run lint, git diff --check. Inspect the full diff and report SQL/device checks not executed.

## Verification record

- Baseline: 90 tests passing.
- New focused voting tests: 31 passing; full suite: 121 passing.
- Typecheck, lint, and git diff --check: passed.
- Independent read-only review found a card-remount stale-selection window.
  Added RED/GREEN regressions, background-read guards, and restored read-only
  recovery; the reviewer's bounded recheck passed.
- SQL script and migration received static review only; not run on PostgreSQL
  or applied to Supabase. Native UI/device testing remains manual.
- No dependency/config changes, commits, or pushes.
