# Approved minimal lifecycle implementation / progress

Scope: four-hour fixed TTL; no extensions, no automatic stale transitions or confidence changes; gone >= 3 and gone > confirmations removes early; server-owned vote-trigger transitions and minute Supabase Cron expiration; foreground/resume refresh. No live migration, commit, push, dependencies or native changes.

## Execution ledger

1. Inspect schema/votes/read/auth/domain contracts — complete.
2. Write lifecycle/foreground/read-boundary tests, verify RED — complete (old stale/removal rules, missing refresh module, phone-time read chain).
3. Implement transactional lifecycle, bounded sweep, server-time RLS and named Cron registration — drafted; local SQL runtime unavailable, staging execution still required.
4. Implement foreground refresh and server-time read boundary — focused tests and typecheck passed.
5. Add executable rollback SQL, Cron audit, rollout/device/concurrency guidance — complete.
6. Full verification — 129/129 tests passed; typecheck, lint and git diff --check passed. Read-only whole-change review found no blocking defects. PostgreSQL/Cron execution, concurrent SQL sessions, and physical-device refresh remain unverified and required on staging.

## Rulings

- No new architecture or state/UI changes. Keep auth/report/vote APIs, query keys and privilege checks.
- SQL is authoritative; align the existing unused pure lifecycle evaluator without changing confidence calculation.
- Cron extension provisioning is explicit prerequisite; scheduling migration fails clearly if absent.
- Server-time filtering requires database-before-client deployment.
- No SQL runtime found locally; do not pretend SQL checks or device checks ran.
- Final review exclusions accepted: live/staging database and device execution are unavailable in this task, explicitly documented rollout gates rather than claimed successes.
