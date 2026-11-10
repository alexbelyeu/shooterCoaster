## 2026-11-10 — The Climber: a `wall` surface, the escape rule, the chalk puff (Builder, #453)

**Context:** The Climbing Gym (#438) needs enemies that climb walls, a fourth placement surface beside air, ground and water.

**Decision:**
- **Wall surface.** A level lists its climbable walls as `LevelConfig.walls` (`WallSurface`: id, `origin` = bottom-left
  corner, unit `right` and `up`, `width`, `height`; the face points along `right × up`, towards the ride). `ENEMY_PLACEMENT`
  gives wall enemies `surface: 'wall', scatter: 'wall'`: the spawner starts each at the foot of a seeded wall
  (`wallSlots`, the run's rng), `WALL_STANDOFF` off its face, never pushed out of the near field and never flown in. A
  level with wall enemies and no walls, or a wall wave with a formation, throws.
- **Escape rule.** A climber that tops out escapes: it despawns unscored, with no penalty. `maxScore` still counts it, so
  letting one go costs only its points. `EnemyBase` supports this generally: `updatePosition` returning `'escaped'`
  unmounts the enemy through `onEscape`; the spawner takes it off the remaining count without the last-kill slow-mo.
- **Chalk puff.** Its death style is pale motes that drift slowly down plus a few helmet / harness flecks, no lit chunks
  and no flash; its kill sound is the new `KillSound` `'chalk'` (a dry pop, then a dust hiss). Nothing falls off the wall:
  the brief is friendly, no falls and no ragdoll.

**Consequences:** A gym level only adds walls and climber waves. The climb's pace (~1 m/s, `climbMotion.ts` `METRE` = 33
units) and the wall's height set how long a climber stays shootable: a level tunes its walls' heights, not the motion.
