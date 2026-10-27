# Neon Sector — web application

This directory is the complete browser application for **Asteroids — Neon Sector**, by Soham Roy.

**[Play online](https://asteroids-orbital-arcade.dusky-dace-1132.chatgpt.site/)** · [Repository overview](../README.md) · [Deployment guide](docs/DEPLOYMENT.md)

![Retro arcade cabinet](docs/preview.jpg)

## Local development

Requirements: **Node 24+**, **pnpm 11.25.0**, and Git. No cloud account or game-service API key is needed for local development.

From the GitHub repository root:

```sh
npm install --global pnpm@11.25.0
cd web
pnpm install --frozen-lockfile
pnpm run build
```

The first build generates `dist/server/wrangler.json`, including the local `DB` binding. Apply both initial migrations once to the local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_equal_iceman.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_large_venus.sql
pnpm run dev
```

Open the URL printed by the server. Clean clones default to the portable execution profile; no managed-container configuration needs to be copied. `pnpm run start` previews the built Worker locally. Development and built previews share `.wrangler/state`; hosted scores use a separate database.

Apply only new migrations on subsequent schema changes. Replaying the initial migration against an already initialized database produces a table-exists error. Do not delete hosted data to fix a local development issue.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Local development with live reload |
| `pnpm run build` | Build the Worker and browser assets |
| `pnpm run start` | Preview the built Worker locally; does not deploy |
| `pnpm run test` | Run the gameplay, replay, API and concurrency tests |
| `pnpm run typecheck` | Check TypeScript without emitting files |
| `pnpm run db:generate` | Generate a new SQL migration from `db/schema.ts` |

## Game modes

### Multiplayer Arena

Select a public callsign and ship color. **START GAME** with an empty room code uses public matchmaking; **Create a room for friends** creates a room and reveals its six-character code. Enter a code to join an existing room. Each room accepts eight real players and is public, even when players share a code.

- Steer using the mouse, WASD, arrows, or a touch drag on the playfield.
- Collect energy to grow a neon trail. Crossing your own trail is safe.
- Your head hitting a rival's trail or the red boundary ends the run.
- Eliminated pilots drop energy for survivors to collect.
- At 10 energy, hold Space or the touch **Boost** button to accelerate. Boosting spends one energy every 200 ms.
- New pilots receive a three-second spawn shield.
- Online play does not pause. Use the leave button to exit; ten seconds without contact ends the session.

The live roster ranks players in the current room. Persistent arena records rank completed flights by final energy, then eliminations, then earlier completion. Each browser pilot gets one best record per period. All-time and rolling seven-day views are separate.

### Bot Practice

Uses the same trail-arena engine locally with four explicitly labelled bots. Bots respawn after elimination. No arena game API is called and no practice score is submitted to the global leaderboard. It works without a connection after the app has loaded; there is no service worker for an initial offline page load.

### Classic Asteroids

The original shooting/splitting game has ranked and practice options. Rotate with A/D or left/right arrows, move with W/S or up/down arrows, and hold Space to shoot. P or Escape pauses the game. Phones have labelled touch controls.

Flights have three lives and a two-minute cap. Large / medium / small rocks award 20 / 50 / 100 points. Large and medium asteroids split into two smaller ones. Ranked flights are replayed by the server before a score is saved. Practice contributes only to the device best. Finish a classic flight before switching modes.

## Interface

The cabinet design uses a neon marquee, layered stickers, screw details, worn posters, a decorative joystick/button deck, CRT scanlines and uneven tube flicker. Actual gameplay uses the mouse, keyboard and labelled touch controls; the illustrated deck is visual trim.

**CRT FX ON/OFF** stops decorative flicker, ticker movement and scanlines. The preference is stored on the device. Reduced-motion preferences disable decorative animations by default.

## Architecture

| Component | Responsibility |
| --- | --- |
| `app/page.tsx` | Mode selection, classic UI, ranked save/retry flow |
| `components/arena/neon-arena.tsx` | Arena/practice UI, input, Canvas rendering, interpolation and minimap |
| `components/game/game-canvas.tsx` | Classic rendering, controls, audio and recording |
| `components/arcade-trim.tsx` | Cabinet artwork and decorative trim |
| `lib/arena/engine.ts` | Fixed-step trail-arena rules and bot behavior |
| `lib/arena/server.ts` | Authorized room changes, optimistic concurrency and final records |
| `lib/game/engine.ts` | Seeded classic simulation shared by client and server |
| `lib/game/replay.ts` | Bounded control-recording validation and replay |
| `lib/game/api.ts` | Database access, input parsing, cookies and safe JSON responses |
| `app/api/` | Game, leaderboard and readiness routes |
| `db/schema.ts`, `drizzle/` | SQLite schema and versioned SQL migrations |
| `worker/index.ts`, `vite.config.ts` | Cloudflare/Vinext and managed-hosting integration |
| `tests/` | Node tests and the in-memory D1/SQLite adapter |

### Arena authority and synchronization

A client sends steering/boost intent roughly every 300 ms. The server uses its clock to advance a fixed 20 Hz simulation and derives movement, energy, collisions, deaths and scores. Requests cannot set a position or score. Clients interpolate snapshots for Canvas rendering.

Room state is persisted as a bounded D1 record. Each mutation reads its version and attempts a conditional update; conflicts retry up to six times. Separate Worker instances therefore share room state. Monotonic input sequence numbers prevent an older update from replacing newer controls. Session credentials and pilot cookies authorize operations, and public snapshots omit secret hashes and internal pilot identifiers.

Completed arena records use an idempotent insert keyed by session ID. Dead-player state is retained briefly to permit persistence retries. Disconnected players are removed, and old inactive rooms are pruned.

### Classic score verification

The server issues a seed and per-flight secret. The browser records only input changes at fixed 60 Hz frame numbers. The finish endpoint loads the server's stored seed, validates the recording, replays it, and derives score, duration and hit count. The submitted score field is not trusted. Recordings cannot exceed two minutes or run ahead of elapsed wall time beyond a three-second allowance.

A conditional database update saves a flight exactly once. Retrying a completed flight returns its existing result. The UI retains an unsaved completed recording in session storage so it can be retried after a reload in the same tab.

## API contracts

All routes use JSON and return uncached responses. Browser writes require a same-origin request. Callsigns accept 2–18 Unicode letters/numbers, spaces, dots, underscores or dashes. Error responses have an `error` string, except readiness responses, which intentionally expose only service status.

### `GET /api/health`

HTTP 200 when D1 can be queried and the three required tables exist:

```json
{"status":"ok","service":"Asteroids — Neon Sector","database":"ready"}
```

HTTP 503 when storage/schema is unavailable. No player data, tokens or raw database errors are returned. This is a readiness check, not a load or latency test.

### `POST /api/arena/join`

```json
{"name":"Pilot One","color":0,"room":"ABC234","newRoom":false}
```

`color` is 0–5. Omit or leave `room` empty for matchmaking; set `newRoom: true` for a new room. Returns `{id, token, room, world}` and sets the HttpOnly pilot cookie. Treat `token` as a secret.

### `POST /api/arena/sync`

```json
{"id":"session UUID","token":"session secret","room":"ABC234","seq":1,"angle":1.5,"turn":0,"boost":false}
```

Angles are finite radians within ±2π; `turn` is -1, 0 or 1; `seq` is a monotonically increasing integer. Returns `{world}`. World snapshots include server time, tick, visible players/trails, orbs and population, with private fields removed.

### `POST /api/arena/leave`

Send `{id, token, room}`. Ends the authorized pilot session and records its final energy. Returns `{left: true}`.

### `GET /api/arena/leaderboard?period=all`

Returns `{entries}`: the top 20 best browser-pilot records plus the caller's record if outside the top 20. Entries include `name`, `score`, `kills`, `rank`, and `isYou`. Use `period=week` for the last seven days.

### `POST /api/runs`

Send `{name}`. Returns `{id, token, seed}` and sets the pilot cookie. The random secret's SHA-256 hash is stored server-side.

### `POST /api/runs/finish`

Send `{id, token, frames, controls}`. `controls` is an array of `[frame, bitmask]` input changes, with left=1, right=2, thrust=4, reverse=8, fire=16. Returns the server-derived `{score, frames, hits, saved}`. A flight expires after one hour.

### `GET /api/leaderboard?period=all`

Returns `{entries, stats, personal, updatedAt}`. Classic rankings use the best positive score per browser pilot; ties favor fewer frames, then earlier completion. Use `period=week` for the last seven days. Internal pilot IDs are not returned.

## Validation

```sh
pnpm run test
pnpm run typecheck
pnpm run build
```

The current **12 tests** cover gameplay, replay determinism, malformed recordings, forged scores, duplicate saves, expiry, arena pickups/boosts/deaths, independent clients, concurrent joins, capacity, disconnections, records and readiness. Tests import real route handlers and execute their SQL against isolated, in-memory SQLite databases. No test fixture is added to production.

## Hosting and releases

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the production service, release procedure, database migration rules, readiness checks and rollback considerations.

The app currently runs as a Cloudflare Worker with D1 through ChatGPT Sites. `.openai/hosting.json` declares the existing Site and logical `DB` binding. A frontend-only deployment is insufficient. GitHub merges do not automatically publish the current Site; its source state must be synchronized and explicitly deployed through the managed hosting workflow.

No game API keys or public database credentials are needed. Keep any future hosted secrets in runtime configuration, never in client source or Git. Preserve the framework's Sites build integration.

## Known limits

- HTTP snapshots introduce input delay from polling, network and database round trips. This is a small-room prototype, not a high-scale real-time service; public load testing has not been performed.
- Database usage grows with connected-player time. Monitor hosting quotas before expanding traffic.
- Pilot identity is browser-based. Callsigns are public and nonunique; clearing cookies creates a new pilot.
- Server authority does not prevent valid automated play. Classic start rate limiting is a soft per-browser/daily-IP-pseudonym limit, not a comprehensive abuse-control system.
- No account login, moderation dashboard, reserved names or cross-device identity sync is implemented.
- Raw IP addresses and emails are not stored. Daily IP pseudonyms support classic abuse checks. Completed scores and pseudonymous pilot IDs remain in D1.

## Credits

Public credit: **Soham Roy**. Trail gameplay is inspired by Snake.io. Dependency licenses and the vendored Sites integration notice remain in place. The repository has no project-wide open-source license declared.
