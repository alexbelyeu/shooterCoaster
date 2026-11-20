## 2026-11-20 — Weather pulses: streaks in view space, fog colour unchanged (Builder, #798)

**Context:** The Desert's sandstorm and Antarctica's blizzard (`EnemyWave.weather`) close the fog in and drive streaks across the view for one wave.
**Decision:** The streaks live in view space (placed and moved in the vertex shader, one instanced draw, 0 instances outside the pulse) so they always sweep across the screen whatever way the coaster faces; only fog near / far change, never the fog colour, which stays the sky's `horizon` so the terrain's edge never shows against the dome. The weather sits on its wave beside `isEruption`; the spawner emits `weather:start` with the kind, and the pulse's rise / hold / fade is a particle boost's envelope (`stepBoost`), on game time.
**Consequences:** Streaks don't parallax with the ride; tinting the fog would need the sky dome tinted with it.
