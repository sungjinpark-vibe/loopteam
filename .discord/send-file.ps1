# Sends a file to the Discord channel as a message attachment (images render
# inline in Discord automatically — no separate sendPhoto-style endpoint
# needed, unlike Telegram).
# Usage: send-file.ps1 -Path "<file>" [-Caption "<text>"]
param(
  [Parameter(Mandatory=$true)][string]$Path,
  [string]$Caption = ""
)
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
try { & "$dir\le-watchdog.ps1" | Out-Null } catch {}
$cfg = Get-Content "$dir\config.json" -Raw | ConvertFrom-Json
if (-not (Test-Path $Path)) { Write-Output "ERROR: file not found: $Path"; exit 1 }
$file = Get-Item $Path

Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromMinutes(10)
$client.DefaultRequestHeaders.Add("Authorization", "Bot $($cfg.token)")
$client.DefaultRequestHeaders.Add("User-Agent", "DiscordBot (https://github.com/sungjinpark-vibe/loop-engine, 1.0)")
$content = New-Object System.Net.Http.MultipartFormDataContent
if ($Caption) { $content.Add((New-Object System.Net.Http.StringContent($Caption)), "content") }
$stream = [System.IO.File]::OpenRead($file.FullName)
$fileContent = New-Object System.Net.Http.StreamContent($stream)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
$content.Add($fileContent, "files[0]", $file.Name)
try {
  $resp = $client.PostAsync("https://discord.com/api/v10/channels/$($cfg.channel_id)/messages", $content).Result
  $respBody = $resp.Content.ReadAsStringAsync().Result
  if ($resp.IsSuccessStatusCode) { Write-Output "sent: $($file.Name)" }
  else { Write-Output "ERROR $($resp.StatusCode): $respBody" }
} finally {
  $stream.Close(); $client.Dispose()
}
