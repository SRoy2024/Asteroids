# CrazyGames submission copy

Status: draft. Deploy and verify your own Cloudflare URL first, then test that URL in the CrazyGames developer preview. This document does not represent an accepted or submitted listing.

## Listing fields

**Title:** Asteroids: Neon Sector

**Developer:** Soham Roy

**Suggested categories:** Arcade, .io, Space, Multiplayer

**Short description:** Collect light, grow your neon trail, and outmaneuver rival pilots in a chaotic retro space arcade.

**Description:**

Welcome to Neon Sector: a battered arcade cabinet with electric blue, purple and red neon. Fly through a shared arena, collect energy, and grow a blazing trail behind your ship. Cut across your rivals' paths, dodge the red boundary, and spend energy for a burst of speed.

Bring friends into the same room with a six-character code, or find a public arena. Warm up in Bot Practice with four clearly labelled local opponents. Prefer the original arcade challenge? Switch to Classic Asteroids and blast splitting rocks while chasing a server-verified high score.

**Controls:** Mouse, WASD or arrow keys to steer in the arena; Space to boost. On touch screens, drag to steer and use the Boost button. In Classic: A/D or Left/Right to rotate, W/Up to thrust, Space to fire, P/Escape to pause. Use on-screen controls on touch devices.

**Player count:** 1–8 human players per online room. Bot Practice is single player with four bots. Classic is single player. No live chat.

**Game URL:** Use the verified URL printed by your own Cloudflare deployment, with `?platform=crazygames`.

## Reviewer notes

- Independent Cloudflare Worker + D1 backend; frontend and API share the same origin.
- No registration required. Callsigns are public and nonunique.
- Online arenas contain real players; bots are restricted to the explicitly labelled practice mode.
- Classic scores are verified by deterministic server replay; arena positions and scores are calculated by the server.
- Separate persistent arena/classic leaderboards with all-time and rolling seven-day rankings.
- CRT FX can be disabled; reduced-motion preferences are respected.
- SDK v3 initialization, loading and gameplay events implemented in portal mode.
- No ads, purchases or native Friends integration. The room-code system is independent of CrazyGames Friends.
- Backend is a small-room prototype and needs public load testing before a high-traffic launch.

## Still required before review

- Account-owned live URL and successful embedded multiplayer/persistence checks.
- Your developer account and acceptance of the portal's agreements.
- All three required cover formats and a gameplay preview video, following current portal specifications.
- Review of callsign/UGC requirements and any additional QA requirements shown by the developer portal.
- No claim of CrazyGames publication until the portal confirms acceptance and provides a listing URL.
