# Asteroids — Orbital Arcade

A Python/Pygame Asteroids game by **Soham Roy**, now extended with a playable browser edition and persistent global leaderboard.

![Browser arcade preview](web/docs/preview.jpg)

## Browser edition

**[Play online](https://asteroids-orbital-arcade.dusky-dace-1132.chatgpt.site/)** — publicly playable, with a persistent global leaderboard.

Open [`web/README.md`](web/README.md) for setup, controls, architecture, API documentation, testing, deployment, and a project demo walkthrough.

- Responsive arcade interface with keyboard and touch controls.
- Ranked and offline practice modes; three lives and two-minute flights.
- All-time and weekly leaderboards, personal bests, and retry-safe saves.
- Server-side replay verification calculates scores from recorded controls.
- React/TypeScript Canvas game, Worker API, and D1/SQLite database.

## Original desktop game

The original Pygame source remains at the repository root.

```sh
# Python 3.13+
pip install pygame==2.6.1
python main.py
```

Use W/A/S/D to move and rotate, and Space to shoot. Large asteroids split into smaller ones.

## Browser development

```sh
cd web
pnpm install --frozen-lockfile
pnpm run build
# Apply the initial local database migration as documented in web/README.md.
pnpm run dev
```

`pnpm run test` runs seven engine/replay/API tests. `pnpm run typecheck` checks TypeScript.

This browser edition is solo play with shared online rankings. Pilot identities are browser-based; names are public and nonunique. Replay verification prevents directly fabricated scores but does not prevent bots. See the documented limits in the browser README.

Public credit: Soham Roy.
