# Marketing

Owned by the weekly **Marketer** (`.claude/agents/marketer.md`). Alex reads this folder,
the `marketing` / `needs-alex` issues, and the metrics section of the weekly report.

- **Public name:** ShooterCoaster. **Home:** https://scoaster.com
  (https://shooter-coaster.vercel.app keeps working).
- **Analytics:** Vercel Web Analytics only (Alex's decision, 2026-10-22). The team is on
  Pro, so custom events (with their properties) are available. **UTM dimensions are not:**
  the query API answers `402 … UTM dimensions require an Enterprise plan or the Web Analytics
  Plus add-on` (read 2026-10-26), so `utm_*` parameters on our links are invisible to us.
  Campaign attribution uses the **referrer hostname** and the **request path**: every link we
  hand out points at a campaign landing path `https://scoaster.com/go/<campaign>` (the
  `vercel.json` catch-all rewrite serves the game at any path and the page view records it as
  `requestPath`). The smoke `landing` step (#171) pins it: `/go/smoke-check` must boot to the
  title with no failed request and keep its path, and `robots.txt` keeps `/go/` out of search
  results. Don't redirect these paths to `/`: the page view would lose them. One campaign
  name per post or placement: `showcase`, `webgames`, `playmygame`, `share` (the results-screen
  share button, #87), `crazygames` … Keep the `utm_*` parameters on the
  links anyway: they cost nothing and other tools read them. Test traffic (`?e2e=1`) and
  internal browsers are never counted (`src/app/analyticsGate.ts`). Custom events (`src/app/analyticsEvents.ts`; at most
  two per run, at most 2 properties each, the Pro limit):

  | Event | Properties | Sent when |
  |---|---|---|
  | `level_start` | `level` (`level1`…) | A run begins: from level select, Replay or Next Level. From 2026-10-24 it fires when the Ready / Set / GO countdown starts, so a player who leaves during it still counts as a start |
  | `level_complete` | `level`, `stars` (0–3) | The timer runs out and the results screen opens |
  | `level_quit` | `level`, `progress_pct` (0, 10 … 100: share of the level timer used) | Quit to Menu from the pause screen |
  | `share` | `level`, `stars` (0–3) | The results-screen Share button opened the share sheet and the player picked a target, or copied the line to the clipboard (a dismissed sheet sends nothing). Rare and player-initiated, so it sits outside the ≤ 2 per run count |

  Completion rate per level = `level_complete` / `level_start`. The Share button (#87,
  copy in `src/ui/share.ts`) shares "I scored 1,240 ★★☆ on Theme Park in ShooterCoaster 🎢 —
  beat me:" with `https://scoaster.com/go/share?utm_source=share&utm_medium=organic&utm_campaign=results`,
  so its visits show as `requestPath` `/go/share`. Pausing and resuming send nothing; closing
  the tab mid-run sends no `level_quit` (starts minus completes minus quits ≈ abandons).
- **Internal traffic (Alex's devices).** Open **https://scoaster.com/?internal=1** once in
  each browser and on each device you play on. The browser remembers it (localStorage), the
  parameter disappears from the address bar, and from then on that browser sends no page
  views and no events, including that first visit. The title screen shows a small
  "internal: not tracked" in the top-right corner while it's on. **https://scoaster.com/?internal=0**
  turns it off; any other value (`?internal=false`) changes nothing. Clearing site data or a
  private window forgets it, so open the link again.
  Vercel Web Analytics has no IP or user exclusion, so this is the only filter.
- **2026-10-22 and 2026-10-23 traffic is internal.** Every visitor and every level event on
  those two days was Alex setting up and testing on his own devices. They are not players:
  never report them as such. The baseline starts on the first day after his browsers carry
  the `?internal=1` flag (2026-10-24 at the earliest).
- **Ignore bounce rate.** The game is one page: title, levels and results never load a new
  page, so Vercel counts nearly every visit as a "bounce" however long it plays (81% on
  2026-10-23 meant nothing). Engagement = `level_start` / visitors and the completion rate
  above.
- **Querying.** Team `team_krR6Pnp5Vum0BzUHDl5TSjOK` ("Belyeu's projects"), project
  `prj_dJiZbChPwWWNFzebuIjEGcypBOpP`. The API worked with `teamId` from the first page view
  (2026-10-26 run). It snaps `since` / `until` to **UTC days**, so a New York week is queried
  as `2026-10-19T04:00Z … 2026-10-26T04:00Z` and the daily rows come back as UTC days; say so
  in the metrics file rather than pretending they are New York days. Available breakdowns:
  `day`, `country`, `deviceType`, `osName`, `browserName`, `referrerHostname`, `requestPath`;
  events by `eventName` and `eventData/<property>` (`level`, `stars`, `progress_pct`).
  Bounce rate is not in the API (and meaningless here, below).
- **If the Vercel connector answers "Web Analytics not found"** while the dashboard shows
  data, the connector can't see the "Belyeu's projects" team: say so in the metrics file and
  the report (no invented numbers) and ask Alex to reconnect it with that team granted.
- **Spend:** the cap is `ad_budget_usd_per_month` in `docs/agents/STEERING.md`. Agents never
  spend, post or create accounts: the Marketer drafts, Alex approves and places, until an ad
  platform is connected and STEERING.md says the Marketer may run campaigns within the cap.

| File | What |
|---|---|
| `STRATEGY.md` | Positioning, audience, channel ranking, launch stage, experiment queue |
| `BUDGET.md` | Monthly cap, proposed / approved / spent ledger |
| `CHANNELS.md` | Every post or campaign and what it did to traffic |
| `metrics/<YYYY>-W<ww>.md` | Weekly numbers from Vercel Web Analytics |
