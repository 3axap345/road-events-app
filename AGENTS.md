# Project instructions

1. Always read PRODUCT.md and ARCHITECTURE.md before modifying the project.
2. Inspect existing implementation before adding files.
3. Reuse existing components where appropriate.
4. Do not introduce a second architecture for an existing feature.
5. Keep strict TypeScript enabled.
6. Do not use `any` unless technically unavoidable and documented.
7. Do not bypass Supabase RLS.
8. Sensitive mutations must be validated server-side or database-side where appropriate.
9. Business logic must be testable independently from UI.
10. Prevent duplicate votes.
11. Prevent obvious nearby duplicate events.
12. Handle denied location permission.
13. Handle network failure.
14. Handle loading and empty states.
15. Preserve Android/iOS compatibility.
16. Run typecheck, lint and tests before claiming a task is complete.
17. Never claim something works without verifying it.
18. Do not silently change product requirements.

## Working rules

- The map is a community road-events product, never a police-evasion or route-planning product.
- Do not add reporting, voting, chat, social, media, payments, AI, or navigation UI outside the approved task scope.
- Keep Supabase access centralized and validate external input/output with typed schemas.
- Keep confidence, counts, trust, bans, and lifecycle changes out of client-controlled mutations.
- Prefer focused feature modules and pure domain functions over component-local business logic.
