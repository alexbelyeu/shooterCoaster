# Marketing

Owned by the weekly **Marketer** (`.claude/agents/marketer.md`). Alex reads this folder,
the `marketing` / `needs-alex` issues, and the metrics section of the weekly report.

- **Public name:** ShooterCoaster. **Home:** https://scoaster.com
  (https://shooter-coaster.vercel.app keeps working).
- **Analytics:** Vercel Web Analytics only (Alex's decision, 2026-10-22). The team is on
  Pro, so custom events and UTM dimensions are available. Test traffic (`?e2e=1`) and
  internal browsers are never counted (`src/app/analyticsGate.ts`). Custom events (`src/app/analyticsEvents.ts`; at most
  two per run, at most 2 properties each, the Pro limit):

  | Event | Properties | Sent when |
  |---|---|---|
  | `level_start` | `level` (`level1`…) | A run begins: from level select, Replay or Next Level. From 2026-10-24 it fires when the Ready / Set / GO countdown starts, so a player who leaves during it still counts as a start |
  | `level_complete` | `level`, `stars` (0–3) | The timer runs out and the results screen opens |
  | `level_quit` | `level`, `progress_pct` (0, 10 … 100: share of the level timer used) | Quit to Menu from the pause screen |

  Completion rate per level = `level_complete` / `level_start`. There is no share button
  in the game yet, so there is no `share` event. Pausing and resuming send nothing; closing
  the tab mid-run sends no `level_quit` (starts minus completes minus quits ≈ abandons).
- **Internal traffic (Alex's devices).** Open **https://scoaster.com/?internal=1** once in
  each browser and on each device you play on. The browser remembers it (localStorage), the
  parameter disappears from the address bar, and from then on that browser sends no page
  views and no events, including that first visit. The title screen shows a small
  "internal: not tracked" in the top-right corner while it's on. **https://scoaster.com/?internal=0**
  turns it off. Clearing site data or a private window forgets it, so open the link again.
  Vercel Web Analytics has no IP or user exclusion, so this is the only filter.
- **2026-10-22 and 2026-10-23 traffic is internal.** Every visitor and every level event on
  those two days was Alex setting up and testing on his own devices. They are not players:
  never report them as such. The baseline starts on the first day after his browsers carry
  the `?internal=1` flag (2026-10-24 at the earliest).
- **Ignore bounce rate.** The game is one page: title, levels and results never load a new
  page, so Vercel counts nearly every visit as a "bounce" however long it plays (81% on
  2026-10-23 meant nothing). Engagement = `level_start` / visitors and the completion rate
  above.
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
