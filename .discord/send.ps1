# Sends a text message to the configured Discord channel (Korean, user-facing).
# Usage: send.ps1 "message"
param([Parameter(Mandatory=$true, ValueFromRemainingArguments=$true)][string[]]$Text)
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
# Self-heal: make sure our listener daemon is alive before messaging the user
# (watchdog is idempotent — exits instantly when the heartbeat is fresh).
try { & "$dir\le-watchdog.ps1" | Out-Null } catch {}
$cfg = Get-Content "$dir\config.json" -Raw | ConvertFrom-Json
$msg = ($Text -join " ")
$headers = @{
  Authorization  = "Bot $($cfg.token)"
  "User-Agent"   = "DiscordBot (https://github.com/sungjinpark-vibe/loop-engine, 1.0)"
  "Content-Type" = "application/json"
}
$body = @{ content = $msg } | ConvertTo-Json
try {
  $r = Invoke-RestMethod -Uri "https://discord.com/api/v10/channels/$($cfg.channel_id)/messages" -Headers $headers -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
  Write-Output "sent: message_id=$($r.id)"
} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
}
