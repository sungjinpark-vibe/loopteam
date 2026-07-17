# ── Mechanical Gate (기계 Gate) — Unity ─────────────────────────────────────
# VISION.md section 3, "Gate 1". The objective signal the quality loop must pass
# BEFORE any rubric scoring happens. No human, no LLM. A command returns 0 or it
# does not.
#
# Book ch.12: "Verification must be able to actually fail. Verification that
#              passes no matter what comes in is decoration, not verification."
# So this script DOES NOT PASS WHAT IT CANNOT CHECK. Missing project, missing
# Unity, exploding command -> all FAIL. "Could not verify" is not "passed".
#
# WHY THIS DOES NOT TRUST UNITY'S EXIT CODE ALONE (load-bearing):
#   Unity in -batchmode is well known for exiting 0 even when scripts failed to
#   compile. Trusting the exit code alone would produce a gate that passes
#   broken code — exactly the decoration ch.12 warns about. So compilation is
#   judged by BOTH the exit code AND a scan of the editor log for CS-compiler
#   errors, and either one failing fails the gate. The log scan is not a
#   nicety; it is the real check. Verified against an injected compile error.
#
# Written in English per CLAUDE.md's language policy (internal work is English;
# only director-facing output is Korean). This also sidesteps a real footgun:
# Windows PowerShell 5.1 reads .ps1 as ANSI unless the file carries a UTF-8 BOM,
# which silently mangles non-ASCII source into mojibake and breaks parsing.
#
# Usage:
#   gate.ps1 -AppDir "C:\Users\user\loop_engine\<game>"
#   gate.ps1 -AppDir "..." -SkipTest                 # compile only (fast inner rounds)
#   gate.ps1 -AppDir "..." -JsonOut "C:\...\gate-result.json"
#
# Exit code: 0 = all checks passed, 1 = at least one failed. The quality loop
# trusts this number and nothing else.

