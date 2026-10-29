## 2026-10-28 — Gameplay clips render in virtual time, outside the game (builder, #100)

**Context:** `npm run clip` needs every frame to be exactly 1/30 s of game time while
SwiftShader takes ~1.5 s to draw one. The issue suggested a fixed-step mode in the e2e hook
(R3F `frameloop="never"` + `advance()`), but much of the game reads wall time, not the R3F
delta: wave timers and FRENZY reset (`setTimeout`), explosions, bullets, the golden balloon
and the shot-aim hold (`performance.now()`), framer-motion HUD tweens. A delta-only mode
would play those in real time, so an explosion would vanish within one captured frame.

**Decision:** `scripts/clip.mjs` fakes time for the whole page instead: Playwright's
`page.clock` (paused) owns `performance.now`, `Date` and timers, an init script replaces
`requestAnimationFrame` with a queue the script flushes once per captured frame, CSS
animations / transitions are paused and stepped through `document.getAnimations()`, and
`Math.random` is seeded. No game code changes, so nothing ships to players. Loading waits
run frames with the clock frozen (boot excepted), so the ride always starts at `--from` with
the full timer. Screenshots go through CDP `Page.captureScreenshot`: Playwright's
`page.screenshot` waits for a real animation frame and stalls ~20 s per shot here.

**Consequences:** any new time source in the game is captured correctly as long as it
reads `performance.now`/`Date`/timers/rAF or is a Web Animation. Anything on another
clock (the Web Audio clock, a Worker's timers) runs in real time during the clip; keep
gameplay-visible motion off those. Frames step 33 ms (the fake
clock ticks whole ms), so a 30 fps clip plays 1% slow.
