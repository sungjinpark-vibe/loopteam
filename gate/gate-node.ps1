# ── Mechanical Gate (기계 Gate) — Node/React (Apps-in-Toss mini-apps) ───────
# VISION.md section 3, "Gate 1", for projects whose stack is React/TS/Vite
# (create-ait-app) rather than Unity. Same JSON/exit-code contract as
# gate/gate.ps1 so gate-runner's existing instructions work unchanged — only
# the script path in the command differs.
#
# No human, no LLM. A command returns 0 or it does not. "Could not verify" is
# not "passed" — missing project, missing npm, exploding command all FAIL.
#
# Usage:
#   gate-node.ps1 -AppDir "C:\Users\user\loop_engine\<app>"
#   gate-node.ps1 -AppDir "..." -JsonOut "C:\...\gate-result.json"
#
# Exit code: 0 = all checks passed, 1 = at least one failed.

param(
  [Parameter(Mandatory=$true)][string]$AppDir,
  [string]$JsonOut = "",
  [int]$TimeoutMinutes = 10,
  [switch]$SkipTest
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

function Get-Excerpt([string]$text, [int]$count = 15) {
  if (-not $text) { return "" }
  $lines = @($text -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last $count)
  if ($lines.Count -eq 0) { return "" }
  return " :: " + (($lines | ForEach-Object { $_.Trim() }) -join ' | ')
}

# Runs a command via cmd.exe (so npm/npx .cmd shims resolve reliably on
# Windows) with a hard timeout. A hung install/build is a stalled loop, so it
# is capped and a timeout is reported as FAIL, never as "inconclusive".
function Invoke-Cmd([string]$commandLine, [string]$cwd, [int]$timeoutMinutes) {
  $outFile = [System.IO.Path]::GetTempFileName()
  $errFile = [System.IO.Path]::GetTempFileName()
  try {
    $p = Start-Process -FilePath "cmd.exe" -ArgumentList @('/c', $commandLine) -WorkingDirectory $cwd `
      -PassThru -NoNewWindow -RedirectStandardOutput $outFile -RedirectStandardError $errFile
    $null = $p.Handle
    if (-not $p.WaitForExit($timeoutMinutes * 60 * 1000)) {
      try { $p.Kill() } catch {}
      return @{ exitCode = -999; output = "TIMEOUT after $timeoutMinutes minutes"; timedOut = $true }
    }
    $p.WaitForExit()
    $code = $p.ExitCode
    if ($null -eq $code) { $code = -998 }
    $out = (Get-Content $outFile -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content $errFile -Raw -ErrorAction SilentlyContinue)
    return @{ exitCode = $code; output = $out; timedOut = $false }
  } finally {
    Remove-Item $outFile, $errFile -Force -ErrorAction SilentlyContinue
  }
}

# ── Preconditions ──
if (-not (Test-Path $AppDir)) {
  Add-Check "project-exists" $false "project folder not found: $AppDir"
  Write-Result $false
  exit 1
}
$AppDir = (Resolve-Path $AppDir).Path

$pkgJson = Join-Path $AppDir "package.json"
if (-not (Test-Path $pkgJson)) {
  Add-Check "project-exists" $false "no package.json - not a Node project"
  Write-Result $false
  exit 1
}
$pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
Add-Check "project-exists" $true "Node project: $($pkg.name)"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Add-Check "npm-available" $false "npm not found on PATH"
  Write-Result $false
  exit 1
}
Add-Check "npm-available" $true (npm --version)

# ── 1. Install ──
$hasLock = Test-Path (Join-Path $AppDir "package-lock.json")
$installCmd = if ($hasLock) { "npm ci" } else { "npm install" }
$r = Invoke-Cmd $installCmd $AppDir $TimeoutMinutes
if ($r.timedOut) {
  Add-Check "install" $false "TIMEOUT after $TimeoutMinutes min running '$installCmd'"
  Write-Result $false
  exit 1
}
$installOk = ($r.exitCode -eq 0)
Add-Check "install" $installOk ("exit=$($r.exitCode)" + $(if (-not $installOk) { Get-Excerpt $r.output } else { "" }))
if (-not $installOk) {
  Write-Result $false
  exit 1
}

# ── 2. Type-check (if the project has a tsconfig) ──
# A root tsconfig.json with "files": [] and "references" (the standard Vite
# scaffold shape: app + node build-tool configs split out) checks ZERO files
# when run plain — `tsc --noEmit` at root then reports success trivially.
# Found 2026-08-02 (T004, app_in_toss): the typecheck check had been a no-op
# since T002 without ever failing loudly. Detect references and check each
# referenced project explicitly instead of trusting the root config.
$tsconfigPath = Join-Path $AppDir "tsconfig.json"
if (Test-Path $tsconfigPath) {
  $refPaths = @()
  try {
    $tsconfigRaw = (Get-Content $tsconfigPath -Raw) -replace '//[^\n]*', ''
    $tsconfigObj = $tsconfigRaw | ConvertFrom-Json -ErrorAction Stop
    if ($tsconfigObj.references) {
      $refPaths = @($tsconfigObj.references | ForEach-Object { $_.path })
    }
  } catch {
    # Malformed/JSONC tsconfig the simple parser can't handle - fall through
    # to checking the root config directly rather than silently skipping.
  }

  if ($refPaths.Count -gt 0) {
    $allTsOk = $true
    $tsDetail = @()
    foreach ($ref in $refPaths) {
      $r = Invoke-Cmd "npx tsc --noEmit -p `"$ref`"" $AppDir $TimeoutMinutes
      if ($r.timedOut) {
        $allTsOk = $false
        $tsDetail += "$ref -> TIMEOUT after $TimeoutMinutes min"
      } elseif ($r.exitCode -ne 0) {
        $allTsOk = $false
        $tsDetail += "$ref -> exit=$($r.exitCode)$(Get-Excerpt $r.output)"
      } else {
        $tsDetail += "$ref -> exit=0"
      }
    }
    Add-Check "typecheck" $allTsOk ("project references: " + ($tsDetail -join ' | '))
  } else {
    $r = Invoke-Cmd "npx tsc --noEmit" $AppDir $TimeoutMinutes
    if ($r.timedOut) {
      Add-Check "typecheck" $false "TIMEOUT after $TimeoutMinutes min running 'npx tsc --noEmit'"
    } else {
      $tsOk = ($r.exitCode -eq 0)
      Add-Check "typecheck" $tsOk ("exit=$($r.exitCode)" + $(if (-not $tsOk) { Get-Excerpt $r.output } else { "" }))
    }
  }
} else {
  Add-Check "typecheck" $true "no tsconfig.json found - skipped"
}

