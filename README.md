# 失敗學院 · Failure Monsters

Functional React + TypeScript web app with Supabase Auth/Postgres and a server-side OpenAI guide. Includes the administrator player-data dashboard.

## Implemented

- Email signup/login/recovery; account-scoped persistent progress.
- Six original missions, 24-hour reservations, server-enforced scarcity, separate-account witness confirmation, private-to-peers reflections.
- Immutable card-use ledger, permanent sealing, atomic two-party exchanges, ten-level family progression.
- Points, stock-limited rewards, idempotent redemption and single-use admin fulfillment.
- Live AI request implementation with authenticated access, consent, saved history, 20-request daily quota and explicit provider errors.
- Admin dashboard: player search, stages, levels, reflections, feedback, charts, paginated CSV export, mission/QR and reward management.
- Administrators may read game reflections and feedback; AI conversations are excluded from admin access.
- Responsive interface and PWA app shell. Online connection is required for gameplay writes and AI.

## Start

```sh
npm ci
cp .env.example .env.local
npm run dev
```

See **[完整設定指引](docs/SETUP.md)** for Supabase migrations, authentication URLs, AI secrets, administrator provisioning, deployment and live acceptance checks.

No cloud accounts have been provisioned for this implementation. Without configuration the app shows an honest setup screen; it does not simulate working accounts, data or AI. Six seed missions permit Level 1 per family; admins can add further missions to reach Level 10.

## Verify

```sh
npm test
npm run build
npm run test:ui
```

SQL/RLS tests run in PGlite. Browser transport fixtures and AI provider substitutes are tests only; they are not shipped in the application. Actual Supabase/OpenAI integration and multi-connection concurrency checks remain part of cloud setup acceptance.

- [Implementation decisions](docs/IMPLEMENTATION.md)
- [Setup and live acceptance](docs/SETUP.md)
- [Verification results](docs/VERIFICATION.md)

The former prototype remains in Git history. The prior room studio is preserved on branch `backup-before-failure-monsters-20261014`.
