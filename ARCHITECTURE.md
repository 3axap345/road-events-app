# Architecture

## Feature-oriented structure

The project is structured by feature and keeps UI composition distinct from domain and platform adapters.

```text
src/
  app/                 Expo Router routes and app providers
  components/          Generic presentational components
  constants/           Shared immutable configuration
  features/
    auth/              Anonymous session bootstrap and future account linking seam
    events/            Event schemas, repository, queries, lifecycle, scoring, duplicates
    location/          Foreground-permission and current-location adapter
    map/               Provider-neutral map port and SDK adapter
    voting/            Future vote UI/application boundary
    profile/           Future profile boundary
  services/
    supabase/          Validated environment and singleton client
  stores/              Zustand UI-only state
  types/               Cross-feature types only when feature ownership is unsuitable
  utils/               Small pure generic helpers
supabase/
  migrations/          PostgreSQL schema, constraints, policies, functions
  functions/           Privileged server-only operations when needed
  seed.sql             Safe local development seed data
tests/                 Unit and component tests
```

React components compose state and rendering only. Complex business rules live in pure feature functions; Supabase access is centralized; Zod validates external data; strict TypeScript interfaces define every client boundary. Avoid giant components, duplicate utilities, and premature abstractions.

## Map provider abstraction

`features/map` defines provider-neutral regions, markers, callbacks, and a `MapProvider` component contract. The current adapter uses `@maplibre/maplibre-react-native` on both Android and iOS. No event-domain type imports a map SDK.

MapLibre is integrated through the Expo config plugin and requires a development build. The basemap uses OpenFreeMap Liberty at `https://tiles.openfreemap.org/styles/liberty`, with no API key or additional environment variables. Changing the style alone does not require rebuilding the development client. MapLibre's attribution control exposes the style's OpenMapTiles and OpenStreetMap attribution; it is positioned above the bottom event card and below the top notices. OpenFreeMap's public service does not provide an SLA.

The adapter converts provider-neutral `MapRegion` values into MapLibre bounds and maps application marker coordinates into MapLibre longitude/latitude order. A future tile or map-provider change remains isolated to the adapter and configuration layer rather than the event lifecycle, repository logic, or screen state.
## Supabase and data access

The client exposes one validated Supabase client with public URL and anon key only. Auth restores a session or signs in anonymously; later phone, Google, and Apple linking attaches to the same boundary.

Database access is protected with PostgreSQL constraints, indexes, Supabase Auth, and RLS. `profiles` tracks account trust and bans; `road_events` stores user-owned reports and server-derived lifecycle values; `event_votes` has `unique(event_id, user_id)`. Clients may not directly edit derived confidence/count/status fields, other users' votes, or bypass RLS. Sensitive derived mutations belong in database triggers, RPCs, or server functions.

## Event lifecycle

Road event states are `active`, `stale`, `removed`, and `expired`. New reports have a fixed four-hour TTL assigned by PostgreSQL. Confirmation updates counts and `last_confirmed_at`, but never extends TTL or changes confidence. The vote aggregate trigger removes an active event transactionally when `gone_count >= 3 AND gone_count > confirmation_count`, using post-vote totals. Removed and expired states are terminal. Automatic stale transitions are deferred; existing stale rows still expire.

The owner-only `sweep_road_event_lifecycle()` processes up to 500 due rows per minute through Supabase Cron, skipping locked rows for the next run. It expires active/stale rows and reconciles preexisting removal candidates. SELECT RLS hides expired rows using server time even before the scheduled update. No client can mutate lifecycle fields. The pure TypeScript lifecycle evaluator mirrors the rules for tests; it does not write status. Legacy confidence utilities are not used by the vote/lifecycle write path.

Active events refresh every 60 seconds while foregrounded and immediately on resume; timers/listeners are cleaned up on unmount. The existing query key and mutation refresh paths are unchanged. See `docs/event-lifecycle-validation.md` for migration order, executable SQL checks, concurrency checks, and Cron operations.

## Data flow

Duplicate creation is guarded by migration 0005's SECURITY INVOKER BEFORE INSERT
trigger: same type, active/unexpired, spherical distance <=150m. A transaction
advisory lock per type precedes a fresh READ COMMITTED lookup; other isolation
levels fail closed. Direct INSERT grants/RLS and lifecycle/voting rules remain
unchanged. Structured duplicate errors return an existing ID, which the client
can load, focus, and open without voting. See `docs/duplicate-prevention-validation.md`
and `docs/duplicate-prevention-concurrency.md` for SQL/device/concurrency checks.

On launch, Expo Router renders the map route. The auth boundary establishes anonymous access, location requests foreground permission, and the event query requests active non-expired events through the Supabase repository. TanStack Query owns server state; Zustand holds only interaction state such as a selected marker. The map adapter receives normalized marker view models and returns marker selection to the screen.

Denied, unavailable, or failed location resolves to the fixed Bishkek region. Network errors and empty event data remain explicit screen states and do not make the map unusable.

## Verification boundaries

Unit tests cover lifecycle, scoring, expiration, duplicate-vote guards, distance, duplicate detection, and permission-independent fallback. React Native Testing Library covers presentation and composed loading/empty/error states.

Automated verification covers dependency installation, TypeScript, linting, tests, public Expo config, and EAS profile shape. Physical development builds must still verify MapLibre rendering on Android and iOS, Android permission and GPS behavior, iOS permission copy, and real Supabase Realtime delivery. No claim about those device behaviors is made until tested on their target hardware.

## Development build validation

The development-build setup is validated in two layers.

### Automated checks

The automated test suite verifies configuration contracts that can be checked without building or launching a native application:

- EAS development profiles exist.
- The standard development profile uses `developmentClient: true`.
- Android development builds are configured as APKs.
- The regular iOS development profile targets physical devices.
- A separate iOS simulator development profile exists.
- `expo-router` is configured as an Expo plugin.
- `expo-location` is configured with a foreground location permission message.
- `@maplibre/maplibre-react-native` is configured as an Expo plugin.
- TypeScript, ESLint, and the unit test suite pass.

Run:

```powershell
npm run lint
npm run typecheck
npm test
npx expo-doctor
npx expo install --check
```
