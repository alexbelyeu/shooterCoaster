## 2026-11-07 — Real-player telemetry is first-party: one beacon per page load to `/api/telemetry`, read back as a public 24 h summary (Builder, #373)

**Context:** Nothing told the studio how the game runs for real players (CI renders on SwiftShader; Web Analytics
counts pages and level events). Hard rule 4 allows a new runtime network call only with an entry here; the issue rules
out third-party SDKs and anything identifying.
**Decision:** The game sends at most one `navigator.sendBeacon` per page load to its own `/api/telemetry` (a Vercel
Function next to the leaderboard, same Supabase project and env vars, table `telemetry_reports`), when the page is
first hidden or closed and only if it has something to say: up to 5 deduped errors (message + first stack frame, URLs
cut to their path), WebGL context losses, and per level played its median / p95 frame time with the quality and dpr,
plus touch / desktop, `hardwareConcurrency` and the GPU renderer string. Same gate as Web Analytics (Vercel builds
only; never `?e2e=1`, `?internal=1` or the portal build). No ids or cookies; the rate limit (10 reports per IP per 10
min) keys rows by an HMAC of the IP under a salt that changes every UTC day, so rows can't be linked across days, and
rows older than 30 days are deleted. `GET /api/telemetry` serves only an aggregate of the last 24 h (CDN-cached 5
min), and the status page and the watchdog read that over HTTPS: no Supabase secret in GitHub. Errors from other
origins and extensions are dropped. A level's phone budget is the new `budgets.json` `playerFrameMs.touchP95` (33.4
ms: past two vsyncs at 60 Hz), judged on the median of phone sessions' p95 once 3 sessions played it in 24 h; an error
is filed once seen in 3 sessions.
**Consequences:** The summary is public: it shows the game's own error messages and GPU names, nothing about a
player. Errors after the beacon has gone (the tab came back) are not reported. Alex runs
`supabase/migrations/0002_telemetry.sql` once; until then the endpoint answers 503 and the status page says
telemetry is unavailable. Only the Director changes `playerFrameMs`.
