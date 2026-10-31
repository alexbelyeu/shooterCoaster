## 2026-10-31 — Local leaderboard: saved at once, renamed in place; persisted data is sanitised on load (Builder, #40)

**Context:** The results screen asks a placing run for arcade initials. A player can leave
(Levels / Replay / tab close) before confirming, and localStorage can hold anything: an older
build's shape, a hand edit, a half-written value.
**Decision:** `leaderboards` (top 10 per level, `store/leaderboard.ts`) and `lastInitials`
persist beside `savedScores` under the same `shootercoaster-scores` key; `ScoreEntry` is
unchanged. The run's entry is stored the moment the results screen mounts, under the last
initials used, and every letter change renames it in place (`setEntryInitials`), so no exit path
loses it; confirming only closes the entry. A tie ranks below the entries already there. The
persist `merge` runs everything loaded through `sanitizeSavedScores` / `sanitizeLeaderboards` /
`normalizeInitials`, so bad data loads as valid or empty, never as a crash; a level with a saved
best but no board (saves from before this) starts its board with that best under `---`.
While the entry is open it owns the keyboard (R is a letter, Enter confirms); the screen's
Enter = next / R = replay return once it is confirmed. Settings "Clear local data" wipes
scores, stars (so unlocks) and boards, not settings. A future daily mode must keep its own
best and never enter these boards.
**Consequences:** Anything new in the persisted game store needs its own sanitiser in that
`merge`, or it bypasses the guard.
