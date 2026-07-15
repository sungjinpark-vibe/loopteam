# Persistent Discord listener (daemon) — same self-healing v3 design as
# .telegram/tg-daemon.ps1, adapted for Discord's REST API (no long-poll
# support like Telegram's getUpdates timeout, so this short-interval polls
# GET /channels/{id}/messages?after=<last_id> every ~3s instead).
#
# ISOLATION FROM OTHER PROJECTS (2026-07-12, user directive: "다른 클로드코드
# 프로젝트도 디스코드로 소통할꺼야. 서로 간섭하지 않도록"): this project's own
# Discord bot has its own unique token, so there is no API-level conflict
# possible with a different project's differently-tokened bot. The only real
# risk is OS-level: two unrelated listener daemons on the same PC. Mitigated
# exactly like the Telegram v3 fix:
#   - Named mutex embeds THIS bot's own unique numeric ID, so it cannot
#     collide with any other project's mutex name by construction.
#   - Never kills any process by name/pattern — only ever the exact PID this
#     project itself recorded in le-daemon-pid.txt.
#   - Relaunched by the watchdog via a fixed vbs (opaque -EncodedCommand),
#     same anti-pattern-kill precaution as tg-daemon.
#
# DISCORD-SPECIFIC NOTES:
#   - Every request needs a real User-Agent header or Discord's edge (Cloudflare)
#     403s resource-scoped routes (channels/guilds) with an opaque
#     `{"code":40333,"message":"internal network error"}` — confirmed by hand
#     during setup. Always send `User-Agent: DiscordBot (<url>, <ver>)`.
#   - GET .../messages?after=X can return messages in either order; we sort
#     ascending by snowflake ID ourselves (BigInteger-safe: snowflakes can
#     exceed Int64 in theory) before processing, and advance last-id.txt to
#     the max ID seen.
#   - The bot is a channel member, so polling also returns the bot's OWN sent
#     messages (send.ps1 output) — filtered out by author.id == our own bot ID
#     (fetched once at startup via /users/@me), or every send.ps1 call would
#     echo right back into incoming.log.
#
# How the PM consumes it: read `.discord\incoming.log`. Each message is a
# block: `### MESSAGE <id> <HH:mm:ss> from <username>` then `text:`/`photo ->`/
# `document:` lines. Track the highest id in `.discord\handled.txt`.
param([int]$MaxSeconds = 86400)
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfg = Get-Content "$dir\config.json" -Raw | ConvertFrom-Json
$token = $cfg.token
$channelId = $cfg.channel_id
$apiBase = "https://discord.com/api/v10"
$headers = @{
  Authorization = "Bot $token"
  "User-Agent"  = "DiscordBot (https://github.com/sungjinpark-vibe/loop-engine, 1.0)"
}

# ── Single instance: named mutex scoped by our own bot's unique id (cannot
# collide with any other project's mutex — never kills any process) ──
try {
  $me = Invoke-RestMethod -Uri "$apiBase/users/@me" -Headers $headers -Method Get -ErrorAction Stop
  $botId = $me.id
} catch { Write-Output "FATAL: could not authenticate bot token: $($_.Exception.Message)"; exit 1 }

$mutex = New-Object System.Threading.Mutex($false, "LoopEngine-DiscordDaemon-SingleInstance-$botId")
$owned = $false
try { $owned = $mutex.WaitOne(0) }
catch [System.Threading.AbandonedMutexException] { $owned = $true }
if (-not $owned) { Write-Output "ALREADY_RUNNING (mutex held by live daemon) - exiting quietly"; exit 0 }

$pidFile = "$dir\le-daemon-pid.txt"
$hbFile  = "$dir\le-daemon-heartbeat.txt"
$errLog  = "$dir\le-daemon-error.log"
Set-Content -Path $pidFile -Value $PID -Encoding ascii
function Write-Heartbeat { try { Set-Content -Path $hbFile -Value (Get-Date -Format o) -Encoding ascii } catch {} }
function Write-ErrLog($msg) { try { Add-Content -Path $errLog -Value "$(Get-Date -Format o) $msg" } catch {} }

