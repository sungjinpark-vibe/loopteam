# Discord listener internals (read only when debugging)

Moved out of `CLAUDE.md` 2026-07-19 (token economy) — this is the full self-healing daemon design.

## Listener design (self-healing daemon)
- `le-daemon.ps1` polls `GET /channels/{id}/messages?after=<last_id>` every ~3s → appends to
  `incoming.log`. Filters out the bot's own messages so `send.ps1` output never echoes back.
- Single instance via a **named mutex scoped to this bot's own unique numeric ID**
  (`LoopEngine-DiscordDaemon-SingleInstance-<botId>`) — collision-proof against any other project's
  listener by construction. **Never kills any process by name/pattern** — only ever the exact PID in
  `le-daemon-pid.txt`.
- `le-watchdog.ps1` (idempotent "ensure running"): heartbeat stale (>120s) → stop by exact PID →
  relaunch via `_le-daemon-trigger.vbs` (opaque `-EncodedCommand`; `wscript.exe` has no console
  subsystem, so **nothing ever flashes a window**).
- Scheduled task **`LoopEngine-DiscordDaemon-Watchdog`** every 1 min → self-heals within ~60s.
  `send.ps1`/`send-file.ps1` also call the watchdog before sending.
- **Discord gotcha**: resource-scoped routes (`/channels/{id}`, `/guilds/{id}/...`) 403 with an opaque
  `{"code":40333,"message":"internal network error"}` unless a real `User-Agent` header is sent —
  PowerShell's default UA gets blocked by Discord's edge. Every script here sends
  `User-Agent: DiscordBot (...)`. If you ever see that exact error, this is why.

## incoming.log rotation (token economy, 2026-07-19)
The scout reads `incoming.log` every tick, and the daemon only appends — so the file is a slow token
leak. Rotation is the **scout's** job (it owns the inbox): when `incoming.log` exceeds ~20KB, move the
fully-handled prefix (all messages with id ≤ `handled.txt`) to `incoming-archive.log` and rewrite
`incoming.log` with only the unhandled tail. Never touch messages above the handled id.
