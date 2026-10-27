$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is required. Install the current LTS release, then rerun this script.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm was not found. Install Node.js with npm, then rerun this script.'
}

npm install
if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Created .env from .env.example. Add your Discord token and application ID.'
} else {
  Write-Host 'Kept existing .env. Check it has DISCORD_TOKEN and CLIENT_ID.'
}
Write-Host 'Setup complete. Use npm run deploy-commands, then npm start.'
