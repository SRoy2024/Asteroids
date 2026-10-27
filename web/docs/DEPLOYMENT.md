# Deployment and release guide

## Current production service

| Item | Value |
| --- | --- |
| Game | https://asteroids-orbital-arcade.dusky-dace-1132.chatgpt.site/ |
| Readiness | https://asteroids-orbital-arcade.dusky-dace-1132.chatgpt.site/api/health |
| Source repository | https://github.com/SRoy2024/Asteroids |
| Application directory | `web/` in GitHub; the Site checkout itself uses that directory as its root |
| Runtime | Cloudflare Worker through ChatGPT Sites |
| Database | Cloudflare D1 / SQLite, binding `DB` |
| Identity/configuration | `.openai/hosting.json` in the Site checkout |

Public visitors do not require ChatGPT login. The public site runs in the cloud; stopping a developer's computer or local preview does not stop it.

## Release model

GitHub and the managed Site source repository are separate. Merging or pushing a GitHub commit alone does **not** deploy the current Site. Each release must explicitly publish the corresponding Site source state. Do not claim automatic deployment unless a separate integration has actually been configured and verified.

For a release through the connected Sites workflow:

1. Read the desired GitHub source and resolve its exact commit. Preserve any subsequent user changes.
2. Open the existing Site identified by `.openai/hosting.json`; reuse its project ID and current audience. Do not register a duplicate Site.
3. Synchronize the intended application changes into that Site's checkout. Keep runtime secrets out of source.
4. Run the checks below. The managed publishing workflow commits and pushes the checked source to the Site's own source repository and creates an archive from the matching build.
5. Save the pushed source version with its matching build archive, then deploy that saved version.
6. Wait for a terminal deployment result. Check `/api/health` and the live game before announcing success.
7. Record the GitHub commit and saved Site version in the release handoff. Keep public access unchanged unless an audience change was requested.

The Sites source commit is a different identifier from the GitHub monorepo commit. Their application contents must match; do not pass a GitHub commit as the Site's source commit.

## Required checks

From the application directory, with Node 24+ and pinned pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm run test
pnpm run typecheck
pnpm run build
```

An existing checkout with unchanged, installed dependencies does not need a redundant install. Build output is generated under `dist/`; edit source, not generated output. The repository's framework, build and packaging integrations must be preserved.

## Database migrations

The manifest declares `"d1": "DB"`. The hosting service provisions the production binding and applies checked-in migrations during publishing. Do not replace the logical binding with a local database ID.

The schema is defined in `db/schema.ts`. For a schema change:

```sh
pnpm run db:generate
```

Inspect and commit the generated SQL and Drizzle metadata. Append new migrations; applied migrations and journal entries are immutable. Keep data imports/backfills outside schema migrations.

Production and local databases are separate. For local development, build first and apply each pending SQL file once, in filename order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_equal_iceman.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_large_venus.sql
```

Apply only migrations not already present in that local database. Do not remove `--local` to try to configure the hosted Site from a development checkout. Hosted migrations belong to the managed publishing flow.

## Readiness and live checks

`GET /api/health` is public, dynamic and uncached. Success returns:

```json
{"status":"ok","service":"Asteroids — Neon Sector","database":"ready"}
```

It returns HTTP 503 if the D1 binding cannot be used or any required application table is absent. It reveals no player records, session secrets or raw database errors. It is a readiness check, not a latency/load test.

After a release:

- Confirm HTTP 200 from `/api/health` and both leaderboard endpoints.
- Open the game in a fresh browser session and check the three mode tabs and CRT FX switch.
- For multiplayer verification, join the same room from two clients, confirm both names appear, steer, then leave. Test callsigns are public if they earn ranked records.
- Check Bot Practice separately; its four opponents must be labelled bots.
- Check a classic ranked flight and its saved-score result when game/replay code changes.

## Rollback

Redeploy a previously saved, known-good Site version through the same hosting workflow. Do not delete the database or reset migrations. A code rollback does not undo migrations or restore old data. After a schema change, check that the older code is compatible with the current schema before rolling it back.

## Runtime configuration and privacy

This build does not require game-service API keys, OAuth credentials, or a publicly exposed database key. Configure future secrets with the hosting service's environment-variable tools, not in GitHub, client bundles, or the hosting manifest.

Pilot cookies and per-session tokens authorize game actions. All world snapshots must omit secret hashes and internal pilot identifiers. Health and leaderboard responses must not expose those values.

## Capacity and hosting portability

Current rooms hold eight pilots and synchronize around every 300 ms. Each active client causes database work. Monitor D1 request/write quotas and Worker limits; free hosting does not mean unlimited traffic. The arena is not load-tested for a large public audience.

For a larger real-time game, room simulation needs an appropriate persistent real-time room host. For a different hosting provider, configure a compatible Worker/D1 runtime and migrations before switching traffic. A frontend-only static deployment cannot implement this app's multiplayer and ranked API routes. `pnpm run start` is a local preview, not a production publish command.
