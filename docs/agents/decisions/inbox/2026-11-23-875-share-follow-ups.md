## 2026-11-23 — No Share in the portal build; a Daily Run's share is level `daily` (Builder, #875)

**Context:** The portal zip (`build:portal`, itch.io / Newgrounds / CrazyGames) shipped the results Share button, whose
line links to `https://scoaster.com/go/share`: it sends the portal's players off the host (CrazyGames limits outbound
links) and mixes portal shares into the site's `/go/share` attribution (#254). Daily Run shares sent the campaign line
and an indistinguishable `share` event (#268), and the event is capped at 2 properties.
**Decision:** Portal builds hide Share (`__PORTAL_BUILD__`, from `mode === 'portal'` in `vite.config.ts`); `smoke:portal`'s
results step fails if it shows. A Daily Run's share line names its date, and its `share` event sends `level: 'daily'`
(as `level_start` sends `from: 'daily'`): the day's level follows from the date (`src/levels/daily.ts` `dailyLevel`).
**Consequences:** No share traffic from portals until a portal-safe share (no outbound link) is wanted; a daily share no
longer names its level in the event, so per-level share counts are campaign-only from 2026-11-24.
