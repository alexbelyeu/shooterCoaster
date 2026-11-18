## 2026-11-18 — The intro swoop rides the countdown's own clock (Builder, #328)

**Context:** The swoop from over the landmark into the seat must land exactly at GO, but Ready waits for the level
chunk and the shader warm-up (up to 4 s, the camera seeing nothing until it ends), so the time before GO isn't fixed,
and the countdown's timing was out of scope.
**Decision:** The swoop is not a fixed 3 s clip. Once the level shows, it eases toward 40% of its path through Ready;
when Set starts, `Countdown` publishes GO's time (`core/introShot.ts`) and a Hermite carries it from where it is, at its
speed, to the seat with zero speed exactly at GO (`introCamera.hot.ts` `stepSwoopClock`): ~1.7 s on a warm start. A
skip tap cuts to the seat. The results screen's backdrop is lighter at the edges so the orbit behind it shows.
**Consequences:** Lengthening Ready / Set lengthens the swoop with no camera change; a fixed-length swoop would land
early or late. Darkening the results backdrop again hides the orbit.
