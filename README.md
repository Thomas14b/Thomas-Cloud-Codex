# 失敗學院 · Failure Monsters

Functional React/TypeScript game with Netlify Identity, Netlify Database (Postgres), Functions and AI Gateway. Includes a role-protected administrator dashboard.

- Email signup/login/recovery and persistent player profiles.
- Mission reservations, reflections, witness confirmation, card collection/sealing/trading, credits and reward redemption.
- Admin player search, progress, reflection/feedback views, mission/reward controls and fulfillment.
- Private AI guide via Gateway (`gpt-4.1-mini`), 20 attempts/player/day and 500/site/month. These are request caps, not a billing limit.
- Admin dashboard excludes private AI conversations. Infrastructure owners still control the database; this is not end-to-end encryption.

## Development

```sh
npm ci
npm test
npm run test:ui
npm run build
netlify dev
```

Identity requires a deployed Netlify site for real authentication. Browser tests use explicit transport fixtures; database tests execute the production migrations in PGlite.

See [setup](docs/SETUP.md), [implementation](docs/IMPLEMENTATION.md) and [verification](docs/VERIFICATION.md).
