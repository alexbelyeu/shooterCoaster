## 2026-11-02 — The smoke's level steps run on capped level time and a paced ride (builder, #305)

**Context:** The level steps sampled the ride stats and the perf gate after 10 s of wall time, while the level timer
advanced by the raw frame delta and the coaster by at most 3/60 s a frame. On a 2-core runner (~2.8 s frames) the
level was ~20 s in when sampled, later waves were on screen (`scene objs` over budget), and level3 reached its Kraken
during combat; main went red without a code change. The ride, bound to the frame count, also left level3 with one
readable enemy on slow boxes (#250).

**Decision:** The level steps set `__SC_TEST__.timerStepMax` (a per-frame cap on level time + game clock; faster
frames pass through): `--seconds / --min-frames` on the ride, which stops at `--seconds` of *level* time with game
time frozen for the stats, shot and enemy probe; 0.25 s in combat. During the ride `rideRate` 0.14 rides that share
of the level time (CI's ~2.8 fps × 0.05 s, where the budgets were set). The perf gate keeps counting enemies and the
budgets are unchanged. The readability probe rides on to 16 s of level time, past the 15 s second waves: on CI it
used to run there by accident, and from the smoke's track point level3 shows one readable enemy at 10 s (#250). `hidden-pause`'s wave slack is 1 s (whole-second timer store) + 2 × the longest frame since
Resume, not a fixed 3 s.

**Consequences:** Don't go back to wall-clock waits for level checks: the budgets and readability gate assume that
moment and track point. Players keep the frame-delta timer and ride (`levelTimeStep` / `e2eRideSeconds` only act
under `?e2e=1` with the knobs set). If CI's runners get much faster, its natural ride no longer matches 0.14, which
is fine: the smoke now sets it.
