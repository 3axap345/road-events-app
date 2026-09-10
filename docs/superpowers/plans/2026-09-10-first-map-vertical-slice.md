# First Map Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the verified initial slice: map, current location, active events, markers, and selected-event card.

**Architecture:** Expo Router composes feature modules. A `MapProvider` isolates react-native-maps; event lifecycle, scoring, votes, and duplicate logic are pure functions. Supabase reads are parsed by Zod and reach UI through TanStack Query.

**Tech Stack:** Expo managed/CNG, EAS, React Native, TypeScript strict, Expo Router, react-native-maps, expo-location, Supabase, Zustand, TanStack Query, Zod, Vitest, React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-10-driver-community-map-design.md`

## Global Constraints

- Do not commit `android/` or `ios/`; use Expo config plugins and EAS development builds.
- Android selects Google Maps; iOS retains Apple Maps; no domain module imports a map SDK.
- The fallback region is Bishkek. Denied/unavailable location does not block the map.
- Add no reporting/voting UI, route planning, chat, or onboarding.
- Do not use `any`, service-role credentials, or client-controlled confidence/count/status fields.
- Run install, typecheck, lint, unit/component tests, Expo config, and EAS config checks.

### Task 1: Create the typed Expo foundation and development-build configuration

**Files:** Create `package.json`, `tsconfig.json`, `eslint.config.js`, `prettier.config.cjs`, `vitest.config.ts`, `app.config.ts`, `eas.json`, `.env.example`, `.gitignore`, `babel.config.js`, `src/app/_layout.tsx`, `src/app/index.tsx`, `tests/test-setup.ts`.

**Produces:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run expo:config`; public Supabase URL/key and build-time Android Maps key environment names.

- [ ] Write project scripts and strict compiler configuration.
- [ ] Add a failing config test asserting a development client profile and both `expo-location` and `react-native-maps` plugins.
- [ ] Configure CNG: Android Google key from `GOOGLE_MAPS_ANDROID_API_KEY`; iOS gets no Google provider; use foreground-only location copy.
- [ ] Configure EAS `development` with `developmentClient: true`, internal distribution, Android APK, and iOS simulator/device profiles as appropriate.
- [ ] Run `npm install`, `npm run typecheck`, and `npm run expo:config`; fix all config/type failures.
- [ ] Commit: `git add . && git commit -m "chore: scaffold Expo development-build app"`.

### Task 2: Add required product and architecture documents

**Files:** Create `PRODUCT.md`, `ARCHITECTURE.md`, `AGENTS.md`; test `tests/documentation.test.ts`.

**Produces:** durable scope, UX, abuse prevention, event lifecycle, boundary, RLS, and verification instructions.

- [ ] Write a failing test that searches document headings for product purpose, target user, MVP scope, core flow, event types, exclusions, UX/abuse principles, success criteria, provider abstraction, and agent rules.
- [ ] Draft `PRODUCT.md` with all user-specified exclusions and no traffic-evasion positioning.
- [ ] Draft `ARCHITECTURE.md` with the feature tree, data flow, map decision, Supabase/RLS approach, lifecycle configuration and Android/iOS device verification limitations.
- [ ] Draft `AGENTS.md` with all 18 requested engineering guards, including no bypass of RLS, vote uniqueness, nearby duplicate detection and verification.
- [ ] Run `npm test -- tests/documentation.test.ts`, then commit: `git add PRODUCT.md ARCHITECTURE.md AGENTS.md tests/documentation.test.ts && git commit -m "docs: define driver map MVP"`.

### Task 3: Create secured Supabase schema

**Files:** Create `supabase/migrations/0001_initial_schema.sql`, `supabase/seed.sql`; test `tests/database-schema.test.ts`.

**Produces:** profiles, road_events, and event_votes with constraints/indexes/RLS.

- [ ] Write a failing migration-contract test for all three tables, `unique(event_id, user_id)`, allowed types/statuses/votes, coordinate bounds, expiry/status indexes, RLS enablement, banned-profile checks, and denial of aggregate-field manipulation.
- [ ] Create the migration: trigger profile creation from `auth.users`; `profiles(id uuid primary key references auth.users)`, `road_events`, and `event_votes` with `on delete cascade` foreign keys.
- [ ] Add active-event map/expiry and event-vote user/event indexes; check latitude `between -90 and 90`, longitude `between -180 and 180`, active/stale/removed/expired states, and confirm/gone votes.
- [ ] Implement RLS: authenticated users read active events; a non-banned owner can insert an event; non-banned users may insert only their own vote; users may not update/delete another vote. Revoke direct update privilege from derived road-event fields.
- [ ] Add only safe Bishkek active seed rows; run `npm test -- tests/database-schema.test.ts` and commit.

### Task 4: Implement event domain modules test-first

**Files:** Create `src/features/events/types.ts`, `constants.ts`, `event-schema.ts`, `event-lifecycle.ts`, `event-distance.ts`, `event-duplicates.ts`, `vote-guard.ts`; tests under `tests/features/events/`.