$stateFile = "$dir\last-id.txt"
$incomingLog = "$dir\incoming.log"
$inbox = "$dir\inbox"
if (-not (Test-Path $inbox)) { New-Item -ItemType Directory $inbox | Out-Null }
if (Test-Path $stateFile) { $lastId = (Get-Content $stateFile -Raw).Trim() } else { $lastId = "0" }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Add-Incoming($text) {
  try { [System.IO.File]::AppendAllText($incomingLog, $text, $utf8NoBom) } catch {}
}

function Download-Attachment($url, $suggestName) {
  try {
    $dest = Join-Path $inbox $suggestName
    $i = 1; $stem = [System.IO.Path]::GetFileNameWithoutExtension($suggestName); $ex = [System.IO.Path]::GetExtension($suggestName)
    while (Test-Path $dest) { $dest = Join-Path $inbox "$stem`_$i$ex"; $i++ }
    Invoke-WebRequest -Uri $url -OutFile $dest -Headers @{ "User-Agent" = $headers["User-Agent"] } -UseBasicParsing
    return $dest
  } catch { return "DOWNLOAD_ERROR: $($_.Exception.Message)" }
}

Write-Output "LISTENER_STARTED (discord persistent v3, pid=$PID, bot=$botId, MaxSeconds=$MaxSeconds)"
Write-Heartbeat
$deadline = (Get-Date).AddSeconds($MaxSeconds)
while ((Get-Date) -lt $deadline) {
  Write-Heartbeat
  try {
    $msgs = Invoke-RestMethod -Uri "$apiBase/channels/$channelId/messages?limit=100&after=$lastId" -Headers $headers -Method Get -ErrorAction Stop
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match '429') { Write-ErrLog "429 rate limited: $msg" }
    else { Write-ErrLog "poll error: $msg" }
    Start-Sleep -Seconds 5; continue
  }
  if ($msgs.Count -gt 0) {
    # sort ascending by snowflake id (BigInteger-safe) so we always process
    # oldest-first and advance last-id.txt to the true max seen.
    $sorted = $msgs | Sort-Object -Property @{ Expression = { [System.Numerics.BigInteger]::Parse($_.id) } }
    foreach ($m in $sorted) {
      # Advance the cursor for EVERY message, including our own, BEFORE the
      # skip. Only the logging is filtered — not the cursor.
      #
      # This ordering is load-bearing (bug found 2026-07-16, inherited from
      # app-dev-team where it was latent): `?after=<id>&limit=100` returns the
      # OLDEST 100 messages after the cursor. If our own sends never advanced
      # the cursor, an autonomous loop — which reports far more often than the
      # director replies — would fill that 100-message window with its own
      # reports. The director's next message would fall outside the window and
      # never be read, and the loop would wait forever on an approval that was
      # already given. Chat-driven use hides this; a loop walks straight into it.
      $lastId = $m.id
      if ($m.author.id -eq $botId) { continue }  # skip logging our own sends
      $when = (Get-Date $m.timestamp).ToLocalTime().ToString("HH:mm:ss")
      $name = if ($m.author.global_name) { $m.author.global_name } else { $m.author.username }
      $block = "### MESSAGE $($m.id) $when from $name`r`n"
      Write-Output "=== NEW MESSAGE ($when) from $name ==="
      if ($m.content) { Write-Output "text: $($m.content)"; $block += "text: $($m.content)`r`n" }
      foreach ($att in $m.attachments) {
        $isImage = $att.content_type -and $att.content_type.StartsWith("image/")
        $p = Download-Attachment $att.url $att.filename
        if ($isImage) {
          Write-Output "photo -> saved: $p"; $block += "photo -> $p`r`n"
        } else {
          Write-Output "document: $($att.filename) -> saved: $p"; $block += "document: $($att.filename) -> $p`r`n"
        }
      }
      $block += "`r`n"
      Add-Incoming $block
    }
    Set-Content -Path $stateFile -Value $lastId -Encoding ascii
  }
  Start-Sleep -Seconds 3
}
Write-Output "IDLE_TIMEOUT (watchdog will restart within ~1 min)"
