# Marketing

Owned by the weekly **Marketer** (`.claude/agents/marketer.md`). Alex reads this folder,
the `marketing` / `needs-alex` issues, and the metrics section of the weekly report.

- **Public name:** ShooterCoaster. **Home:** https://scoaster.com
  (https://shooter-coaster.vercel.app keeps working).
- **Analytics:** Vercel Web Analytics only (Alex's decision, 2026-10-22). The team is on
  Pro, so custom events and UTM dimensions are available; events are listed here once #98
  ships. Test traffic (`?e2e=1`) is never counted (`src/app/analyticsGate.ts`).
- **Spend:** the cap is `ad_budget_usd_per_month` in `docs/agents/STEERING.md`. Agents never
  spend, post or create accounts: the Marketer drafts, Alex approves and places, until an ad
  platform is connected and STEERING.md says the Marketer may run campaigns within the cap.

| File | What |
|---|---|
| `STRATEGY.md` | Positioning, audience, channel ranking, launch stage, experiment queue |
| `BUDGET.md` | Monthly cap, proposed / approved / spent ledger |
| `CHANNELS.md` | Every post or campaign and what it did to traffic |
| `metrics/<YYYY>-W<ww>.md` | Weekly numbers from Vercel Web Analytics |
