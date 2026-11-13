## 2026-11-13 — The smoke steps level time only once React has settled (Builder, #471)

**Context:** The pacing step and the ride shot gave different enemy counts for the same seed run to run and between a
local session and CI. Level time was stepped in fixed amounts per frame, but waves, enemy mounts, fly-ins ending and boss
arrivals go through React state, which lands a varying number of frames later; bosses also moved on the frame's delta.
**Decision:** `e2e/settledSteps.mjs` defines a minimal React devtools hook before the page loads (`addInitScript`) to
count commits, and the ride and pacing step level time once, then hold it until a held frame sees no commit and a posted
message answered. Bosses step on the game clock (`gameClockStep`), never the frame's delta. The game itself is unchanged
for players; nothing reads the devtools hook outside the smoke.
**Consequences:** Same seed, same pacing timeline and ride count on any runner (checked locally with 3x CPU throttling).
A run costs about one held frame per step on top of its steps. Don't go back to per-frame `timerStep` / `timerStepMax`
for anything that counts enemies; gameplay motion added later must use the game clock, not `delta`.