param(
  [Parameter(Mandatory=$true)][string]$AppDir,
  [switch]$SkipTest,
  [string]$UnityExe = "",
  [string]$JsonOut = "",
  [int]$TimeoutMinutes = 20
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

# Pull interesting lines out of a log for the detail string. Kept as a function
# so no nested quotes end up inside an interpolated string, and so PowerShell's
# own ErrorRecord noise never reaches the implementer as if it were their bug.
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

# Run Unity in batchmode with a timeout. Unity can wedge (license, another
# editor holding the project lock); a hung gate is a stalled loop, so it is
# capped and a timeout is reported as FAIL, never as "inconclusive".
function Invoke-Unity([string[]]$UnityArgs, [string]$LogPath) {
  if (Test-Path $LogPath) { Remove-Item $LogPath -Force -ErrorAction SilentlyContinue }
  $p = Start-Process -FilePath $script:unityPath -ArgumentList $UnityArgs -PassThru -NoNewWindow
  # Touching .Handle is load-bearing, not defensive noise: a Process object from
  # Start-Process -PassThru does not cache its exit code unless the handle was
  # accessed before the process exits, and $p.ExitCode then comes back EMPTY.
  # An empty exit code would make every compile look inconclusive.
  $null = $p.Handle
  if (-not $p.WaitForExit($TimeoutMinutes * 60 * 1000)) {
    try { $p.Kill() } catch {}
    return @{ exitCode = -999; log = "TIMEOUT after $TimeoutMinutes minutes"; timedOut = $true }
  }
  $p.WaitForExit()   # parameterless: flushes async state so ExitCode is final
  $code = $p.ExitCode
  if ($null -eq $code) {
    # Never treat "we could not read the exit code" as success.
    $code = -998
  }
  $log = ""
  if (Test-Path $LogPath) { $log = Get-Content $LogPath -Raw -ErrorAction SilentlyContinue }
  return @{ exitCode = $code; log = $log; timedOut = $false }
}

# ── Preconditions: if we cannot check it, it FAILS ──
if (-not (Test-Path $AppDir)) {
  Add-Check "project-exists" $false "project folder not found: $AppDir"
  Write-Result $false
  exit 1
}

$versionFile = Join-Path $AppDir "ProjectSettings\ProjectVersion.txt"
if (-not ((Test-Path (Join-Path $AppDir "Assets")) -and (Test-Path $versionFile))) {
  Add-Check "project-exists" $false "no Assets/ + ProjectSettings/ProjectVersion.txt - not a Unity project"
  Write-Result $false
  exit 1
}
$projVersion = ((Get-Content $versionFile | Where-Object { $_ -match '^m_EditorVersion:' }) -replace 'm_EditorVersion:\s*','').Trim()
Add-Check "project-exists" $true "Unity project, editor version $projVersion"

# Locate the editor matching the project's own version. A different editor
# version silently upgrades the project — a destructive side effect a gate must
# never cause.
if ($UnityExe -and (Test-Path $UnityExe)) {
  # A caller-supplied editor gets the SAME version check as auto-detect — otherwise
  # -UnityExe is a backdoor around the no-silent-upgrade guarantee.
  $exeVersion = $null
  try {
    if ($UnityExe -match '\\Editor\\(\d+\.\d+\.\d+[a-z]\d+)\\') { $exeVersion = $Matches[1] }
    elseif ($UnityExe -match '\\(\d+\.\d+\.\d+[a-z]\d+)\\Editor\\Unity\.exe$') { $exeVersion = $Matches[1] }
    if (-not $exeVersion) {
      $fv = (Get-Item $UnityExe).VersionInfo.ProductVersion
      if ($fv -match '^(\d+\.\d+\.\d+[a-z]\d+)') { $exeVersion = $Matches[1] }
    }
  } catch {}
  if ($exeVersion -and ($exeVersion -ne $projVersion)) {
    Add-Check "unity-editor" $false "supplied -UnityExe is $exeVersion but the project needs $projVersion. Refusing to open with a different version - that would silently upgrade the project."
    Write-Result $false
    exit 1
  }
  if (-not $exeVersion) {
    Add-Check "unity-editor" $false "cannot determine the version of supplied -UnityExe ($UnityExe); refusing rather than risk a silent project upgrade. Omit -UnityExe to auto-detect."
    Write-Result $false
    exit 1
  }
  $script:unityPath = $UnityExe
} else {
  $candidate = "C:\Program Files\Unity\Hub\Editor\$projVersion\Editor\Unity.exe"
  if (Test-Path $candidate) {
    $script:unityPath = $candidate
  } else {
    $any = @(Get-ChildItem "C:\Program Files\Unity\Hub\Editor" -Directory -ErrorAction SilentlyContinue |
             ForEach-Object { Join-Path $_.FullName "Editor\Unity.exe" } | Where-Object { Test-Path $_ })
    if ($any.Count -gt 0) {
      Add-Check "unity-editor" $false "no editor for project version $projVersion (found: $($any -join ', ')). Refusing to open with a different version - that would silently upgrade the project."
      Write-Result $false
      exit 1
    }
    Add-Check "unity-editor" $false "no Unity editor found under C:\Program Files\Unity\Hub\Editor"
    Write-Result $false
    exit 1
  }
}
Add-Check "unity-editor" $true $script:unityPath

$logDir = Join-Path $AppDir "Logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }

# ── 1. Compile ──
# Opening the project in batchmode forces a script compile. Judged by exit code
# AND log scan — see the header for why the exit code alone is not trusted.
$compileLog = Join-Path $logDir "gate-compile.log"
$r = Invoke-Unity @('-batchmode','-quit','-nographics','-projectPath',$AppDir,'-logFile',$compileLog) $compileLog

if ($r.timedOut) {
  Add-Check "compile" $false "TIMEOUT after $TimeoutMinutes min - Unity wedged (another editor holding the project lock?)"
  Write-Result $false
  exit 1
}

# `error CS####` is the C# compiler; Unity prints it into the editor log even on
# runs that exit 0.
$csErrors = @($r.log -split "`n" | Where-Object { $_ -match 'error CS\d+' })
$compileOk = ($r.exitCode -eq 0) -and ($csErrors.Count -eq 0)
$compileDetail = "exit=$($r.exitCode), CS errors=$($csErrors.Count)"
if (-not $compileOk) {
  $compileDetail += (Get-Excerpt $r.log 'error CS\d+')
  if ($r.exitCode -eq 0 -and $csErrors.Count -gt 0) {
    $compileDetail += " [NOTE: Unity exited 0 despite compile errors - caught by log scan]"
  }
}
Add-Check "compile" $compileOk $compileDetail

if (-not $compileOk) {
  # Never run tests on code that does not compile: the failures would be noise
  # and would bury the actual cause.
  Write-Result $false
  exit 1
}

# ── 2. EditMode tests ──
if (-not $SkipTest) {
  $testAsmdefs = @(Get-ChildItem $AppDir -Recurse -Filter "*.asmdef" -ErrorAction SilentlyContinue |
                   Where-Object { (Get-Content $_.FullName -Raw) -match 'UnityEngine\.TestRunner|UnityEditor\.TestRunner|nunit\.framework' })
  if ($testAsmdefs.Count -gt 0) {
    $testLog = Join-Path $logDir "gate-test.log"
    $resultsXml = Join-Path $logDir "gate-test-results.xml"
    if (Test-Path $resultsXml) { Remove-Item $resultsXml -Force -ErrorAction SilentlyContinue }
    # -runTests must NOT be combined with -quit: Unity quits on its own when the
    # run finishes, and -quit would cut the run short before results are written.
    $t = Invoke-Unity @('-batchmode','-nographics','-projectPath',$AppDir,'-runTests','-testPlatform','EditMode','-testResults',$resultsXml,'-logFile',$testLog) $testLog

    if ($t.timedOut) {
      Add-Check "test" $false "TIMEOUT after $TimeoutMinutes min during test run"
    } elseif (-not (Test-Path $resultsXml)) {
      # No results file means the run did not complete. Absence of evidence is
      # not a pass.
      Add-Check "test" $false "test run produced no results file (exit=$($t.exitCode)) - cannot confirm tests ran"
    } else {
      [xml]$xml = Get-Content $resultsXml -Raw
      $total  = [int]$xml.'test-run'.total
      $failed = [int]$xml.'test-run'.failed
      $testOk = ($failed -eq 0) -and ($t.exitCode -eq 0)
      $testDetail = "exit=$($t.exitCode), total=$total, failed=$failed"
      if (-not $testOk) { $testDetail += (Get-Excerpt $t.log 'Failed|Expected:|But was:') }
      Add-Check "test" $testOk $testDetail
    }
  } else {
    # Zero tests is not a pass signal, but it is not this gate's call: some
    # tasks legitimately have no test surface. The rubric (Gate 2) decides
    # whether missing tests cost points. Recorded so it cannot hide.
    Add-Check "test" $true "no test assemblies found (WARNING: not a pass signal - the rubric may deduct for this)"
  }
}

# ── Verdict ──
$allPass = @($script:checks | Where-Object { -not $_.pass }).Count -eq 0
Write-Result $allPass
if ($allPass) { exit 0 } else { exit 1 }
