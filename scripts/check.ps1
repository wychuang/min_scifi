Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Checking JavaScript syntax..."
node --check app.js

Write-Host "Running smoke tests..."
node --test tests/app-smoke.test.mjs

$chromeCandidates = @(
  @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  ) | Where-Object { Test-Path $_ }
)

if ($chromeCandidates.Count -eq 0) {
  Write-Warning "Chrome/Edge not found; skipped headless browser smoke check."
  exit 0
}

$browser = $chromeCandidates[0]
$indexPath = (Resolve-Path ".\index.html").Path.Replace("\", "/")
$url = "file:///$indexPath"

Write-Host "Running headless browser smoke check with $browser..."
$dom = & $browser --headless=new --disable-gpu --no-first-run --virtual-time-budget=1000 --dump-dom $url 2>$null

if ($LASTEXITCODE -ne 0) {
  throw "Headless browser smoke check failed with exit code $LASTEXITCODE."
}

if ($dom -notmatch '<span class="score" id="score">20/100</span>') {
  throw "Expected fresh-page score 20/100 was not rendered."
}

Write-Host "All checks passed."
