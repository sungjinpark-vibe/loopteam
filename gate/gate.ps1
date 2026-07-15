# ── Mechanical Gate (기계 Gate) ─────────────────────────────────────────────
# VISION.md section 3, "Gate 1". The objective signal the quality loop must pass
# BEFORE any rubric scoring happens. No human, no LLM. A command returns 0 or it
# does not.
#
# Book ch.12: "Verification must be able to actually fail. Verification that
#              passes no matter what comes in is decoration, not verification."
# So this script DOES NOT PASS WHAT IT CANNOT CHECK. Missing app folder, missing
# flutter, exploding command -> all FAIL. "Could not verify" is not "passed".
#
# NOTE (deliberate): this file is written in English, per CLAUDE.md's language
# policy (internal work is English; only director-facing output is Korean). It
# also avoids a real footgun — Windows PowerShell 5.1 reads .ps1 as ANSI unless
# the file has a UTF-8 BOM, which silently mangles non-ASCII source into
# mojibake and breaks parsing. English source sidesteps it entirely.
#
# Usage:
#   gate.ps1 -AppDir "C:\Users\user\loop_engine\myapp"
#   gate.ps1 -AppDir "..." -SkipBuild                          # fast inner rounds
#   gate.ps1 -AppDir "..." -JsonOut "C:\...\gate-result.json"
#
# Exit code: 0 = all checks passed, 1 = at least one failed. The quality loop
# trusts this number and nothing else.

param(
  [Parameter(Mandatory=$true)][string]$AppDir,
  [switch]$SkipBuild,
  [switch]$SkipTest,
  [string]$JsonOut = ""
)

$ErrorActionPreference = 'Continue'
$script:checks = @()

function Add-Check([string]$name, [bool]$pass, [string]$detail) {
  $script:checks += [pscustomobject]@{ name = $name; pass = $pass; detail = $detail }
  $mark = if ($pass) { 'PASS' } else { 'FAIL' }
  Write-Output ("[{0}] {1} - {2}" -f $mark, $name, $detail)
}

function Write-Result([bool]$pass) {
  $failed = @($script:checks | Where-Object { -not $_.pass } | ForEach-Object { $_.name })
  if ($JsonOut) {
    $dir = Split-Path -Parent $JsonOut
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    [pscustomobject]@{ pass = $pass; appDir = $AppDir; checks = $script:checks; failed = $failed } |
      ConvertTo-Json -Depth 5 | Out-File $JsonOut -Encoding utf8
  }
  Write-Output ""
  if ($pass) {
    Write-Output "GATE: PASS - Gate 1 cleared. Rubric scoring (Gate 2) may proceed."
  } else {
    Write-Output ("GATE: FAIL - failed checks: {0}. Do NOT score; fix and retry." -f ($failed -join ', '))
  }
}

# Pull the first few interesting lines out of a command's output for the detail
# string. Kept as a function so no nested quotes end up inside an interpolated
# string (that is what broke the first version of this script).
# PS 5.1 wraps each stderr line from a native exe in an ErrorRecord, so raw
# output is littered with "+ CategoryInfo ...", "+ FullyQualifiedErrorId ..."
# noise. Strip it — this excerpt is fed back to the implementer as a fix order,
# and PowerShell's plumbing is not the error they need to see.
function Get-Excerpt([string]$text, [string]$pattern, [int]$count = 3) {
  $lines = @(
    $text -split "`n" |
      Where-Object { $_ -match $pattern } |
      Where-Object { $_ -notmatch 'FullyQualifiedErrorId|CategoryInfo|RemoteException|NativeCommandError' } |
      Where-Object { $_.Trim() -notmatch '^\+' } |
      Select-Object -First $count
  )
  if ($lines.Count -eq 0) { return "" }
  return " :: " + (($lines | ForEach-Object { $_.Trim() }) -join ' | ')
}

# ── Preconditions: if we cannot check it, it FAILS ──
if (-not (Test-Path $AppDir)) {
  Add-Check "app-dir-exists" $false "app folder not found: $AppDir"
  Write-Result $false
  exit 1
}

if (-not (Test-Path (Join-Path $AppDir "pubspec.yaml"))) {
  Add-Check "flutter-project" $false "no pubspec.yaml - not a Flutter project; this gate only knows Flutter"
  Write-Result $false
  exit 1
}
Add-Check "flutter-project" $true "pubspec.yaml found"

$flutterCmd = $null
$found = Get-Command flutter -ErrorAction SilentlyContinue
if ($found) {
  $flutterCmd = $found.Source
} elseif (Test-Path "C:\develop\flutter\bin\flutter.bat") {
  $flutterCmd = "C:\develop\flutter\bin\flutter.bat"
}
if (-not $flutterCmd) {
  Add-Check "flutter-cli" $false "flutter command not found on PATH or at C:\develop\flutter\bin"
  Write-Result $false
  exit 1
}
Add-Check "flutter-cli" $true $flutterCmd

Push-Location $AppDir
try {
  # ── 1. Static analysis: zero errors ──
  $analyzeOut = & $flutterCmd analyze --no-pub 2>&1 | Out-String
  $analyzeCode = $LASTEXITCODE
  $analyzeOk = ($analyzeCode -eq 0)
  $analyzeDetail = "exit=$analyzeCode"
  if (-not $analyzeOk) { $analyzeDetail += (Get-Excerpt $analyzeOut 'error') }
  Add-Check "analyze" $analyzeOk $analyzeDetail

  # ── 2. Tests ──
  if (-not $SkipTest) {
    $testDir = Join-Path $AppDir "test"
    $testFiles = @()
    if (Test-Path $testDir) {
      $testFiles = @(Get-ChildItem $testDir -Recurse -Filter "*_test.dart" -ErrorAction SilentlyContinue)
    }
    if ($testFiles.Count -gt 0) {
      $testOut = & $flutterCmd test --no-pub 2>&1 | Out-String
      $testCode = $LASTEXITCODE
      $testOk = ($testCode -eq 0)
      $testDetail = "exit=$testCode, $($testFiles.Count) test file(s)"
      if (-not $testOk) { $testDetail += (Get-Excerpt $testOut 'failed|Error|Exception') }
      Add-Check "test" $testOk $testDetail
    } else {
      # Zero tests is not a pass, but it is not this gate's call either: some
      # tasks legitimately have no test surface. The rubric (Gate 2) decides
      # whether missing tests cost points. Recorded so it cannot hide.
      Add-Check "test" $true "no test files found (WARNING: not a pass signal - the rubric may deduct for this)"
    }
  }

  # ── 3. Build ──
  if (-not $SkipBuild) {
    $buildOut = & $flutterCmd build apk --debug --target-platform android-arm64 2>&1 | Out-String
    $buildCode = $LASTEXITCODE
    $buildOk = ($buildCode -eq 0)
    $buildDetail = "exit=$buildCode"
    if (-not $buildOk) { $buildDetail += (Get-Excerpt $buildOut 'Error|error:|FAILURE|Exception') }
    Add-Check "build" $buildOk $buildDetail
  }
}
finally {
  Pop-Location
}

# ── Verdict ──
$allPass = @($script:checks | Where-Object { -not $_.pass }).Count -eq 0
Write-Result $allPass
if ($allPass) { exit 0 } else { exit 1 }
