## 2026-11-17 — The Flame's fire is instanced flame tongues, not a raymarched volume (Builder, #595)

**Context:** #583 / #595 asked for fire with volume and motion on the Flame, choosing between a raymarched
volume in a box round it, a GPU fluid grid, layered soft sheets / particles on a noise field, or a baked flipbook.
**Decision:** ~260 soft flame tongues in one instanced draw (`gym/FlameFire.tsx`, layout in pure `gym/flameFire.ts`):
each a camera-facing (round the vertical) quad on a three-point path that hugs the Flame's flare, with its own
life, sway and fbm flame shape, re-seeded every life; premultiplied blending (adds light, dims what's behind by
its alpha) and a blackbody ramp past 1 for Bloom. Low quality and touch draw fewer (`tongueCount`, the quality's
`particleScale`, half on touch) with the quality's `fbmOctaves`: same program, only the octave define differs.
A raymarch would cost a fill-bound full-screen-ish pass of 3D noise per step over a Flame that fills half the
screen on the spiral (SwiftShader and the MacBook Neo, #561), needs a depth texture for the boulder and track,
and an extra render target; a fluid grid adds per-frame simulation passes and float render targets. Tongues
get parallax and overlap for free from real 3D positions, are depth-tested against the boulder, cost one
draw call and scale by instance count.
**Consequences:** the fire is fill-bound by tongue count × size: thin it with `MAX_TONGUES` or the widths in
`buildFlameTongues`, not by removing noise. Part 2 (light on the surroundings, smoke, heat haze, scorch) builds on
these tongues. `FBM_OCTAVES` for every shader on `noiseGlsl.ts`' `fbm` (the fire, the volcano's smoke and lava) comes from
`graphicsQuality.ts` `fbmOctaves` (#582); the sky and aurora run their own fixed-octave noise.
