## 2026-11-24 — A boss win with nothing left ends the run (Builder, #961)

**Context:** A fast boss kill left the rider up to 12 s of empty ride before the results (#925's review, #937).
**Decision:** Once the boss is beaten, the run ends 3 s of game time later (`src/levels/bossWin.ts`) if no enemy is left
to kill, no wave is still due and no golden balloon is still up; the check runs every frame after the defeat, so a run
cleared by a later kill ends too. A golden balloon still up counts as something left (it is in `maxScore`'s bonus); one
that floated off counts as gone. An enemy still alive counts as left even when the rider has passed it, so no scorable
target is ever cut off; a looser "nothing shootable" rule is a follow-up. The end goes through GameTimer's own path; a clear in the run's
last 3 s is left to the timer. Golden balloon pops no longer count against the spawner's enemy tally (they never were in
its total, so a pop read as an enemy kill and could fire the last-kill slow-mo early).
**Consequences:** Results can show "N seconds to spare". Scores, `maxScore` and stars are unchanged. A level without a
boss (a `finale` wave) still always runs to the timer.
