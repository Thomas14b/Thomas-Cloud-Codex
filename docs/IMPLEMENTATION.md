# Approved implementation — 2026-10-14

Goal: replace scripted Season 1 prototype with React/TypeScript app, Supabase Auth/Postgres and a live server-side AI guide. User approved single-agent implementation; no model switching or delegation. User has no cloud services yet: deliver implementation and setup guide, label cloud verification pending.

## Boundaries and contracts

- Frontend reads through RLS; mutations only through authenticated SQL functions. Keys for OpenAI/service role never ship to browser.
- Six existing missions retained. Global finite mission issuance limits 20/10/5; one attempt and card per player per mission. Reservations expire in 24 hours. Rejected attempts may retry; completed attempts cannot repeat for XP.
- Each unique completed mission gives 100 XP to its family. Ten levels at 100 XP increments, starting at level 1 upon first completion, maximum 10. More missions may be authored in admin to reach all levels. No invented 120-mission content.
- Admin dashboard approved addition: player identity/email, stages, progression, reflections and feedback with search, pagination and CSV. User explicitly authorized admin visibility of game reflections and feedback, excluding AI chats.
- Witness is a separate account using an unguessable invite; only mission details are disclosed, never private reflections. Witness confirms an observed attempt, not objective real-world proof.
- Card sealing is irreversible; sealed cards cannot trade. Offers lock both cards; only designated recipient accepts. Cancellations release locks. XP remains with the player who earned it.
- Rewards are admin-defined, limited stock, one redemption per player per reward; spending credits never reduces family XP. Claim code can be fulfilled once by admin.
- AI chat: explicit consent, own history, 20 requests/user/day, 2000-character input, bounded history and output. Server config selects model. Provider failure is visible; no canned-success fallback. No autonomous tools or reward authority.

## Work order and acceptance

1. Schema, seed data, RLS, transactional RPCs. SQL integration tests cover ownership, replay, witness privacy, quotas, exchange, sealing, rewards.
2. React mobile-first UI, email auth/recovery, deep links, collection, exchanges, rewards and admin. QR export; responsive keyboard-accessible forms.
3. Authenticated Edge Function with durable quota and saved conversation. Test request validation/provider handling where possible. Live provider calls await account setup.
4. Typecheck/build, real Postgres-compatible local tests, browser checks; setup guide with commands, environment variables, admin provisioning and cloud smoke checklist.

No deployment or paid provisioning in this phase. Migration is new-project only; backup database before changes on a populated environment. Legacy prototype remains available in Git history. Rollback frontend via previous commit; never drop production tables to roll back UI.
