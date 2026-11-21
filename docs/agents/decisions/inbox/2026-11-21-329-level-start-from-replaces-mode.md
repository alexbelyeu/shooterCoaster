## 2026-11-21 — Title PLAY starts a run; `level_start` carries `from` instead of `mode` (Builder, #329)

**Context:** Title PLAY now starts the player's next level straight away (WORLDS opens the level select). The
Marketer needs to know which screen started each run, but Vercel Pro allows at most 2 properties per event and
`level_start` already had `level` and `mode`.
**Decision:** `level_start` is `{ level, from }` with `from` one of `title`, `select`, `results`, `pause`, `daily`.
`daily` stands for any Daily Run start, so it carries everything `mode` did (`from: daily` ⇔ `mode: daily`); a
Daily Run's Replay is `daily`, not `results`. The store keeps `runFrom` per run and a persisted `lastLevel`
(the last campaign level started), which `nextLevelForPlayer` falls back to once every level has a star.
**Consequences:** Dashboards reading `mode` stop getting it from this release (docs/marketing/README.md says so).
Adding a third `level_start` property means dropping one of these two.
