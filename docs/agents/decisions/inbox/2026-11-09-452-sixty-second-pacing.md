## 2026-11-09 — Every run is 60 s, timed by one pacing template (Builder, #452)

**Context:** Alex (#434): every run should last 60 s. Levels ran 60 / 65 / 75 / 75 / 120 s with
hand-typed wave seconds and bosses at 40–55 s, so some ended in a long tail with nothing to shoot.

**Decision:** `RUN_SECONDS = 60` in `src/levels/pacing.ts` is the level timer's one source
(`LevelConfig.timerSeconds` is gone). A level lists a roster; `paceLevel` times it: waves spread
over the first 45 s by `weight` (default 1), the first at 0 s, the last in by 33 s (shootable by
35 s after its ≤ 2 s fly-in), and the boss at 40 s. 40 s = two thirds in: the bosses were already
built for ~20 s fights (Blimp and Yeti 20 s, Scorpion 18 s, Kraken 25 s), and the smoke's boss step
now times each fight at 2 hits a second (Blimp 6.5 s, Scorpion 10.3 s, Yeti 11.5 s, Kraken 14.3 s),
so 20 s leaves room for a player who misses; a later boss would cut it, an earlier one would thin
the waves. A level without a boss names a `finale` wave in the boss's place (Inferno's drakes until
the Magma Titan, #320). Hand-timed `enemies` are still accepted as an escape hatch; no level uses it.
Density: Theme Park, the bar, keeps its 3 × 50 balloons (on-screen density is the feel Alex likes;
fewer balloons left 4 on screen at 10 s and failed the smoke); the others come up to 2–3 enemies a
second, held where the draw-call ceilings bind (Ocean 82 / 89, Antarctica 226 / 250 at the ride
shot). Star thresholds stay fractions of the new `maxScore`s.

**Consequences:** No per-wave seconds in `LevelRegistry.ts`; a new world gets the shape for free
(epic #437). The ride is *not* timed by the run: a 60 s lap would mean 2.2–3.8× today's average
speed, a different ride, so laps stay 99–228 s (pinned in `track/ridePhysics.test.ts`); any change
there is a deliberate design call. Leaderboard scores from before this change are on other rosters
(the reset is its own issue).
