# Verification — 2026-10-14

## Executed locally

- `npm test`: **12 passed**, 0 failed. Real SQL migrations/functions/RLS run in PGlite; tests cover role escalation prevention, single-award completion, peer privacy, separate witness validation, reservation capacity/expiry, card exchange authorization and locking, permanent sealing, reward debits/replay/fulfillment, admin-only dashboards, admin exclusion from AI chats, daily AI quota, and anonymous access denial. AI transport tests validate consent, length/history limits, `store:false` and provider-error behavior using test responses.
- `npm run build`: **passed**. Checks the React TypeScript app and Edge Function TypeScript (with a compile-time Deno host declaration), then creates production assets. Vite reports a non-fatal entry-chunk size advisory (~506 kB minified / ~151 kB gzip); admin UI is lazy-loaded.
- `npm run test:ui`: **5 passed**, 0 failed. Chrome browser tests cover labelled login/mobile overflow, mission reserve/submit UI, admin player details and feedback, explicit unavailable-AI handling with retained input, desktop/mobile home navigation, and absence of page JavaScript errors. Browser HTTP fixtures are used only in tests, never in production app code.
- Mobile home and administrator dashboard screenshots visually inspected.
- `git diff --check`: passed.
- Dependency installation audit: 0 vulnerabilities reported at installation time; this is not a comprehensive security audit.

## Not yet verified

No Supabase/OpenAI accounts were provided; the user explicitly chose implementation plus setup instructions. Therefore actual signup emails, hosted Supabase Auth/PostgREST, deployed Deno runtime, live OpenAI responses, cloud persistence across devices, Netlify settings/deployment, and multi-connection PostgreSQL concurrency have **not** been tested.

PGlite is a single-connection Postgres environment. Tests verify serialized transactional rules and row permissions; they do not establish load-test or real concurrent-connection results. The cloud acceptance checklist in SETUP.md includes contested last-slot reservations, overlapping exchanges and last-stock redemption.

No website has been deployed, no paid resource has been provisioned, and no secrets are included. AI chat provider failures consume one quota attempt; no automatic paid retries are made.

## Delivery boundaries

- Six original missions seeded; ten-level progression works with additional admin-authored missions. Level 10 content is not prewritten.
- Peer witness confirmation cannot prove real-world behavior or prevent one person creating multiple accounts.
- Game administrators can read game reflections/feedback, but not AI chats. Infrastructure administrators with direct database/service-key access remain privileged.
- The PWA caches its shell, not authenticated API data or offline mutations.
