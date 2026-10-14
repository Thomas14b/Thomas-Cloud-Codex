# Architecture

React/Vite calls same-origin `/api/game` and `/api/bobo`. Functions verify Netlify Identity and reject cross-origin/non-JSON mutations. Requests are bounded at 24 KB. SQL identifiers and procedures come from a fixed allowlist; all user values are parameterized.

Netlify Database stores game state in a private `game` schema. PUBLIC has no schema/table/function permissions. Each server transaction sets a transaction-local verified player ID and synchronizes the admin flag from signed Identity roles. Read queries explicitly filter owners; admin procedures independently check the admin role. Browser requests cannot specify another authenticated identity or call internal award functions.

Postgres functions enforce locked inventory updates, idempotent mission completion/redemption, two-person witnesses and trade permissions. Admin reports include reflections/feedback but never chat messages. Infrastructure administrators retain database access.

AI uses the official OpenAI SDK with Gateway-injected credentials. Output is bounded to 500 tokens, history to six messages of 1,500 characters, timeout 40 seconds, automatic retries disabled, provider storage disabled. Atomic reservations enforce daily and monthly caps and request ownership. Clearing a chat removes messages and retry replies and invalidates in-flight saves.

Service worker caches only the public app shell, never API/auth responses. API responses are private/no-store. Production visibility is a separate Netlify protection layer.
