# 失敗學院 · Failure Monsters

Mobile-first Season 1 **prototype**, replacing the previous room studio on the main branch.

## Run

Serve this folder with any static HTTP server, e.g. `python3 -m http.server 8080`, then open the local URL.

## Demo

Six missions, one for each spirit family; QR deep links use `?mission=HK006` etc. Progress uses localStorage only. Bobo is a scripted demo, not a live AI. Duo verification, multi-account ownership, server-enforced card uses, permanent sealing, trading, rewards and full 10-level progression are **not implemented**. Never use the prototype's local usage counter to issue real limited-edition cards or prizes.

## Roadmap

1. React + TypeScript PWA and character assets.
2. Auth, database, immutable card-use ledger, server-side atomic reservations and sealing.
3. Separate witness account for duo validation; private reflection owned by player.
4. Real AI guide with privacy safeguards and usage limits.
5. Printable QR codes linked to the final test domain, redemption and admin tools.

## Historical source

The prior project is preserved on branch `backup-before-failure-monsters-20261014`.
