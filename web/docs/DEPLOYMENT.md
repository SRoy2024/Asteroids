# Deploy to your Cloudflare account, then submit to CrazyGames

The independent deployment uses **your Cloudflare Workers account** for the game and API, and **your D1 database** for rooms and scores. CrazyGames can embed that HTTPS URL after reviewing your submission. ChatGPT Sites is not part of this deployment.

**Status:** the standalone build is implemented. An account-owned production URL must be deployed and verified before a CrazyGames submission. The old `chatgpt.site` preview is a separate service; these commands neither publish nor change it.

## 1. Install and test

Use Node 24+ and pnpm 11.25.0. From the repository root:

```sh
cd web
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm deploy:check
```

`deploy:check` builds the independent Worker and runs Wrangler's deployment dry run. It uploads nothing. It may use the local placeholder database ID; a real deployment refuses that placeholder.

The independent path uses `worker/cloudflare.ts`, `vite.cloudflare.config.ts`, and `wrangler.cloudflare.json`. It does not load the Sites runtime, connectors, or ChatGPT authentication. The older managed-preview configuration remains available separately through `pnpm dev` / `pnpm build`.

## 2. Connect your Cloudflare account

On your own computer, authenticate through Cloudflare's browser OAuth flow:

```sh
pnpm exec wrangler login
pnpm exec wrangler whoami
pnpm exec wrangler d1 create asteroids-neon-sector --config wrangler.cloudflare.json
```

Copy the **database UUID** returned by `d1 create` and the **account ID** from `whoami`. These are identifiers, not API tokens. Replace the example values below with your own:

```sh
pnpm cloudflare:configure YOUR_D1_DATABASE_UUID YOUR_CLOUDFLARE_ACCOUNT_ID
```

This updates `wrangler.cloudflare.json`. Its Worker name defaults to `asteroids-neon-sector`; change it there if that name already exists in your account. Do not select a paid plan or add billing merely to follow this guide. No custom domain is required; Cloudflare can assign a `workers.dev` address.

Never paste API tokens, passwords, or OAuth codes into source or chat. For local work, Wrangler stores its login outside the repository. For CI, store credentials as GitHub Actions secrets.

## 3. Apply the database schema and deploy

```sh
pnpm db:remote
pnpm deploy:cloudflare
```

`db:remote` applies pending SQL files in `drizzle/` to the configured account-owned D1 database. Review the database name and migration list in Wrangler's prompt. `deploy:cloudflare` rebuilds with the independent configuration and deploys `dist/server/wrangler.json`. It checks the built binding and refuses unexpected connector service bindings.

Save the **actual HTTPS URL printed by Wrangler**. Do not guess a subdomain. Open `/api/health` on that URL: it must return HTTP 200 with `database: "ready"`. A 503 means the binding or schema is missing.

For local independent development:

```sh
pnpm db:local
pnpm dev:cloudflare
```

Local data lives in `.wrangler/state` and is separate from production. An existing legacy preview database may already contain these tables without Wrangler's migration history. Use a fresh clone for an isolated local check; do not reset a database containing records you need. Never replay the initial SQL blindly against a populated database.

## 4. Verify the deployed game

Before sharing or submitting the URL:

1. Confirm `/api/health` reports ready.
2. Open two independent browsers. Create a room in one, enter its code in the other, and verify both ships appear and interact.
3. End a ranked arena flight and confirm it appears after refreshing the leaderboard.
4. Play a ranked classic flight, confirm replay verification succeeds, then refresh to check persistence.
5. Play both practice modes and verify no ranked score is submitted.
6. Test touch controls, fullscreen, reduced motion, CRT FX OFF, and keyboard focus.
7. Inspect Cloudflare's Worker errors, CPU time and D1 writes before increasing traffic.

This is a small-room multiplayer prototype: eight players per room, HTTP snapshots roughly every 300 ms, and D1 optimistic concurrency. It has not been load-tested for a portal launch. A persistent WebSocket room host, such as a Durable Object, is the appropriate next step for sustained public multiplayer traffic.

