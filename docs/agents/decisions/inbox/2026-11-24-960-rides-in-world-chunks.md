## 2026-11-24 — Every generated ride but level 1's lives in its world's chunk (builder, #960)

**Context:** The Director raised `startupJsGzipKB` 392 → 398 on 2026-11-24 so the desert and ocean rides could land: every
generated ride (`<name>Level.ts`, ~1.2–4.2 KB gz each, the gym's with its walls) was imported by the level registry, which is
startup JS. The #863 entry named the fix.

**Decision:** A level's ride is a `LevelRide` (`track`, `walls`, `seaArch`), split out of `LevelConfig`. Only level 1's and the
hand-written trig tracks (level 7, new-world starters: a few hundred bytes) sit in the registry as `LevelConfig.ride`; every
other generated ride is its world's: `biomes/<biome>/world.ts` `rides`, so it arrives with the chunk the loading screen already
fetches and `LevelScene` already waits for (no extra request, no new failure path). The game reads a ride only through
`worlds.ts` `levelRide(id)`: the registry's, else the loaded world's (#980: the registry keeps no load-order state). Tests and dev pages read every level whole from
`shippedLevels.ts`, which no game module may import (`worlds.test.ts`); `rideLevels.test.ts` holds it to the worlds' chunks.
The title never reads a level's track, so level 1's ride could move too; it stays because the issue scoped it so and it is
the first run most players start.

**Consequences:** Startup JS 393 → 386 KB gz; `startupJsGzipKB` lowered 398 → 389 (measured + 2, rounded up; lowering needs no
Director). A new generated ride goes in its world's `rides.ts` (#980: `shippedLevels.ts` gathers them), never the registry (`docs/LEVEL-KIT.md`).
Nothing before a run (title, level select, postcards, `maxScore`, stars, `nextLevel`, the HUD's radar) may need a ride.
Total JS is ~2 KB gz more: each ride now compresses in its own world chunk.
