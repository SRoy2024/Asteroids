# Complete Deployment Guide: CrazyGames & itch.io

This repository provides everything needed to deploy **Asteroids: Neon Sector** to **CrazyGames** and **itch.io**.

---

## 📦 Ready-to-Upload Release Packages

Pre-built release archives are located in [`release-packages/`](release-packages/):

| File | Platform | Description |
|---|---|---|
| `release-packages/asteroids-itch-html5.zip` | **itch.io** | Self-contained HTML5 game with `index.html` at the zip root. Runs directly in itch.io's web player. |
| `release-packages/asteroids-crazygames-html5.zip` | **CrazyGames** | Standalone HTML5 package containing CrazyGames SDK v3 event integration. |
| `release-packages/asteroids-itch-online-template.zip` | **itch.io** | Web embed wrapper that points to your live Cloudflare Worker deployment for multiplayer. |

To rebuild these at any time:
```sh
cd web
pnpm package:all
```

---

## 🎨 Pre-Generated Cover Art & Marketing Assets

Located in [`release-assets/`](release-assets/):

| Asset | Dimensions | Destination |
|---|---|---|
| `crazygames-cover-512x512.png` | 512 × 512 (1:1) | CrazyGames App Icon / Square Cover |
| `crazygames-cover-800x450.png` | 800 × 450 (16:9) | CrazyGames Landscape Cover |
| `crazygames-cover-600x800.png` | 600 × 800 (3:4) | CrazyGames Portrait Cover |
| `itch-cover-630x500.png` | 630 × 500 (5:4) | itch.io Project Cover Image |

---

## 🕹️ Part 1: Deploying to itch.io

### Option A: Direct In-Browser HTML5 Play (Recommended for itch.io)

1. Go to **[itch.io/game/new](https://itch.io/game/new)** (log in or create an account).
2. Set up the basic information:
   - **Title**: `Asteroids: Neon Sector`
   - **Classification**: `Games`
   - **Kind of project**: Select **HTML** (`You have a ZIP or HTML file that will be played in the browser`)
3. **Upload the game archive**:
   - Click **Upload files**.
   - Select `release-packages/asteroids-itch-html5.zip`.
   - Check the box: **☑ This file will be played in the browser**.
4. **Embed settings**:
   - **Viewport dimensions**: `1280` px width × `720` px height (or set to `100%` with responsive canvas).
   - **Orientation**: `Landscape`.
   - **Fullscreen button**: Enable (`☑ Enable fullscreen button`).
   - **Mobile friendly**: Check if you want touch controls on phone/tablet browsers.
5. **Cover Art & Media**:
   - Upload `release-assets/itch-cover-630x500.png` as the **Cover Image**.
   - Upload `web/docs/preview.jpg` into Screenshots.
6. **Description & Metadata**:
   - **Short description / Tagline**:
     `Collect light, grow your neon trail, and outmaneuver rival pilots in a retro space arcade.`
   - **Genre**: `Action / Arcade`
   - **Tags**: `Asteroids`, `Retro`, `Arcade`, `Multiplayer`, `Sci-Fi`, `Space`, `2D`
7. Click **Save & View Page** → Set visibility to **Public** to publish.

### Option B: Deploying with itch.io Butler CLI

If you have itch.io's command-line tool `butler` installed:
```sh
# Push HTML5 build to itch.io
butler push release-packages/asteroids-itch-html5.zip <your-username>/asteroids-neon-sector:html5
```

---

## 🎮 Part 2: Deploying to CrazyGames

CrazyGames accepts both **Hosted HTTPS Game URLs** (recommended for full multiplayer) and **HTML5 ZIP uploads**.

### Option A: Hosted URL Submission (Full Multiplayer Arena + Verified Leaderboards)

1. **Deploy your Cloudflare Worker backend**:
   ```sh
   cd web
   pnpm exec wrangler login
   pnpm exec wrangler d1 create asteroids-neon-sector
   # Update wrangler.cloudflare.json with your D1 UUID and Account ID:
   pnpm cloudflare:configure <YOUR_D1_UUID> <YOUR_ACCOUNT_ID>
   pnpm db:remote
   pnpm deploy:cloudflare
   ```
   Save the URL printed by Wrangler (e.g., `https://asteroids-neon-sector.your-subdomain.workers.dev`).

2. **Verify the URL**:
   Open `https://<YOUR_WORKER_URL>/api/health`. It must return `{"database":"ready"}` with HTTP 200.

3. **Submit to CrazyGames Developer Portal**:
   - Go to **[developer.crazygames.com](https://developer.crazygames.com)**.
   - Click **Add Game**.
   - **Game Title**: `Asteroids: Neon Sector`
   - **Game Type**: Choose **Hosted URL** (or HTML5 Zip).
   - **Game URL**: `https://<YOUR_WORKER_URL>/?platform=crazygames`
     *(The `?platform=crazygames` parameter automatically initializes CrazyGames SDK v3 and emits loading/gameplay telemetry).*
   - **Categories**: `Arcade`, `.io`, `Space`, `Multiplayer`

### Option B: HTML5 ZIP Upload

If you choose HTML5 ZIP upload on CrazyGames:
- Upload `release-packages/asteroids-crazygames-html5.zip`.
- The package already contains the CrazyGames SDK v3 event hooks.

### CrazyGames Listing Metadata & Assets

- **App Icon (512x512)**: `release-assets/crazygames-cover-512x512.png`
- **Landscape Cover (800x450)**: `release-assets/crazygames-cover-800x450.png`
- **Portrait Cover (600x800)**: `release-assets/crazygames-cover-600x800.png`
- **Controls**:
  ```
  Trail Arena: Mouse, WASD, or Arrow Keys to steer; Spacebar to Boost.
  Classic Asteroids: A/D or Left/Right to rotate, W or Up to thrust, Spacebar to fire, P/Escape to pause.
  Touch devices: Use on-screen joystick and labelled buttons.
  ```
- **Description**:
  ```
  Welcome to Neon Sector: a retro arcade cabinet featuring electric blue, purple, and red neon visuals. Fly through a shared arena, collect energy, and grow a blazing trail behind your ship. Cut across rival paths, dodge the red perimeter, and boost for explosive speed.

  Features:
  - Multiplayer Trail Arena: Battle up to 8 pilots in shared rooms.
  - Bot Practice: Warm up against local AI pilots anytime.
  - Classic Asteroids: Retro rock-splitting arcade action with 3 lives.
  - Authentic retro arcade cabinet aesthetic with customizable CRT scanlines and synthesized sound effects.
  ```

---

## 🧪 Verification Checklist

- [x] All 13 unit & replay determinism tests passing (`pnpm test`).
- [x] TypeScript typechecking clean (`pnpm typecheck`).
- [x] Standalone HTML5 bundle built and zipped (`release-packages/`).
- [x] Formatted covers for 512x512, 800x450, 600x800, and 630x500 generated (`release-assets/`).
- [x] CrazyGames SDK v3 initialization and gameplay telemetry tested.
