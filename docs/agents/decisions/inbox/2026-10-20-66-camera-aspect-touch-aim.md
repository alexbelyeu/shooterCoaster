## 2026-10-20 — Camera aspect + portrait FOV, time-based bullets, touch aim assist (Builder, #66)

**Context:** On phones the world looked squashed and taps missed. Root cause confirmed
with the e2e hook: `CoasterCamera` mounts its own camera and calls `set({ camera })`,
and R3F only re-applies `camera.aspect` when the canvas *size/dpr changes*, so the
gameplay camera kept three.js's default aspect of 1 on every screen (squashed on a
390x844 phone, stretched 1.78x wide on 1280x720 desktop) until a resize. Bullets moved
14 units per frame with a point-in-sphere hit test, so they were slow at phone frame
rates and could tunnel through small targets on a long frame.

**Decision:**
- `CoasterCamera` sets `aspect` (and FOV) from `useThree(s => s.size)` on mount and on
  every resize/rotation. The level FOV stays the *vertical* FOV (80°); on narrow screens
  `fovForAspect` (`src/track/cameraFov.ts`) widens it to keep a 60° horizontal FOV,
  clamped at 100° vertical (390x844 → 100° x 58°, was 80° x 42°). Desktop/landscape keep 80°.
- Bullets travel `BULLET_SPEED_PER_SEC` (840 = old 14/frame at 60 fps) scaled by the frame
  delta, and hit-test the swept segment prev → position (`bulletMotion.ts`).
- Touch shots (only) snap to the nearest enemy whose screen centre is within 44 CSS px
  of the finger and get a 1.25x hit radius (`aimAssist.ts`). Mouse/pen aim is unchanged.

**Consequences:** Desktop now renders with correct proportions too, which means a wider
horizontal view (112° at 16:9 instead of 80° stretched): enemies look round and slightly
narrower, and a few more objects are in view (draw calls up a little; scene totals
unchanged). Don't "fix" desktop back to aspect 1. Smoke asserts camera aspect == canvas
aspect (±0.01) on desktop and on phone portrait/landscape/rotated back, and requires
kills from taps offset up to 30 px from enemies (game time frozen while tapping).
