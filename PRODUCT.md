# Driver Community Map

## Product purpose

Driver Community Map is a community-driven mobile map of current road events. It helps drivers see and verify practical road conditions near them; it is not a tool for evading law enforcement and is not a navigation product.

## Target user

The MVP serves drivers who want quick, local awareness of road checks, accidents, hazards, and closures while already travelling or planning a short trip.

## MVP scope

The MVP opens directly to a map, shows nearby active road events, lets an authenticated community member report an event, and lets other members later confirm or mark it gone. The first delivered vertical slice is intentionally narrower: map, foreground location, active-event fetch, markers, and a compact event card.

## Core user flow

Open app → map opens immediately → active nearby road events appear → user selects a marker → compact event details appear. The next MVP increment will add report type selection, location confirmation, and community confirmation/gone actions.

## Event types

- `road_check`
- `accident`
- `road_hazard`
- `road_closure`

## Out of scope

- Chat, comments, and social feed
- Photos and videos
- AI features
- Route planning or custom navigation
- Subscriptions and payments
- Friends or following
- Complex admin dashboard
- Any police-avoidance or enforcement-evasion guidance

## UX principles

- The app opens directly to the map with no mandatory onboarding or registration wall.
- Reporting should require as few taps as possible and never require a text description.
- Use large, one-handed touch targets and prioritize Android quality while preserving iOS compatibility.
- Make loading, error, empty, and location-denied states explicit and useful.
- Do not visually clone Easy Ride or Waze; road awareness must remain the product focus.

## Abuse prevention principles

- Anonymous-first access never means client-trusted mutations: server/database policy validates reports and votes.
- A user can vote once per event; duplicate nearby active reports of the same type should be redirected to confirmation.
- Banned accounts cannot report or vote.
- Confidence, counts, trust, and lifecycle state are derived server-side and never accepted from the client.
- Event data is limited to the minimum needed for road awareness; no social or media surface is introduced.

## MVP success criteria

- A development build opens directly to the map on Android and remains iOS-compatible.
- Foreground location centers the map when allowed; denied location falls back to Bishkek without blocking the app.
- Valid active Supabase events can be rendered as markers and opened as concise event details.
- Lifecycle, scoring, duplicate, and permission-independent logic are testable without UI or a device.
- Database access is guarded by Supabase Auth and Row Level Security.
