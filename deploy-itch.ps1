# Deploy Asteroids: Neon Sector to itch.io using Butler
param(
    [string]$ApiKey = "PNZcW1m1GLbrsKg7N6KWqXOhN6Q2Mo6NXFoW1fvk",
    [string]$Target = "sohmroy/asteroid-fighter:html5"
)

$ErrorActionPreference = "Stop"
$env:BUTLER_API_KEY = $ApiKey

$butler = "C:\Users\rajas\.gemini\antigravity\scratch\butler\butler.exe"
$dist = "C:\Users\rajas\.gemini\antigravity\scratch\Asteroids\dist-itch"

Write-Host "🚀 Pushing Asteroids HTML5 build to itch.io ($Target)..." -ForegroundColor Cyan
& $butler push $dist $Target --userversion 1.0.0
Write-Host "✅ Deployment to itch.io complete!" -ForegroundColor Green
