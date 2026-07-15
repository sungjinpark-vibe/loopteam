# Watchdog for the Discord listener daemon (le-daemon.ps1 v3). Idempotent:
# safe (and cheap) to run every minute and before every outgoing send. Mirrors
# .telegram/daemon-watchdog.ps1 exactly (see that file for full rationale).
#
#   fresh heartbeat (<120s)  -> exit silently (daemon healthy)
#   stale/missing heartbeat  -> stop the old daemon by its EXACT recorded PID
#                               only (never by process-name/pattern), then
#                               relaunch via a fixed, no-argument vbs shim so
#                               nothing ever flashes a console window (Task
#                               Scheduler launching powershell.exe -WindowStyle
#                               Hidden can still flash for a frame; wscript.exe
#                               has no console subsystem at all).
#
# Registered as Windows scheduled task `LoopEngine-DiscordDaemon-Watchdog`
# (every 1 minute) => any kill/crash/reboot self-heals within ~60 seconds.
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$hbFile = "$dir\le-daemon-heartbeat.txt"

$fresh = $false
if (Test-Path $hbFile) {
  try {
    $age = ((Get-Date) - (Get-Item $hbFile).LastWriteTime).TotalSeconds
    if ($age -lt 120) { $fresh = $true }
  } catch {}
}
if ($fresh) { exit 0 }

$pidFile = "$dir\le-daemon-pid.txt"
if (Test-Path $pidFile) {
  $oldPid = 0
  try { $oldPid = [int]((Get-Content $pidFile -Raw).Trim()) } catch {}
  if ($oldPid -gt 0) {
    $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq 'powershell') {
      try { Stop-Process -Id $oldPid -Force -Confirm:$false -ErrorAction Stop } catch {}
    }
  }
}

Start-Process wscript.exe -ArgumentList '//B',"$dir\_le-daemon-trigger.vbs"
try { Add-Content -Path "$dir\le-watchdog.log" -Value "$(Get-Date -Format o) restarted daemon (heartbeat stale or missing)" } catch {}
Write-Output "DAEMON_RESTARTED"
