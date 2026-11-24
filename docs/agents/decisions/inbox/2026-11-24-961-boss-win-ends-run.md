## 2026-11-24 — A boss win with nothing left ends the run (Builder, #961)

**Context:** A fast boss kill left the rider up to 12 s of empty ride before the results (#925's review, #937).
**Decision:** Once the boss is beaten, the run ends 3 s of game time later (`src/levels/bossWin.ts`) if no enemy is left
to kill, no wave is still due and no golden balloon is still up; the check runs every frame after the defeat, so a run
cleared by a later kill ends too. Golden balloons count as something left (they are in `maxScore`'s bonus), so a level 1
player who missed one rides on to the timer as before. The end goes through GameTimer's own path; a clear in the run's
last 3 s is left to the timer. Golden balloon pops no longer count against the spawner's enemy tally (they never were in
its total, so a pop read as an enemy kill and could fire the last-kill slow-mo early).
**Consequences:** Results can show "N seconds to spare". Scores, `maxScore` and stars are unchanged. A level without a
boss (a `finale` wave) still always runs to the timer.
