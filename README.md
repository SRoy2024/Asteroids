# Asteroids — Neon Sector

A retro arcade by **Soham Roy**: live multiplayer trail battles inspired by Snake.io, offline bot practice, and a browser edition of the original Python/Pygame Asteroids game.

**[Play online](https://asteroids-orbital-arcade.dusky-dace-1132.chatgpt.site/)**

![Retro arcade cabinet](web/docs/preview.jpg)

## Pick your cartridge

- **Multiplayer arena:** eight-player public rooms. Collect energy, grow a neon trail, boost, and cut off rivals. Create a room and share the six-character code to play with friends.
- **Bot practice:** offline trail-arena training with four clearly labelled computer opponents. Practice never submits global scores.
- **Classic Asteroids:** the original shooting/splitting game, with ranked flights and solo practice. Classic scores are verified by server-side replay.

The cabinet UI includes cyan/magenta neon trim, a marquee, CRT scanlines, flickering tubes, stickers, screw details, joystick/button trim, and worn poster graphics. CRT FX can be switched off; reduced-motion preferences are respected.

## Architecture

React + TypeScript + Canvas, Vinext/Cloudflare Worker API, and D1/SQLite persistence. Multiplayer rooms synchronize approximately every 300 ms over HTTP; version-checked updates protect shared state, while the server calculates movement, growth, collisions and scores. This is a small-room casual prototype, with network/input latency and no public-scale load testing. Full setup, API, gameplay rules, quotas, identity limits and demo instructions are in [`web/README.md`](web/README.md).

## Run the browser edition

```sh
cd web
pnpm install --frozen-lockfile
pnpm run build
# Apply both local D1 migrations as documented in web/README.md.
pnpm run dev
```

`pnpm run test` runs eleven gameplay, replay, API, concurrency and capacity tests. `pnpm run typecheck` checks TypeScript.

## Original desktop game

The original Pygame source remains at the repository root.

```sh
# Python 3.13+
pip install pygame==2.6.1
python main.py
```

Use W/A/S/D to move and rotate, and Space to shoot. Large asteroids split into smaller ones.

Public credit: Soham Roy.
