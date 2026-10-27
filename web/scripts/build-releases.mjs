import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const releaseDir = path.resolve(repoRoot, 'release-packages');
const assetsDir = path.resolve(repoRoot, 'release-assets');

if (!existsSync(releaseDir)) mkdirSync(releaseDir, { recursive: true });
if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

console.log('⚡ Step 1: Building standalone HTML5 package with Vite...');
execSync('pnpm exec vite build --config vite.standalone.config.ts', { cwd: root, stdio: 'inherit' });

console.log('📦 Step 2: Packaging ZIP archives...');
const distItch = path.resolve(repoRoot, 'dist-itch');

// Use PowerShell Compress-Archive on Windows
const itchZip = path.resolve(releaseDir, 'asteroids-itch-html5.zip');
const crazygamesZip = path.resolve(releaseDir, 'asteroids-crazygames-html5.zip');

const compressCmd = (src, dest) => 
  `powershell -Command "Compress-Archive -Path '${src}\\*' -DestinationPath '${dest}' -Force"`;

execSync(compressCmd(distItch, itchZip), { stdio: 'inherit' });
console.log(`✓ Created: ${itchZip}`);

execSync(compressCmd(distItch, crazygamesZip), { stdio: 'inherit' });
console.log(`✓ Created: ${crazygamesZip}`);

// Step 3: Create online embed package for itch.io
const onlineDir = path.resolve(root, 'dist-itch-online');
if (!existsSync(onlineDir)) mkdirSync(onlineDir, { recursive: true });

const onlineHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asteroids: Neon Sector</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #080b18; color: #eef2ff; font-family: monospace; }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
  </style>
</head>
<body>
  <iframe id="game" src="__DEPLOYED_URL__?platform=itch" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>
  <script>
    // To connect this itch.io player to your live Cloudflare Worker deployment,
    // replace __DEPLOYED_URL__ with your Worker HTTPS URL (e.g. https://asteroids-neon-sector.your-subdomain.workers.dev)
    const deployedUrl = window.__CLOUDFLARE_URL__ || "__DEPLOYED_URL__";
    if (deployedUrl && !deployedUrl.startsWith("__")) {
      document.getElementById("game").src = deployedUrl + (deployedUrl.includes("?") ? "&" : "?") + "platform=itch";
    }
  </script>
</body>
</html>`;

writeFileSync(path.resolve(onlineDir, 'index.html'), onlineHtml, 'utf8');
const onlineZip = path.resolve(releaseDir, 'asteroids-itch-online-template.zip');
execSync(compressCmd(onlineDir, onlineZip), { stdio: 'inherit' });
console.log(`✓ Created: ${onlineZip}`);

console.log('\n🚀 All release packages successfully built in:', releaseDir);
