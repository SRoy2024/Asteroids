# Asteroids — Neon Sector

**A retro arcade with multiplayer trail battles, offline bot practice, and classic Asteroids.**

Built by **Soham Roy**. The original Python/Pygame game is preserved at the repository root; the web application lives in [`web/`](web/).

[Web development guide](web/README.md) · [Deployment guide](web/docs/DEPLOYMENT.md)

![Asteroids retro arcade cabinet](web/docs/preview.jpg)

## Game modes

| Mode | Gameplay | Opponents | Score storage |
| --- | --- | --- | --- |
| Multiplayer Arena | Collect energy, grow a trail, boost, and force rivals into your trail | Up to eight real players in a shared room | Server-derived arena records |
| Bot Practice | Learn the trail-arena rules without joining an online room | Four clearly labelled bots | No global score submission |
| Classic Asteroids — Ranked | Shoot and split asteroids; survive with three lives for up to two minutes | Asteroid field | Server-replayed, verified scores |
| Classic Asteroids — Practice | The classic game without ranked submission | Asteroid field | Device best only |

### Play with friends

1. Open the live game and select **Multiplayer Arena**.
2. Enter a callsign, choose a color, and select **Create a room for friends**.
3. Share the six-character room code.
4. Friends enter that code before starting the game. Leaving the code blank uses public matchmaking.

Rooms are public. Codes help friends meet in the same room; they are not private access controls. Multiplayer rooms contain real players only. Bots are confined to Bot Practice.

## Controls and rules

| Action | Trail arena | Classic Asteroids |
| --- | --- | --- |
| Steer | Mouse, WASD, or arrows | A/D or left/right arrows |
| Move | Ship moves continuously | W/S or up/down arrows |
| Space | Boost after collecting 10 energy | Fire; hold for repeated shots |
| P / Escape | Match continues; leave using the arena button | Pause/resume |
| Phone | Drag on the playfield; hold the labelled Boost button | Use the labelled touch buttons |

In the arena, collect energy to lengthen your trail. Your own trail is safe to cross. Hitting a rival's trail or the red boundary ends your flight; wreckage drops energy. Boosting spends energy, and new pilots receive a three-second shield. Arena records use final energy; eliminations break score ties.

Classic scoring is **20 / 50 / 100** points for large / medium / small asteroids. Larger rocks split into two smaller rocks. Classic ties favor shorter flights, then earlier completion. Both online scoreboards support all-time and rolling seven-day rankings.

## Retro cabinet UI

Cyan, purple, magenta and red neon surround a cabinet-style marquee, worn stickers, CRT scanlines, crooked posters, and joystick/button trim. Use **CRT FX ON/OFF** to disable decorative flicker, scanlines and ticker motion. Reduced-motion preferences are respected. The illustrated control deck is decorative; use the actual keyboard, mouse, and labelled touch controls to play.

## Technology

| Layer | Implementation |
| --- | --- |
| Interface | React 19, TypeScript, CSS, Lucide icons |
| Rendering | Canvas 2D; fixed-step game simulations |
| Web framework | Vinext, using Next.js-compatible routing and Vite |
| Hosted API | Account-owned Cloudflare Worker |
| Persistent storage | Cloudflare D1 / SQLite |
| Schema | Drizzle and checked-in SQL migrations |
| Tests | Node's built-in test runner and in-memory SQLite |
| Desktop edition | Python 3.13+ and Pygame 2.6.1 |

### How multiplayer works

Clients send steering and boost intent approximately every **300 ms**. The server advances a **20 Hz** simulation and calculates movement, growth, collisions and scores. Room state is stored in D1. Conditional, version-checked updates retry conflicts so separate Worker instances share the same room. Canvas rendering interpolates between snapshots.

The classic ranked game uses a different integrity model: the server issues a random seed, receives a bounded control recording, replays the same simulation, and calculates the score itself. Retried saves cannot overwrite or duplicate a completed score.

## Run the web application locally

### Requirements

- Node.js **24 or newer**.
- pnpm **11.25.0**, pinned in `web/package.json`.
- Git.

```sh
npm install --global pnpm@11.25.0
git clone https://github.com/SRoy2024/Asteroids.git
cd Asteroids/web
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev:cloudflare
```

Open the URL printed by the server. No cloud account is required for local practice or development. Production runs in your own Cloudflare account; follow the deployment guide below.

## Verify the project

Run from `web/`:

```sh
pnpm run test
pnpm run typecheck
pnpm deploy:check
```

