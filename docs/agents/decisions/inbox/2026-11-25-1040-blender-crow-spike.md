## 2026-11-25 — The Blender crow: a working pipeline, not adopted (Builder, #1040)

**Context:** #381 step 4 asked whether a scripted Blender pipeline makes better enemies than our hand-coded primitives,
at a cost the game can afford. `tools/art/crow.py` (bpy 5.3.0, run by hand) builds a raven deterministically: a metaball
body and head, the hand-coded crow's wing and tail outlines as plates, six bones, one `flap` clip sampled from
`birdWingPose` (so both crows flap alike), AO cast per vertex into its colours, then gltf-transform `quantize`.
`BlenderCrow.tsx` flies it through `FlapBird` (its `model` and `pose` props). Measured on level 2 (the crows' level; the
issue said level 1, which has none):

| | hand-coded crow | Blender crow |
|---|---|---|
| download | 0 (in the world chunk) | GLB 75 KB raw / 30 KB gz, plus a 46 KB / 13.5 KB gz chunk (GLTFLoader, SkeletonUtils) |
| triangles | 544 (416 feathers + 128 eyes) | 2 940 (5.4x; 30 crows on screen: +72 000) |
| draw calls | 2 a crow | 2 a crow (one skinned feather mesh, the eyes) |
| per-frame CPU | one uniform | an `AnimationMixer` and a 7-bone skeleton a crow |
| load, Lighthouse mobile (150 ms RTT, 1.6 Mbps, CPU 4x) | — | chunk 224 ms, GLB 516 ms (vite preview, uncompressed), the first wave unseen until both arrive |
| level 2 ride review, flag on | — | no errors, 120 kills, up to 20 crows shootable at once, nothing shootable 9.6% of the run |

On the turntable (`npm run turntable -- --only crow,blenderCrow`) the Blender crow's body and head are rounder and
smooth-shaded, the AO darkens the wing roots and the belly; the wings, tail and beak read the same, since they are the
same outlines. At play distance (a crow is ~40 px) the two are hard to tell apart.

**Decision:** don't adopt it for wave enemies. The look gain is the body's roundness, which a lathe or a subdivided
three.js geometry can give at a tenth of the triangles; the costs are real: `jsTotalGzipKB` has no room (#1034) for the
13.5 KB loader, every enemy would add a GLB to fetch before its first wave shows (or a preload to manage), skinned
programs ShaderWarmup doesn't cover yet, and an art step outside CI. The spike stays behind a build-time gate
(`__BLENDER_CROW__`: `npm run dev` and `SC_BLENDER_CROW=1` builds only, then `?blenderCrow=1`), so production builds
carry none of it. Worth reconsidering for a one-off hero model (a boss), where one GLB and loader amortise over a single
large, close-up subject.

**Consequences:** the game's default builds are unchanged (no chunk, no GLB, the same bundle). Deleting the spike is
`Crow.tsx`'s two lines, `BlenderCrow.tsx`, `models/`, `tools/art/`, the turntable's `blenderCrow` subject and the
`__BLENDER_CROW__` define.
