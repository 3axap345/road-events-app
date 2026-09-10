# Driver Community Map — Design

## Purpose and scope

Build the first verified vertical slice of an anonymous-first, community-driven road-events map. The app opens directly to a map, asks for foreground location access, loads active events from Supabase, renders markers, and shows a compact event card when a marker is selected.

This slice deliberately excludes the reporting and voting UI. The database and domain APIs make those later features safe to add without coupling map UI to business rules.

## Platform and delivery

Use Expo managed workflow with Continuous Native Generation and EAS development builds. Android is the MVP priority; iOS remains supported. No `android/` or `ios/` directories are committed. Native configuration belongs in Expo app config and config plugins.

The client uses React Native, Expo Router, TypeScript strict mode, TanStack Query, Zustand only for UI-local selected-event state, Zod, and Supabase. Tests use Vitest and React Native Testing Library.

## Map and location decision

Use `react-native-maps` behind a `MapProvider` interface. On Android, configure Google Maps with an Android-restricted Google Maps key injected at build time. On iOS, leave the provider unset so `react-native-maps` uses Apple Maps. This is compatible with Expo development builds and isolates a later provider switch to the map feature.

Use `expo-location` for foreground location only. When permission is granted, center on the current coordinate. When it is denied, unavailable, or fails, render the map and events around the fixed Bishkek default region and show a concise recoverable notice. The app never requests background location in this slice.

## Feature boundaries

- `src/features/map`: provider-neutral view models, `MapProvider`, marker rendering, selected-event card, and the map screen composition.
- `src/features/location`: permission/status adapter returning a typed location state; no map or event business logic.
- `src/features/events`: Zod parsing, Supabase event repository, event query hook, pure lifecycle/scoring/duplicate functions, and types.
- `src/services/supabase`: singleton Supabase client and environment validation.
- `src/stores`: selected marker ID only; server data stays in TanStack Query.
- `src/components`: generic presentation components only.

React components coordinate rendering and user interaction; they do not calculate distance, scoring, expiry, or duplicate decisions.

## Data model and access control

Create `profiles`, `road_events`, and `event_votes` in an idempotent Supabase migration.

- Every authenticated (including anonymous) user has a profile row. Profile creation is server-triggered from `auth.users`.
- `road_events` stores its creator, type, coordinates, state, score/counters, creation/freshness and expiry timestamps. State and enum-like fields use check constraints. Coordinates are constrained to valid latitude and longitude ranges. Map-oriented indexes cover active status and expiry; creator and event-vote lookup indexes support later interactions.
- `event_votes` has a `unique(event_id, user_id)` constraint and permits `confirm` or `gone` only.
- RLS allows active-event reads to authenticated users. It permits event creation and voting only when the caller owns the row and does not have a banned profile. It forbids client updates of confidence/counter/status lifecycle fields and direct changes to another user's vote. A security-definer RPC is reserved for future validated vote mutations; it is not called by this slice.

No security-sensitive aggregate or trust value is trusted from the mobile client. Database-side triggers or privileged server functions own derived counts in the reporting/voting slice.

## Lifecycle and duplicate domain model

Event states are `active`, `stale`, `removed`, and `expired`. Constants define initial confidence, confirmation and negative-vote deltas, stale horizon, expiry TTL, removal threshold, and duplicate radius. Pure functions calculate confidence, freshness/state, expiry, Haversine distance, and same-type nearby duplicates. These functions receive their configuration explicitly or from a single constants module so thresholds can change without a rewrite.

Duplicate detection returns either `no-duplicate` or `nearby-duplicate` with the existing event and distance; later reporting UI can offer confirmation rather than creating another marker. The database remains authoritative for concurrent duplicate creation in the future.

## Authentication

The app starts without a registration wall. On launch, an auth bootstrapper restores a session or signs in anonymously through Supabase. The auth boundary exposes a typed session state and retains a provider-agnostic account-linking seam for phone, Google, and Apple later. This slice may render a recoverable backend-configuration state when Supabase variables are absent, but the map's denied-location flow remains functional.

## UI states and interaction

The root route is the map. It has a full-screen map, an accessible location-state notice when appropriate, a selected-marker card anchored at the bottom, and a loading/error/empty overlay for events. Markers encode event type and stale status in a compact, touch-friendly form. The event card contains type, relative age, confirmation count, and last confirmation time when present. It is dismissible and is usable one-handed.

## Verification

Tests cover confidence, freshness, expiry, vote de-duplication guard, Haversine distance, duplicate detection, and permission-independent location fallback decision. Component tests cover the event card and map-state rendering with mocked provider and query data. The delivery runs dependency install, typecheck, lint, tests, Expo config validation, and EAS development profile validation. Real map rendering, native permission prompts, device GPS, Google Maps key restrictions, and iOS Apple Maps must additionally be validated in Android and iOS development builds.