# ── 3. Build ── (never run on code that failed to typecheck: the errors would be noise)
$typecheckOk = ($script:checks | Where-Object { $_.name -eq 'typecheck' }).pass
if ($typecheckOk) {
  $buildScript = if ($pkg.scripts -and $pkg.scripts.build) { "npm run build" } else { $null }
  if ($buildScript) {
    $r = Invoke-Cmd $buildScript $AppDir $TimeoutMinutes
    if ($r.timedOut) {
      Add-Check "build" $false "TIMEOUT after $TimeoutMinutes min running '$buildScript'"
    } else {
      $buildOk = ($r.exitCode -eq 0)
      Add-Check "build" $buildOk ("exit=$($r.exitCode)" + $(if (-not $buildOk) { Get-Excerpt $r.output } else { "" }))
    }
  } else {
    Add-Check "build" $false "package.json has no 'build' script - cannot verify the app actually builds"
  }
} else {
  Add-Check "build" $false "skipped - typecheck failed first"
}

# ── 4. Tests (not a pass signal if absent, same policy as the Unity gate) ──
$testScript = if ($pkg.scripts -and $pkg.scripts.test -and ($pkg.scripts.test -notmatch 'no test specified')) { "npm test" } else { $null }
if ($SkipTest) {
  Add-Check "test" $true "skipped (-SkipTest — not a pass signal, for fast compile-only checks only)"
} elseif ($testScript) {
  $r = Invoke-Cmd $testScript $AppDir $TimeoutMinutes
  if ($r.timedOut) {
    Add-Check "test" $false "TIMEOUT after $TimeoutMinutes min running '$testScript'"
  } else {
    $testOk = ($r.exitCode -eq 0)
    Add-Check "test" $testOk ("exit=$($r.exitCode)" + $(if (-not $testOk) { Get-Excerpt $r.output } else { "" }))
  }
} else {
  Add-Check "test" $true "no test script found (WARNING: not a pass signal - the rubric may deduct for this)"
}

# ── 5. Lint (not skipped when present — a rubric may claim lint is enforced) ──
if ($pkg.scripts -and $pkg.scripts.lint) {
  $r = Invoke-Cmd "npm run lint" $AppDir $TimeoutMinutes
  if ($r.timedOut) {
    Add-Check "lint" $false "TIMEOUT after $TimeoutMinutes min running 'npm run lint'"
  } else {
    $lintOk = ($r.exitCode -eq 0)
    Add-Check "lint" $lintOk ("exit=$($r.exitCode)" + $(if (-not $lintOk) { Get-Excerpt $r.output } else { "" }))
  }
} else {
  Add-Check "lint" $true "no lint script found - skipped"
}

# ── 6. Project-defined extra checks (e.g. a fixture-not-in-production-bundle
# assertion) — this script stays stack-generic; a project defines its own via
# a "gate:extra" script in its own package.json, same pattern as EditMode
# tests being project-specific for the Unity gate. ──
if ($pkg.scripts -and $pkg.scripts.'gate:extra') {
  $r = Invoke-Cmd "npm run gate:extra" $AppDir $TimeoutMinutes
  if ($r.timedOut) {
    Add-Check "gate:extra" $false "TIMEOUT after $TimeoutMinutes min running 'npm run gate:extra'"
  } else {
    $extraOk = ($r.exitCode -eq 0)
    Add-Check "gate:extra" $extraOk ("exit=$($r.exitCode)" + $(if (-not $extraOk) { Get-Excerpt $r.output } else { "" }))
  }
} else {
  Add-Check "gate:extra" $true "no 'gate:extra' script found - skipped"
}

# ── Verdict ──
$allPass = @($script:checks | Where-Object { -not $_.pass }).Count -eq 0
Write-Result $allPass
if ($allPass) { exit 0 } else { exit 1 }