## 5. Prepare the CrazyGames submission

CrazyGames accepts externally hosted games as regular submissions. It does **not** provide multiplayer servers. Submit the account-owned HTTPS game URL with `?platform=crazygames` appended. Do not upload `dist/server` as a static HTML5 ZIP: it contains a Worker application, not an `index.html` game bundle.

Portal mode loads the official v3 SDK, awaits initialization, reports loading completion, and sends gameplay start/stop events when play begins, pauses, ends, or returns to a menu. A failed SDK request does not prevent normal gameplay. Ordinary visits do not request the CrazyGames SDK.

Production pilot cookies use `HttpOnly; SameSite=None; Secure; Partitioned` so supporting browsers can preserve a session inside a cross-site iframe. Local HTTP uses `SameSite=Lax`. Same-origin JSON checks and per-session secret tokens remain required. Portal and direct visits may have separate pilot identities because storage is partitioned. Test the actual developer preview with third-party cookies blocked; do not assume all browser privacy settings behave identically.

Create a submission at [CrazyGames Developer Portal](https://developer.crazygames.com/), use the copy in [CRAZYGAMES.md](CRAZYGAMES.md), and test the embedded game before requesting review.

The SDK events are a foundation for initial QA, **not a claim of Full Launch or Online with Friends certification**. Native friend invites, instant multiplayer, CrazyGames usernames, ads/monetization and CrazyGames-native leaderboards are not integrated. The game's own D1 leaderboards are independent. Complete additional portal requirements if the review requests them.

Required portal materials include landscape, portrait and square cover art plus gameplay preview video. `docs/preview.jpg` is a reference screenshot, not a complete promotional asset set. Account setup, developer agreements, final asset uploads, and submission review remain required. Acceptance is decided by CrazyGames; deploying a URL does not create a CrazyGames listing.

## Optional GitHub Actions deployment

The root repository includes `.github/workflows/deploy-cloudflare.yml`. It runs manually from Actions; merging code does not silently deploy. Add these **repository/environment secrets** under GitHub Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN`: a token scoped to your account's Workers deployment and D1 operations.
- `CLOUDFLARE_ACCOUNT_ID`: the target account ID.
- `CLOUDFLARE_D1_DATABASE_ID`: the D1 UUID created above.

Then run **Deploy Asteroids to Cloudflare** on the intended branch. The job tests, typechecks, configures the binding, applies pending migrations, and deploys. Never put the token in the workflow YAML. Keep deployment access limited to repository maintainers.

## Quotas, data and rollback

Cloudflare's published free tier currently includes 100,000 Worker requests/day and D1 allowances of 5 million rows read/day, 100,000 rows written/day and 5 GB storage. Worker Free CPU limits also matter, particularly for classic replay verification. This architecture cannot promise unlimited free hosting: a client polling every 300 ms makes about 12,000 sync requests/hour before other requests and retries. Watch quotas and pause traffic instead of enabling paid overages without a budget.

Your new database starts empty. Existing preview scores do not automatically transfer. If you need them, arrange an explicit data export/import before retiring the preview; never copy live ephemeral room sessions as a migration strategy.

After the new URL passes the checks, remove public access to the old managed preview and update repository/social links. Keep a record of the deployed Git commit and verified URL. Roll back code by deploying a known-good commit using the same account and DB; code rollback does not undo migrations. Append migrations rather than editing applied files, and use D1 backups before a data migration.

References: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [CrazyGames FAQ](https://docs.crazygames.com/faq/), [SDK setup](https://docs.crazygames.com/sdk/intro/), [game events](https://docs.crazygames.com/sdk/game/), [multiplayer requirements](https://docs.crazygames.com/requirements/multiplayer/), [cover requirements](https://docs.crazygames.com/requirements/game-covers/).
