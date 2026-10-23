# Marketing

Owned by the weekly **Marketer** (`.claude/agents/marketer.md`). Alex reads this folder,
the `marketing` / `needs-alex` issues, and the metrics section of the weekly report.

- **Public name:** ShooterCoaster. **Home:** https://scoaster.com
  (https://shooter-coaster.vercel.app keeps working).
- **Analytics:** Vercel Web Analytics only (Alex's decision, 2026-10-22). The team is on
  Pro, so custom events and UTM dimensions are available. Test traffic (`?e2e=1`) is never
  counted (`src/app/analyticsGate.ts`). Custom events (`src/app/analyticsEvents.ts`; at most
  two per run, at most 2 properties each, the Pro limit):

  | Event | Properties | Sent when |
  |---|---|---|
  | `level_start` | `level` (`level1`…) | A run begins: from level select, Replay or Next Level |
  | `level_complete` | `level`, `stars` (0–3) | The timer runs out and the results screen opens |
  | `level_quit` | `level`, `progress_pct` (0, 10 … 100: share of the level timer used) | Quit to Menu from the pause screen |

  Completion rate per level = `level_complete` / `level_start`. There is no share button
  in the game yet, so there is no `share` event. Pausing and resuming send nothing; closing
  the tab mid-run sends no `level_quit` (starts minus completes minus quits ≈ abandons).
- **Spend:** the cap is `ad_budget_usd_per_month` in `docs/agents/STEERING.md`. Agents never
  spend, post or create accounts: the Marketer drafts, Alex approves and places, until an ad
  platform is connected and STEERING.md says the Marketer may run campaigns within the cap.

| File | What |
|---|---|
| `STRATEGY.md` | Positioning, audience, channel ranking, launch stage, experiment queue |
| `BUDGET.md` | Monthly cap, proposed / approved / spent ledger |
| `CHANNELS.md` | Every post or campaign and what it did to traffic |
| `metrics/<YYYY>-W<ww>.md` | Weekly numbers from Vercel Web Analytics |
