$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $taskNode) {
    $taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $taskNode)) { throw 'Install Node.js 22 or later, then run this launcher again.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\neo4j-driver'))) {
    throw 'Install project dependencies first using npm install or pnpm install. See README.md.'
}
Write-Host 'Open http://localhost:3000 in your browser. Keep this terminal open during the demo.' -ForegroundColor Yellow
& $taskNode server/index.js