**Produces:** `RoadEvent`, `calculateConfidence`, `getEventState`, `isExpired`, `distanceMeters`, `findNearbyDuplicate`, `canCastVote`.

- [ ] Write failing cases: confirmation adds configured confidence; gone subtracts it; stale horizon marks stale; TTL expires; removal threshold removes; a pre-existing vote is denied; coincident Bishkek coordinates have zero distance; only same-type active nearby reports match.
- [ ] Implement typed Zod parsing and configurable lifecycle constants.
- [ ] Implement Haversine distance and `findNearbyDuplicate(candidate, events, radiusMeters)` returning either `{ kind: 'no-duplicate' }` or `{ kind: 'nearby-duplicate', event, distanceMeters }`.
- [ ] Run `npm test -- tests/features/events` and `npm run typecheck`; commit domain code and tests.

### Task 5: Add Supabase client, anonymous session, and active-event request

**Files:** Create `src/services/supabase/env.ts`, `client.ts`, `src/features/auth/anonymous-session.ts`, `src/features/events/event-repository.ts`, `use-active-events.ts`; tests `tests/features/auth/anonymous-session.test.ts`, `tests/features/events/event-repository.test.ts`.

**Produces:** `ensureAnonymousSession`, `getActiveEvents`, and `useActiveEvents`.

- [ ] Write failing mocks asserting `road_events` is queried with `status = active` and non-expired filter, response rows pass through Zod, errors reach Query state, and no aggregate writes are attempted.
- [ ] Implement validated `EXPO_PUBLIC_SUPABASE_URL` / anon key access and a single client.
- [ ] Restore existing session or call `signInAnonymously`; implement read-only `getActiveEvents` and bounded-stale-time query hook.
- [ ] Run focused tests and commit.

### Task 6: Add foreground location and provider-neutral map boundary

**Files:** Create `src/constants/regions.ts`, `src/features/location/location-types.ts`, `location-service.ts`, `location-fallback.ts`, `use-current-location.ts`, `src/features/map/map-types.ts`, `MapProvider.tsx`, `react-native-map-provider.tsx`; tests `tests/features/location/`.

**Produces:** `BISHKEK_REGION`, `resolveInitialRegion`, `useCurrentLocation`, and typed `MapProvider` props.

- [ ] Write failing tests for granted, denied, unavailable, and error states. Every non-granted state returns Bishkek without map imports.
- [ ] Implement foreground permission request only and a discriminated result (`loading`, `granted`, `denied`, `unavailable`, `error`).
- [ ] Define provider-neutral marker/region interfaces. Implement the adapter with `PROVIDER_GOOGLE` solely on Android and no iOS provider override.
- [ ] Run `npm test -- tests/features/location && npm run typecheck`; commit.

### Task 7: Build and test the map screen

**Files:** Create `src/stores/map-selection-store.ts`, `src/features/map/EventMarker.tsx`, `EventDetailsCard.tsx`, `MapScreen.tsx`, `src/components/StateOverlay.tsx`; modify `src/app/_layout.tsx`, `src/app/index.tsx`; tests `tests/features/map/`.

**Produces:** direct-to-map route, location/user marker, active-event markers, compact selected-event card, loading/empty/error/denied overlays.

- [ ] Write RNTL tests with mocked provider/query/location hooks: the card must show event type, relative age, confirmation count and optional last-confirmed time; denied location leaves map mounted; tap selects and dismissal clears marker.
- [ ] Implement a Zustand store containing only selected event id.
- [ ] Implement accessible touch targets and an anchored, dismissible card; components format presentation data but do not calculate lifecycle/duplicate rules.
- [ ] Mount QueryClient/auth bootstrap in layout and `MapScreen` at `/`; add no tabs or report/vote route.
- [ ] Run `npm test -- tests/features/map`, `npm test`, `npm run lint`, and `npm run typecheck`; commit.

### Task 8: Final configuration validation and device test guide

**Files:** Create `README.md`, test `tests/eas-config.test.ts`; modify `ARCHITECTURE.md`.

**Produces:** reproducible commands plus explicit native validation checklist.

- [ ] Test EAS development profile and required app config plugin keys.
- [ ] Document exact commands: `npm install`, `npx eas build --platform android --profile development`, `npx expo start --dev-client`; name the required environment variables and their secret handling.
- [ ] State device-only checks: Android Google Maps key restriction/rendering and foreground location prompt/GPS; iOS Apple Maps rendering and permission prompt; Supabase Realtime delivery once configured. Do not claim them executed without a built app/device.
- [ ] Run `npm install && npm run typecheck && npm run lint && npm test && npm run expo:config && npm run eas:validate`; report any authentication-only EAS limitation accurately; commit.

## Self-review

- The tasks cover every approved first-slice element: documents, database/RLS, pure lifecycle and duplicate logic, anonymous Supabase, location fallback, map abstraction, screen, tests, and verification.
- No reporting/voting UI, push, navigation, chat, media, payments, or unrelated features are introduced.
- All cross-task interfaces are named in their producer task and consumed only by the dependent task.
