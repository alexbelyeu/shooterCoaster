## 2026-10-24 — Countdown phase + shader warm-up behind it (Builder, #119)

**Context:** The Ready / Set / GO `<Countdown>` was dead code, and a level's materials
compiled the first time they drew mid-play (first kill, explosion, a later wave's enemy
type), a visible hitch on phones.

**Decision:** Starting a run enters a new `countdown` game phase (`startRun`; `?e2e=1`
goes straight to `playing` unless `&countdown=1`). The level is mounted during it; the
timer, wave timers, enemy motion, the coaster car and shooting all wait for `playing`,
which GO sets. `canvas/ShaderWarmup.tsx` (the approach of mrdoob's MIT-licensed
slop-newyork `precompileShaders` + warm-up frame, written from the issue's description
since that repo isn't readable from agent sessions; credited in its header) runs
`compileAsync` on the scene plus one hidden mesh per shared enemy material, then draws one
off-screen frame with culling off, everything visible and empty instanced pools given one
instance. Both target an off-screen float render target, because programs compiled for
the canvas (sRGB output) differ from the ones the EffectComposer's render pass uses
(linear output). The countdown holds Ready until the warm-up reports `sceneReady` (at
most 4 s); a tap after 1 s skips to GO.

**Consequences:** Enemy materials must stay module-level exports of
`SharedEnemyAssets.ts` to be warmed; a material created per component is not. Code that
gates on `phase === 'playing'` is right for the countdown too; code that should run while
the level is on screen must also accept `countdown`. Pausing during the countdown resumes
straight into `playing`.