The test suite currently has **13 tests**, covering classic rules and replay determinism, API validation, forged score fields, retry behavior, arena pickups/boosts/deaths, independent clients, concurrent joins, room capacity, disconnects, leaderboard persistence, and deployment readiness. API tests execute the actual route handlers against isolated, in-memory SQLite databases. They do not submit test records to production.

## Production deployment

The independent deployment runs the game and API in **your Cloudflare Workers account**, with **your D1 database**. It does not require ChatGPT hosting, login or connectors. [Deploy from this guide](web/docs/DEPLOYMENT.md); it covers account login, D1 creation, migrations, an upload-free build check, publishing and verification.

After verifying the account-owned URL, submit it to **CrazyGames** for review. [Draft listing and reviewer notes](web/docs/CRAZYGAMES.md) are included. Portal mode adds CrazyGames SDK v3 loading and gameplay events. A deployed URL is not a published portal listing: developer account setup, promotional assets, embedded testing and review are still required.

A manual **Deploy Asteroids to Cloudflare** GitHub Actions workflow is provided. Configure your account secrets before running it; merging does not silently deploy. The older ChatGPT Sites preview remains a separate legacy deployment until it is retired after migration. Scores do not automatically transfer to your new database.

This application needs its Worker API and D1. A frontend-only static upload cannot supply multiplayer or ranked score verification. The current polling-based arena needs load testing before a high-traffic portal launch; free-tier quotas are finite.

## Project layout

| Location | Purpose |
| --- | --- |
| Root `*.py`, `pyproject.toml`, `uv.lock` | Original desktop game |
| `web/app/page.tsx` | Mode selection, classic game UI and score flow |
| `web/components/arena/` | Multiplayer/practice interface, input, rendering and minimap |
| `web/components/game/` | Classic canvas rendering, audio and controls |
| `web/components/arcade-trim.tsx` | Retro cabinet artwork and visual trim |
| `web/lib/arena/` | Arena simulation and server room operations |
| `web/lib/game/` | Classic simulation, replay validation and API utilities |
| `web/app/api/` | Game, leaderboard and health endpoints |
| `web/db/`, `web/drizzle/` | Schema and migrations |
| `web/tests/` | Gameplay, API and concurrency tests |

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Readiness; HTTP 200 when D1 and required tables are available, otherwise 503 |
| POST | `/api/arena/join` | Matchmaking, room creation or joining by code |
| POST | `/api/arena/sync` | Authorized steering/boost update and world snapshot |
| POST | `/api/arena/leave` | End arena session and save its final score |
| GET | `/api/arena/leaderboard?period=all` | Arena bests; use `week` for the last seven days |
| POST | `/api/runs` | Start a seeded ranked classic flight |
| POST | `/api/runs/finish` | Verify the recording and save the derived classic score |
| GET | `/api/leaderboard?period=all` | Classic bests; also supports `week` |

Payload details and integrity rules are in the [web guide](web/README.md).

## Identity, privacy and limits

- No login is required. A random HttpOnly pilot cookie identifies the browser. Clearing cookies or switching browsers creates a new pilot; callsigns are public and nonunique.
- Session secrets authorize actions and are stored as hashes. They are omitted from world snapshots. Writes validate browser origins, inputs and recording sizes.
- Classic start requests have a soft per-browser/daily-IP-pseudonym rate limit. Arena sessions expire after ten seconds without contact. Raw IP addresses and emails are not stored.
- Bot Practice works without a connection **after the app has loaded**. There is no service worker for an initial offline page load.
- Multiplayer is a small-room prototype using HTTP snapshots. Input delay depends on the polling interval, network and database round trips. It has not been load-tested for a large public audience.
- D1 usage grows with connected-player time. Monitor hosting quotas before expanding traffic. Server-side checks do not prevent valid automated play or new-cookie identities.
- There is no account system, moderation dashboard, reserved callsigns, cross-device profile sync, or tournament-grade anti-cheat.

## Original Pygame edition

From the repository root:

```sh
python -m pip install pygame==2.6.1
python main.py
```

Requires Python 3.13+. Move with W/A/S/D and shoot with Space. Large asteroids split into smaller ones.

## Project demonstration

Show two browsers joining the same room, collect energy, demonstrate growth and boosting, then show Bot Practice and a classic ranked flight. Explain why the server calculates scores and why the two game modes use different verification methods. Include the live game and repository URLs with a submission.

## Credits and licensing

**Public credit: Soham Roy.** The trail-arena gameplay takes inspiration from Snake.io. Framework dependencies and maintained starter tooling retain their own licenses and notices, including the vendored Sites Vite integration notice. This repository currently declares no project-wide open-source license; dependency licenses do not grant a license to the entire game.
