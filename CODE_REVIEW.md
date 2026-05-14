# Code Review — MC Server Manager

Static review of the codebase performed before the
`claude/codebase-review-refactor-7HkiE` refactor.

## Application Goal

**MC Server Manager** is a self-hosted, single-page web dashboard for
controlling a Minecraft server running on the same Ubuntu VM. It is one
Node.js process that:

- serves the built React/Vite frontend on port 80,
- exposes a REST + Socket.IO API,
- starts and stops the MC server via `screen` and a `start.sh` script,
- tails `logs/latest.log` for live console output and player join/leave events,
- reads and writes `server.properties` and `whitelist.json`,
- collects host CPU / RAM / storage metrics for system gauges,
- streams a tar.gz of the world directory for backups.

## Feature Inventory (implemented)

- Server status header (status, MOTD, IP, version, player count, uptime)
- Server control buttons (start / stop / restart)
- Live console with command input and ↑↓ history
- Online player list with search, sort, OP badges
- System metrics gauges: CPU (JVM vs other), RAM (allocation marker), Storage
- `server.properties` editor
- Whitelist manager (add / remove / enforce toggle)
- JVM parameters reference panel
- World backup download (tar.gz stream)
- Real-time updates over Socket.IO with polling fallback

## Categorized Findings

Each finding lists pre-refactor `file:line` references. Items marked
**[fixed]** are addressed by this refactor; **[deferred]** are intentionally
out of scope.

### Critical bugs

- **[fixed]** `src/pages/Dashboard.tsx:14,20` — `<ServerHeader />` and
  `<ControlButtons />` were rendered without their required `status` prop, so
  the header was permanently stuck on "Loading…" and the control buttons never
  appeared.
- **[fixed]** `backend/services/ServerManager.ts:113` — `getUptime()` returned
  **milliseconds** but `ServerStatus.uptime` was consumed as **seconds** in
  `ServerHeader.formatUptime`, so reported uptime was ~1000× too large.
- **[fixed]** `src/hooks/useConsoleCommand.ts:75` — `on('console:command:executed', …)`
  was called in the render body instead of inside a `useEffect`, leaking a new
  socket listener every render.
- **[fixed]** `src/components/ConsoleInput.tsx:30-37` — dead `useEffect` whose
  body contained an `if` with empty bodies.
- **[fixed]** `backend/server.ts:37-43` + `249-276` — two separate
  `io.on('connection')` handlers; the first was dead. The metrics
  `setInterval` was created on every connection without ever being cleared,
  leaking timers.

### Security / correctness

- **[fixed]** `backend/services/ServerManager.ts:55` — `execAsync(\`cd ${minecraftDir} && ./start.sh\`)`
  interpolated an env-controlled value into a shell string. Now uses
  `execFile(startScript, [], { cwd })` so the value cannot be interpreted as
  shell syntax.
- **[fixed]** `backend/server.ts:150-197` — whitelist routes accepted any
  `uuid` string from the body / URL. UUID format is now validated in both
  `ConsoleManager` and the route handlers; invalid input returns 400.
- **[fixed]** `backend/server.ts:107-119` — `/api/console/command` passed the
  body straight through with no validation. Now rejects empty input and any
  command containing characters outside an allow-list.
- **[fixed]** `backend/server.ts:97-105` — `limit` query had no upper bound;
  now clamped to `[1, 1000]`.
- **[fixed]** `backend/services/MetricsCollector.ts:71` — `df -B1 /home` was
  hardcoded. Now uses `STORAGE_PATH` (env) and defaults to `MINECRAFT_DIR`.
- **[fixed]** All backend routes — every `catch` returned a generic 500 with
  no `console.error`, making production debugging impossible. Errors are now
  logged via a shared `fail()` helper.

### Cleanliness / future-proofing

- **[fixed]** `MINECRAFT_DIR` resolution and derived paths were duplicated in
  four services with a `process.env.HOME` fallback. Centralized into
  `backend/config.ts` (uses `os.homedir()`).
- **[fixed]** `any` in `backend/server.ts`, `backend/services/ConsoleManager.ts`,
  `src/hooks/useApi.ts`, `src/hooks/useServerSocket.ts` — replaced with
  `unknown` / generics. AGENTS.md disallows `any`.
- **[fixed]** Dependency conflict — both `package-lock.json` and
  `pnpm-lock.yaml` were committed. Standardized on npm (matches CI); removed
  `pnpm-lock.yaml`.
- **[fixed]** Unused `@tanstack/react-query` dependency removed.
- **[fixed]** Inline layout styles in `src/pages/Dashboard.tsx` replaced with
  `.dashboard__*` CSS classes; AGENTS.md disallows non-dynamic inline styles.
- **[fixed]** `backend/services/ConsoleManager.ts:77` — `watchLogs()` returned
  a never-resolving promise to "keep watching indefinitely"; replaced with a
  long-lived `FSWatcher` reference that is closed on `stop()`.
- **[fixed]** No `SIGTERM`/`SIGINT` handler. Added graceful shutdown that
  closes the HTTP server, Socket.IO, the log watcher, and the metrics interval.
- **[fixed]** Metrics interval emitted even with zero connected clients —
  now guarded by `io.sockets.sockets.size > 0`.
- **[fixed]** Duplicate `<h2>Server Console</h2>` (Dashboard wrapper plus
  ConsolePanel's internal header). Dashboard no longer wraps the console with
  an extra section header.
- **[fixed]** `src/hooks/useApi.ts` — `loading` flipped to `true` on every
  poll, causing UI flicker. Now only the first load toggles `loading`.
- **[fixed]** `useServerSocket` created a fresh `Socket` per component
  mount. Now uses a shared, ref-counted singleton.
- **[fixed]** `README.md` was out of date (every Phase 2/3 feature unchecked
  despite being implemented; still described nginx-based deployment that was
  removed in commit `0a5eb02`). Refreshed.
- **[fixed]** `AGENTS.md` mentioned TanStack Query (never used) and nginx
  (replaced by Node serving on port 80). Updated.

### Deferred (intentional, out of scope)

- **[deferred]** Real player UUIDs — `PlayerManager.generateUUID` derives a
  deterministic pseudo-UUID from the player name. Replacing it with the real
  UUID requires parsing the "UUID of player X is …" log line; left as a
  follow-up.
- **[deferred]** Player IP capture — `Player.ip` is hard-coded to `0.0.0.0`.
- **[deferred]** Tests — no test suite exists; adding one is out of scope for
  this pass.
- **[deferred]** Replacing `screen`/`pkill` with RCON — the current
  process-based approach works for the documented deployment and was kept as-is.

## Build / Verification

```
npm run typecheck   # passes
npm run build:prod  # passes
```
