## 2026-11-09 — Bosses: retracted weak points and thrown projectiles (Builder, #319)

**Context:** The Yeti (Antarctica's finale) exposes its chest only while it roars, and throws snowballs the player
can shoot. The boss framework (2026-10-29) had phases but no way to hide a live weak point, and no notion of
anything a boss throws.

**Decision:**
- `BossState.retracted` (a set of weak point ids) hides a weak point without changing its phase: `exposedWeakPoints`
  filters it out, `applyHit` ignores it, `setRetracted` returns the same state when nothing changes. A boss toggles it
  from `move` through `BossFrame.retract(id, on)`, which re-syncs the collision targets at once, like a hit does.
  The Yeti keeps its chest un-retracted during phase 0 (its phase hides it anyway), so the hit that breaks the last fist
  exposes the chest in the same JS turn, and the next frame starts a roar at once (`roarNowEpoch`).
- Projectiles are not weak points: they never move `hpFraction` or the boss bar. Each is its own collision target with
  an id prefixed `boss-projectile:` (not `boss:`, so e2e `bossHit` skips them and they are shot like enemies), and a
  hit is a normal kill (`registerKill` + `addScore`, explosion, `enemy:killed`). They are bonus kills, so the level's
  `maxScore` (and stars) leave them out, but `BossSpec.projectiles` (`score`, `max`) adds them to the leaderboard's
  server limits (`scoreLimits.ts`), and the boss never throws more than `max` in a fight.
- A snowball homes on a point beside the camera as it moves (its arc is laid between its release point and that point
  each frame), so it always passes the rider instead of landing where the camera was.

**Consequences:** A boss that hides a part (a shell, a dive) or throws things reuses these two pieces. Raising a
projectile's score or `max` changes `api/_lib/levelLimits.ts` (`node scripts/gen-level-limits.mjs`).
