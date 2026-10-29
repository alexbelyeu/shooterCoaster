## 2026-10-29 — Boss framework: weak points in phases, mounted dormant, timed on the level timer (Builder, #181)

**Context:** Each level gets a finale boss (VISION; Theme Park's Golden Blimp first, Ocean's Kraken next).
Bosses need several hit zones, phases, their own HUD and score, without forking the enemy, combo,
score-popup, SFX or kill-counter paths.

**Decision:**
- Rules are pure in `src/entities/bosses/bossModel.ts`: a `BossSpec` is a list of weak points
  (`id`, `radius`, `offset`, `hp`, `score`, `phase`) plus a `reward` and a `tell`. Only the
  lowest phase with a live weak point is exposed; the boss is defeated when every weak point is
  destroyed. Total hp is derived (`maxHp`), not stored. Specs live in `bossSpecs.ts`;
  `computeMaxScore(waves, boss)` adds `bossMaxScore` (Σ weak point scores + reward), so `maxScore`
  and stars include the boss.
- `BossBase.tsx` registers one `CollisionManager` target per *exposed* weak point, and re-syncs
  them inside the hit itself (not in an effect), so the next hit in the same frame or JS turn
  already sees the new phase and aim assist never snaps to a hidden one. Each destroyed weak point
  is a normal kill (`registerKill` + `addScore`, kill pop, explosion, `enemy:killed`), so combos,
  popups, SFX and kills/accuracy work unchanged; the last one also scores the reward. Boss
  events: `boss:spawn`, `boss:hit`, `boss:defeated`. HUD state is `boss` in the game store
  (reset by `startRun`), so the bar survives the HUD remounting after a pause.
- A concrete boss supplies `move(frame)` (root and weak point groups, game time, time since
  defeat), `body`, `rigging` and `renderWeakPoint`. A Kraken's independently moving tentacles
  animate their part groups in `move`; a retract phase can be a new `retracted` set on
  `BossState` filtered by `exposedWeakPoints`.
- `BossSpawner` mounts the boss **dormant** (invisible, no targets) with the level, so
  `ShaderWarmup`'s warm-up frame compiles its programs (incl. the instanced confetti); it shows
  the tell at `at - tell.seconds` and activates at `at`, both read from GameTimer's
  `timeRemaining` (pause- and countdown-safe), not `setTimeout`.
- The Golden Blimp rides with the coaster (a fixed distance ahead of the camera's smoothed
  horizontal heading) rather than holding a world position: the ride covers thousands of units
  in the ~20 s finale, and a fixed boss would be behind the rider in seconds.

**Consequences:** A new boss is a spec, a component around `BossBase` and an entry in
`BOSS_COMPONENTS`; its geometry/materials go in `bossAssets.ts` (walked by `ShaderWarmup`).
The boss's kills count toward `kills` but not the HUD's wave kill strip (`totalEnemies`).
