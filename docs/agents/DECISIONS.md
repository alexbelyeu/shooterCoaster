# Decisions

Append-only log. Newest at the bottom.

**Don't edit this file in a feature PR.** Write each new decision as its own file in
`docs/agents/decisions/inbox/` (see the README there). The Maintainer folds the inbox
into this file every night. One writer means this file never causes merge conflicts.
Older years move to `docs/agents/decisions/<year>.md` once this file passes ~1500 lines.

Entry format:

```
## YYYY-MM-DD — Title (role)
Context · Decision · Consequences
```

## 2026-10-19 — Autonomous studio setup (setup session)

**Context:** Alex wants Claude to improve ShooterCoaster continuously with no human
code review, reporting weekly, within one Claude Max 5x subscription.

**Decision:** Scheduled cloud sessions in five roles (Director on Fable; Builders, QA,
Maintainer on Opus; Reporter on Sonnet), coordinated through GitHub issues/labels and
the docs in `docs/agents/`. Safety comes from CI (build, bundle budget, headless smoke
of every level), independent QA before every merge, revert-first incident handling, a
nightly production smoke test, and a `pause` kill switch in STEERING.md.

**Consequences:** Every merge to `main` deploys to production. Builders never merge
their own work. Weekly usage is calibrated with `builder_parallelism` in STEERING.md.

## 2026-10-19 — Agents approve, GitHub merges (setup session)

**Context:** Claude's auto-mode safety check refuses merges to `main` made by an agent
without human review. Alex chose fully autonomous merging with guardrails.

**Decision:** Agents never call the merge API. QA approves with the `agent:qa-approved`
label; `.github/workflows/automerge.yml` squash-merges approved `agent/*` PRs once
`verify` is green on the head commit, and revokes approval when new commits land.

**Consequences:** The merge gate is repository configuration Alex owns and can disable
from the Actions tab. QA's label is the only approval signal.

## 2026-10-19 — Week 1 leads with art direction and game feel, not new levels (Director)

**Context:** First Director playtest. All five levels run and pass CI, but the
screenshots show the same washed-out sky on every biome (Inferno is daytime blue),
wire-thin tracks on hexagonal stick supports, unreadable enemies (black snowmen on
snow), empty mid-grounds, and shooting with almost no feedback. There is no touch
input. STEERING asks for "AAA in feel, cohesion and polish".

**Decision:** M1 (weeks 1–2) is a polish-and-feel milestone across the existing five
levels before any new level ships: per-biome atmosphere, track as a hero structure,
enemy readability, hit feedback, HUD/results/level-select redesign, touch input, and
test surfaces so QA can see combat in screenshots. New levels start in M2 once the
pipeline produces frames we are proud of.

**Consequences:** Week 1's queue is ~45% visual cohesion, ~30% game feel/UI, ~25%
foundations (touch, test hook, file splits, seeded RNG, vitest). Builders working on
the same biome files must rebase carefully; the `BiomeEnvironment.tsx` split is
scheduled to reduce that conflict surface.

## 2026-10-19 — Procedural sky domes replace drei `Sky` (Director)

**Context:** drei's `Sky` is a physical daytime-sky model; it cannot produce an ash
sky, a night sky or an aurora, and its exposure fights the ACES pass.

**Decision:** Skies are a per-biome gradient/noise `ShaderMaterial` on an inverted
sphere (`SkyDome`), with `fog.color` derived from the dome's horizon colour and sun /
ambient colours configured per biome. drei `Sky` may remain only on the title scene
until it is restyled.

**Consequences:** Every biome owns its atmosphere config; new biomes must define one.
Slight bundle growth (a few KB) within budget.

## 2026-10-19 — No online backend until Alex decides (Director)

**Context:** `api/` stubs for leaderboard/daily/ghost are in-memory. Hard rule 4
forbids new paid services or accounts without a decision.

**Decision:** M2 ships *local* leaderboards and daily runs (seeded RNG + persisted
scores). Online leaderboards wait for Alex to pick a backend (Vercel KV, Supabase free
tier, or none) via STEERING.md.

**Consequences:** `api/` stays a placeholder; nothing in the client depends on it.

## 2026-10-19 — Google Fonts at runtime is an accepted pre-existing network call (Director)

**Context:** `src/app/global.css` imports Lobster + Inter from fonts.googleapis.com
(predates the studio). Rule 4 requires runtime third-party calls to be recorded.

**Decision:** Accepted for now. The game must render correctly if the request fails
(system font fallbacks). Self-hosting the fonts (OFL-licensed, record in ASSETS.md)
is a backlog item if load time or privacy becomes a concern.

## 2026-10-19 — No self-approval, ever (setup session)

**Context:** In the first end-to-end test the Reporter tried to self-approve its
docs-only report PR (which PROTOCOL then allowed) and the platform's safety check
blocked it, as it had blocked agent merges. **Decision:** remove all self-approval:
every PR, including docs-only and reverts, is approved by a separate QA run. Reverts
and prod fixes are reviewed first. The Reporter no longer waits for its PR to merge.
**Consequences:** the Director's plan, reports and reverts land a few hours later
(next QA run) instead of immediately; QA is the single approval path.

## 2026-10-19 — Weekly email via GitHub notifications, not Gmail (setup session)

**Context:** Scheduled sessions calling the Gmail connector's send tool get
`Forbidden`. **Decision:** the Reporter writes the email as the body of the weekly
`report` issue; `.github/workflows/report-notify.yml` reposts it as a
github-actions[bot] comment, which GitHub emails to Alex. QA also no longer needs to
push rebases: GitHub merges approved PRs that are behind `main` if they don't conflict.
**Consequences:** the email arrives from notifications@github.com; no agent touches
Alex's mailbox.

## 2026-10-19 — Atmosphere implementation details (Builder, #12)

**Context:** Implementing per-biome sky domes (see "Procedural sky domes replace drei `Sky`").

**Decision:** Config lives in `src/levels/environments/atmosphere.ts` (`ATMOSPHERES`),
consumed by `BiomeEnvironment` (lights, fog) and `SkyDome` (shader uniforms). The dome
is a 32×16 sphere of radius 0.9 × camera far, follows the camera, `renderOrder -1000`
with depth test/write off, so it costs exactly the one draw the drei `Sky` used.
Exposure is applied through `gl.toneMappingExposure`, which the postprocessing ACES
`ToneMapping` effect reads; it is restored on unmount so the title scene is unaffected.
The smoke test's screenshot timeout was raised to 120 s (`--shot-timeout`) because
SwiftShader on the 2-core cloud box takes ~40 s per screenshot frame even on `main`.

**Consequences:** New biomes must add an `ATMOSPHERES` entry. Level configs can no
longer override fog colour (the unused `environment.fog` field was removed).

## 2026-10-19 — Coaster structure scales with sqrt(scalar); towers sit on the drawn terrain (Builder, #13)

**Context:** Rails were fixed-size while track curves scale with `track.scalar`
(20–60), and supports were Y-scaled hexagonal cylinders. Issue #13 asks for lattice
towers and rails that look equally thick on every level, within +10 draw calls and
+60k triangles per level.

**Decision:**
- `src/track/trackDimensions.ts` derives `trackScale = clamp(sqrt(scalar / 20), 1, 2.5)`
  and scales rails, ties, towers **and the rider eye height** (`CoasterCamera`
  `heightOffset` = 6 × trackScale) by it. Scaling the eye with the steel keeps the
  near view identical on all levels; sqrt (not linear) keeps the steel from dwarfing
  fixed-size enemies on big tracks. `TrackParams` gains optional `railRadius` /
  `tieSpacing` (defaults 0.35 / 10, multiplied by trackScale).
- Towers are spaced by arc length at 50 × trackScale, but the spacing is widened until
  all towers fit `TOWER_TRI_BUDGET` (34k triangles). Long, high tracks (Arctic 37k,
  Volcanic 62k units long, up to ~1200 high) therefore get sparse, very large towers
  (~700–800 units apart); Theme Park / Ocean get one every ~200–240 units. Ties are
  capped at 1600 per track for the same reason.
- One `InstancedMesh` per height bucket (8 quantile buckets). A bucket's geometry is
  the top H units of the same infinite tower, so shorter towers are sunk into the
  ground instead of Y-scaled (level-design rule 2).
- Footings follow the terrain **as drawn** (`createTerrainSurface` in
  `utils/terrainNoise.ts`), not raw `heightFn`. The 128-segment terrain mesh is linear
  between vertices 47–94 units apart and differs from `heightFn` by up to ~55 units on
  Arctic ridges; footings placed on `heightFn` visibly float. Pads and legs extend
  below `min(drawn, heightFn)` so they are grounded under either surface.

**Consequences:** +8 draw calls and ~+45–52k triangles per level (camera-independent
count, `sceneStats()` in the e2e hook). Tower density on Arctic/Volcanic is limited by
the triangle budget; denser support there needs LOD or per-chunk culling (follow-up).

## 2026-10-19 — Live studio status as a self-updating GitHub issue (setup)

**Context:** Alex can't tell whether the studio is working or stuck. Work only moves
when a scheduled run fires, and the evidence is scattered across issues, PRs, CI and
scheduled-task sessions.

**Decision:** One pinned issue labelled `studio-status`, whose body a GitHub workflow
(`studio-status.yml` → `scripts/studio-status.cjs`) regenerates on every issue/PR/label
event and every 15 minutes. It shows: what's being built (claim time, last push, quiet
or stale flags), what's waiting for QA with CI state, approved/sent back/blocked work,
what shipped in 48h, the production smoke result, and when each role runs next.

**Why this shape:** it costs no agent runs, needs no new service or secret, and works
in the GitHub mobile app. A claude.ai page can't read GitHub (its CSP blocks
api.github.com). The schedule is a constant in the script, since the scheduled tasks
live outside the repo; keep it in sync when schedules change.

## 2026-10-19 — Touch input: Pointer Events only, finger is the aim point (Builder, #16)

**Context:** Input was `mousemove`/`mousedown` on `window`, so phones could not play.
Listening to touch *and* mouse events double-fires (browsers synthesize mouse events
after a tap).

**Decision:** `src/input/pointerInput.ts` is the one input source: window-level
Pointer Events, one active pointer at a time (secondary fingers ignored while one is
held), presses on interactive UI (`button, a, input, label, [role=button],
[data-no-fire]`) never fire. Both `useShooting` and `Crosshair` subscribe to it. On
touch, shots go to the **finger** (a tap fires where you tap); the reticle is drawn
1.25x size, 40 px above the finger with a dashed tether down to a small ring at the
real aim point, so it is never hidden. During play `html.is-playing` sets
`touch-action: none` (plus iOS `gesturestart` blocking) so nothing scrolls or zooms.
A HUD pause button replaces Escape on touch. `.play-button` styles are now global
(they were scoped to the title screen, leaving level-select/pause/results buttons as
unstyled browser defaults under 44 px).

**Consequences:** `npm run smoke` runs the `--mobile` touch playtest too (~90 s
extra), so CI guards touch input and the phone HUD layout. Gyro/gamepad would plug
into the same module later.

## 2026-10-19 — Enemy readability: shared rim light, reduced fog, readable spawns (Builder, #15)

**Context:** Enemies blended into terrain (scorpion/golem/drake/imp base colours were
ΔE 6–12 from their biome's terrain), snowmen rendered as dull grey on grey snow, and
balloons spawned up to ~4500 units from the camera (≈5 px on screen).

**Decision:**
- Every lit enemy material is wrapped in `withRim()` (`src/entities/enemies/enemyRim.ts`):
  an `onBeforeCompile` fresnel term added before output, plus the scene fog factor
  scaled by 0.6 for enemies so they keep colour at distance. Parameters are per-material
  uniforms; all rim materials share one program per material type
  (`customProgramCacheKey`). Materials stay module-level singletons.
- Enemy base colours keep ΔE ≥ ~15 from their biome's dominant terrain colours
  (sRGB → Lab, ΔE76). Exception: snowmen are white on white snow *by design*; they read
  by luminance (blue-tinted emissive lift keeps them brighter than the shaded snow) plus
  rim and saturated navy/red/coal accessories.
- Spawns are re-rolled (≤ 30 tries) until the enemy is within `maxReadableDistance(type)`
  of some track sample — the distance at which its silhouette is ≥ 12 px at 1280×720,
  FOV 80 (`src/entities/enemies/enemyReadability.ts`). Spawn radii are unchanged, so
  enemies still cover the whole ride.

**Consequences:** New enemy materials must use `withRim()` and be checked against the
biome palette; new enemy types need an `ENEMY_SILHOUETTE` entry. More enemies are in
view at any moment, so draw calls per smoke screenshot vary more with spawn RNG.

## 2026-10-19 — HUD render policy and UI palette (Builder, #18)

**Context:** The HUD is DOM over the WebGL canvas. Re-rendering React on every
frame (or every score tick) would compete with the render loop, and the HUD,
wave banner and level select need one shared set of per-biome accent colours.

**Decision:** The HUD root subscribes only to `currentLevel`; each widget
subscribes to its own store slice. The score tween bypasses React entirely
(`useGameStore.subscribe` + one rAF loop that writes `textContent` while it is
catching up). The timer bar re-renders ~1×/s (GameTimer writes on whole seconds)
and eases with a 1 s linear CSS transition; the combo ring drains with a CSS
animation keyed on `lastKillTime`. Accent colours live in `src/ui/theme.ts`
(`BIOME_UI`) and reach CSS as `--hud-accent` / `--hud-glow`. Type system:
Lobster only for the game title and screen headers, Inter (tabular numerals)
everywhere in the HUD, countdown and wave banner.

**Consequences:** Measured over a 78 s level1 run: HUD root rendered once, timer
~1×/s, score widget once. New HUD widgets should follow the same pattern
(slice subscriptions, CSS for continuous motion, no per-frame React state).

## 2026-10-19 — Hit feedback: kill pop delays the explosion by 80 ms (Builder, #14 / PR #60)

**Context:** Every enemy dies in one hit, so "hit flash" and "kill" are the same
moment. Flashing an enemy that unmounts in the same frame is invisible.

**Decision:** A hit scores immediately (score, combo and collision removal are
unchanged), then the enemy freezes at 1.2× scale with every mesh swapped to one
shared white `ENEMY_HIT_FLASH_MAT` for 80 game-ms (and at least one rendered
frame). Only then does it emit `enemy:killed`, explode and unmount. The material
swap stores the original on `mesh.userData` and restores it — no per-enemy
material clones. `enemy:hit` is emitted from the collision path with one reused
payload object (listeners must not retain it). Camera kick/shake is an additive
offset applied after the track pose, so it can never drift the ride. Test-only
`holdFeedback` freezes the muzzle flash and hitmarker for screenshots.

**Consequences:** The explosion, `enemy:killed` (score popups, hitmarker gold)
and the final-kill slow-mo arrive 80 ms after the hit — a deliberate hit-stop.
Future multi-HP enemies can reuse the flash helpers in `EnemyBase` for non-lethal
hits.

## 2026-10-19 — Decisions inbox, folded nightly; light re-review after conflict-only bounces (setup)

**Context:** Almost every PR appended to `DECISIONS.md`, so whenever two PRs were open
the second to merge conflicted. Each conflict cost a full builder round (full verify)
plus a full QA review, adding 30–60 min of Opus time per PR.

**Decision:** New decisions are separate files in `docs/agents/decisions/inbox/`; the
Maintainer is the only writer of `DECISIONS.md` and folds the inbox nightly (archiving
past years to `decisions/<year>.md` past ~1500 lines). When QA bounces a PR only for a
merge conflict after a passing full review, the builder just merges `main` and runs
unit tests + build, and QA does a light re-review of the conflict resolution (full
verify only if `src/` or `e2e/` conflicted). CI `verify` still gates every merge.

**Consequences:** The main source of conflicts between parallel PRs is gone, and
conflict round trips take minutes instead of most of an hour. `CLAUDE.md` code-map
edits can still conflict occasionally; those go through the light path too.

## 2026-10-20 — Tone.js trigger times are kept strictly increasing (Builder, #14 / PR #60)

**Context:** CI smoke (mobile run) failed on PR #60 with an uncaught Tone.js
`Start time must be strictly greater than previous start time`. When the audio
clock falls behind (headless CI, a busy phone), Tone clamps late `Sequence`
callback times up to `currentTime`, so two consecutive notes on one mono synth get
the same start. Two shots in one JS turn hit the same thing via `Tone.now()`.

**Decision:** Every mono `Synth`/`NoiseSynth` trigger in the SFX and music managers
goes through `nextTriggerTime(synth, time, ctx.currentTime)` (`src/audio/triggerTime.ts`,
pure and unit-tested). It returns a time that is never in the past and at least
1 ms after that synth's previous start. PolySynths allocate voices, so they don't need it.

**Consequences:** A late note plays up to 1 ms late instead of throwing out of the
Transport tick. New audio code that triggers a mono synth should use the helper.

## 2026-10-20 — Arctic aurora and track-biased, ground-settled props (builder, #19)

**Context:** Level 4 needed an aurora and a mid-ground of crystals/drifts. Uniform
`scatterPositions` rings leave the area the rider actually sees sparse, and props
placed on `heightFn` float or sink on Arctic's ridged terrain (the drawn mesh is
linear between vertices, up to ~55 units off).
**Decision:** Biome `Decorations` now also receive `groundFn` (createTerrainSurface)
and the track's `ArcTable` (`track`, shared with #20; there is no second track prop).
New props that frame the ride use `shared/trackScatter.ts`: `scatterNearTrack`
(offsets from arc-table samples, seeded, kept clear with `trackClearance.buildTrackIndex`) and `settleOnGround` (base at
the lowest drawn-ground point under the footprint, rejecting spots that bury more than
a set fraction). The aurora is a camera-following ribbon ring (like `SkyDome`) with
additive blending; the Arctic sky zenith was darkened (0x5a84c2 → 0x34508e) because an
additive effect barely reads on a pale sky. Its intensity is driven by the
`aurora:intensity` event (number, 1 = default).
**Consequences:** Lighten the Arctic zenith again only together with a non-additive
aurora. Other biomes can adopt `trackScatter` for grounded props instead of
`scatterPositions` + `heightFn`.

## 2026-10-20 — Track-aware prop layout; batched rides; only live bullets drawn (builder, #20)

**Context:** Level 1 was at 277 draw calls / ~197k triangles before adding the midway
(budget in #20: ≤ 215 / ≤ 200k). Each Ferris wheel was ~88 meshes and each carousel ~27;
the bullet pool drew all 350 instances (~39k triangles) even when idle. Theme Park props
were scattered by radius from the origin, so two rides and several tents sat under the
track, with support towers running through them.

**Decision:** Props that must avoid the track are planned as pure data against
`shared/trackClearance.ts` (`buildTrackIndex`, a 2D XZ query: towers reach the ground, so
height does not make a spot safe) and unit-tested against the real track
(`biomes/themePark/layout.ts` + `layout.test.ts`). Anything hung across the track (arch,
bunting) must also have the rider already below it for a stretch of approach, so it is
ridden under and not dived through. Biome `Decorations`/`Features` now receive `groundFn`
and the track's `ArcTable`. Multi-part props are one draw call per part type: InstancedMesh, or
`shared/paintedParts.ts` (vertex-coloured parts merged into one geometry). The Ferris
wheel is now 4 draws and the carousel 2. `BulletPool` sets `mesh.count` to the live bullets.

**Consequences:** Level 1 now renders ~100–130 draw calls and ~165k triangles with the
full midway in view. Moving a ride means updating `RIDES` in `themePark/parkSpec.ts`; the
layout test fails if it lands on the track. Don't go back to one `<mesh>` per prop part.

## 2026-10-20 — Biome environments are per-biome modules behind a registry (builder, #31)

**Context:** `BiomeEnvironment.tsx` and `BiomeDecorations.tsx` were ~1000 lines each of
five biomes' worth of switch cases, so every level task edited the same two files and
parallel builders conflicted.

**Decision:** Each biome owns a folder `src/levels/environments/biomes/<biome>/`
(`config.ts` with terrain `COLOR_RAMP` + `TREES`, `Decorations.tsx`, `Features.tsx` for
landmarks / terrain features / events, `index.ts` exporting a `BiomeDefinition`).
`biomeRegistry.ts` maps `BiomeType → BiomeDefinition` as a `Record`, so a missing biome
is a compile error. Biome-agnostic code (terrain mesh + colour-ramp sampler, tree field,
water shader, atmosphere/lights/fog wiring, `scatterPositions`, `safeHeight`) lives once in
`shared/`. `BiomeEnvironment.tsx` is a thin host that renders atmosphere, terrain, water,
trees, then the definition's `Decorations` and `Features` — in that order, which preserves
the previous scene-graph order. No file under `src/levels/environments/` should exceed
~400 lines; split large decoration sets into sibling components (as `desert/Cacti.tsx`).
Terrain noise (`BIOME_TERRAIN_CONFIGS`) and sky/fog (`ATMOSPHERES`) stay where they were.

**Consequences:** New biome work touches only its own folder plus one registry line, so
parallel level PRs stop colliding. Never add per-biome `if (biome === …)` branches back
into `BiomeEnvironment.tsx`; put them in the biome's `Features.tsx`. Landmark components
(FerrisWheel, Pyramid, Volcano…) still live at the `environments/` root because the title
scene reuses some of them.

## 2026-10-20 — Camera feedback is rotation-only; recoil lives on a weapon view-model (builder, #65)

**Context:** The #60 kill shake translated the camera up to 3 units at ~8–11 Hz, so the
rails directly under it visibly jumped, and the muzzle flash floated at bottom-centre
with no gun. Alex flagged both in playtest.

**Decision:**
- The coaster camera is **never translated** for feedback. Kills add "trauma" (0..1,
  combo-scaled, linear decay to 0 in 240 ms) that drives smooth value-noise pitch/yaw
  (≤ 0.6°) and roll (≤ 1°) on top of the track pose (`src/combat/screenShake.ts`).
  World events use the same system: `eventBus.emit('camera:trauma', amount, durationMs)`
  adds trauma with a longer decay (the volcanic eruption: 0.8 over 3 s). Overlapping
  sources keep the stronger level and the later end time.
  Setting **Screen shake: Off / Reduced / Full** (persisted, default Reduced = half);
  `prefers-reduced-motion` forces Off. The e2e hook reports translation off the track
  pose and smoke fails if it is ever non-zero.
- Fire recoil moves a code-generated **first-person weapon** (`WeaponViewModel.tsx`),
  not the camera. It is one merged mesh (1 draw call, ~200 tris) parented to the camera,
  anchored bottom-right from the viewport's short side (`weaponLayout.ts`), and its
  barrel points straight at the aim point, so the tracer leaves along it. The only
  guard is an ~8.6° cone around straight up (`clampWeaponAim`), where the gun would be
  seen end-on; smoke fails if the tracer leaves the barrel more than 25° off. Its vertex shader squeezes its depth into the front
  2% of the depth range, so it never clips into the world but still self-occludes.
- The muzzle flash sits at the barrel tip, and each shot draws a short tracer from the
  barrel to the aim point. Bullets still fly from the camera along the aim ray (hit
  logic unchanged). Shots publish their aim NDC through `lastShot` in `hitFeedback.ts`
  rather than an event payload, so nothing is allocated.

**Consequences:** Don't reintroduce camera position offsets for feedback or world
events (the smoke fails for feedback); anything that should shake the camera emits
`camera:trauma`, so the Screen shake setting and `prefers-reduced-motion` apply. New
HUD elements in the bottom-right must leave room for the gun (smoke checks
`.hud-panel`, `.hud-combo`, `.hud-pause-button` and `.mute-button`).

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

## 2026-10-20 — Pause switch, independent code reviews, runbooks in the repo (setup)

**Context:** Alex needs to stop all agent work quickly when his Claude usage runs low,
wants Story Pitcher's `/deslop` and `/wrap-pr` review discipline on every PR, and
changing a scheduled task's prompt needed his hands or hit permission checks.

**Decision:** An open issue labelled `pause` (or `pause: true` in STEERING.md) stops every
agent at its next checkpoint, via `scripts/pause-check.sh`, which fails closed;
`PAUSE until <time>` resumes by itself. QA combines a playtest reviewer with two
fresh-context reviewers (`pr-correctness`, `pr-consistency`) reading one review bundle,
for code diffs of ~300+ lines, and posts one decision; builders deslop before shipping.
Scheduled-task prompts become a bootstrap that runs the pause check and follows
`docs/agents/runbooks/<task>.md`.

**Consequences:** Pausing needs no PR and works from a phone. Big PRs cost two extra
read-only reviewer runs (~30k tokens of bundle each), offset by fewer QA round trips.
Behaviour changes to any role now ship as reviewed PRs; the task prompts should rarely
change again.

## 2026-10-22 — Ocean archipelago terrain, wave-riding foam, warm-only coral (builder, #21)

**Context:** Level 3 needed sea stacks on the horizon beyond 1.2× the track extent,
but the ocean terrain was ~90% land there (green hills ringing a flat lagoon), so
there was no open water to stand them in. The terrain ramp is sampled by |y|, so
shorelines (y ≈ 0) were getting the darkest "deep seafloor" colour.
**Decision:** Ocean terrain exponent 1.8 → 3 and amplitude 300 → 400: the peaks keep
their height but about half the sea beyond the lagoon is open water. The ocean ramp
was redone for |y| sampling: sand at the shorelines, a teal-green that serves as both
lagoon floor (y = -40) and low scrub (y = +40), grass and rock higher up. Foam rings
displace with the water's own wave function (`shared/waterWaves.ts`, same
`clock.elapsedTime`) instead of sitting at a fixed y, so the waves never swallow them.
Coral uses only warm hues (orange/red/gold), not the magenta the issue suggested,
because the jellyfish are pastel pink/blue/lilac/mint.
**Consequences:** Changing the wave formula in one place moves the water and the foam
together. Sea stacks and rocks only spawn where the whole footprint is under water;
re-tuning the ocean terrain can change how many stacks fit (the unit test requires 6–10).

## 2026-10-22 — Camera-wrapped particle field and baked terrain glow (builder, #22)

**Context:** Inferno needed ash/embers in the air, a glow on the ground near lava and a smoke column, with no per-frame CPU cost, and other biomes will want snow/dust/bubbles next.
**Decision:** `shared/ParticleField.tsx` is the one ambient-particle system: a `Points` cloud whose seeds wrap inside a box around `cameraPosition` in the vertex shader, driven by a `ParticleFieldPreset` (two layers + share). Both layers share one draw call through premultiplied blending (`One, OneMinusSrcAlpha`): opaque-ish layers write alpha, additive layers write alpha 0. Ground glow is a `terrainGlow` on the `BiomeDefinition`, baked once into a `glow` vertex attribute and added as emissive by the shared terrain material (`onBeforeCompile`), not a vertex-colour tint, because vertex colours are albedo and the volcanic lighting left them almost black. The old volcano plume sphere is replaced by `SmokeColumn` (camera-facing puffs in one geometry, reusing the lava shader's `noiseGlsl`).
**Consequences:** New biome particles are a preset, not a new component. The glow band is ~140 units wide (not ~60) because the terrain grid is ~94 units. Smoke gets half the scene fog so it stays readable against the sky.

## 2026-10-22 — Desert terrain material hook, CPU-occluded sun flare (builder, #23)

**Context:** Level 2 needed sand ripples on the terrain, which every biome drew with
the same inline Phong material in `BiomeEnvironment`. The issue also asked for a lens
flare hidden "by a depth test on an occlusion probe", but a depth test result only
comes back to JS through WebGL2 occlusion queries, which three.js doesn't wrap and
which answer a few frames late.
**Decision:** `BiomeDefinition.createTerrainMaterial` (optional) lets a biome swap the
terrain material; the desert's patches Phong with `onBeforeCompile` (`sandRipples.ts`).
Its sand mask compares vertex-colour g/r in **linear** space (THREE.Color stores hex
colours linear), so retuning the desert ramp can turn ripples on the red rock or off
the sand. The flare is two additive quads: a depth-tested core billboard at the sun
(the GPU hides it behind terrain, mesas and the pyramid pixel-exactly) and a
screen-space ghost/streak quad whose strength comes from a CPU ray march against the
drawn terrain (`groundFn`) plus cone occluders for the mesas and pyramid
(`sunOcclusion.ts`), smoothed over ~0.2 s. `buildRingedRock` moved from the ocean
biome to `shared/ringedRock.ts` so mesas and sea stacks share it.
**Consequences:** A new tall desert landmark should be added to the flare's occluder
list in `biomes/desert/Features.tsx`, or the ghosts will show through it (the core
still hides).

## 2026-10-22 — Vercel Web Analytics, page views only, off for test traffic (Builder, #59)

**Context:** Alex wants to see real players on the live site, and the weekly Marketer
reads Vercel Web Analytics. Hard rule 4 needs an entry for a new runtime network call.
**Decision:** Add `@vercel/analytics` and mount `<Analytics />` in `src/main.tsx`. The
call is first-party and same-origin (`/_vercel/insights/script.js`, then
`/_vercel/insights/view`), cookieless; it sends the page URL, referrer and the
country / browser / OS / device type Vercel derives from the request. No custom events:
the project lives in the default personal team, which we take to be Hobby (the API
does not report the plan): 50,000 events/month shared across all projects, 1-month
reporting window, and custom `track()` events need Pro. The component is mounted only when the
build ran on Vercel (`VERCEL=1` → `__BUILT_ON_VERCEL__` via `define`) and the URL has no
`e2e` param (`src/app/analyticsGate.ts`), so dev, `vite preview`, CI and both smoke runs
(CI and nightly production) send nothing and never hit a missing `/_vercel` route.
**Consequences:** One page view per load (the app has no routes). Collection starts only
after Web Analytics is switched on in the Vercel project's Analytics tab, a dashboard
action for Alex. If the plan moves to Pro, `level_start` / `level_complete` / `share`
events can be added with `track()` from `@vercel/analytics` (Pro allows 2 properties per
event). Do not add another analytics tool (Alex, 2026-10-22).

## 2026-10-22 — Share card and SEO head; Google Analytics removed (Builder, #86)

**Context:** Links to the game unfurled with no image and a "voxel" description. Alex
chose Vercel Web Analytics as the only analytics (`2026-10-22-setup-marketer.md`), so the
Google Analytics `gtag` block in `index.html` was a leftover third-party runtime call.

**Decision:** The `gtag` script is removed; the game makes no Google network calls. The
`<head>` carries one block of share/SEO tags with absolute `https://scoaster.com/` URLs
(canonical, `og:url`, `og:image`), even while the vercel.app alias also serves the site.
The card is a real gameplay frame rendered by `npm run og` (`scripts/og-image.mjs`) and
committed as `public/social/og-1200x630.jpg`. It is a JPEG, not a PNG: a PNG of a rendered
scene at that size is far over the 300 KB budget for unfurl images. `robots.txt` and
`sitemap.xml` are static files in `public/`, which Vercel serves before the SPA rewrite.

**Consequences:** Re-run `npm run og` and commit the result when the game looks better.
Portal builds edit only that head block. Adding analytics or any other third-party script
back needs its own decision entry.

## 2026-10-22 — Weekly Marketer; scoaster.com; Vercel Analytics only (setup)

**Context:** Alex bought scoaster.com and wants an expert marketer agent that decides when
and how to advertise within a budget and tracks how the game performs.

**Decision:** A weekly Marketer (Fable, Mon 5:13 New York, before the Reporter and Director)
measures with Vercel Web Analytics only, keeps `docs/marketing/` (strategy, weekly metrics,
budget ledger, channel log), files up to 3 `type:growth` issues a week for builders, and
drafts posts and campaigns as `marketing` + `needs-alex` issues. Agents never spend, post or
create accounts: Alex places everything until an ad platform is connected and STEERING.md
allows the Marketer to run campaigns. The cap is `ad_budget_usd_per_month` in STEERING.md:
$0 for the first organic month, then about $100. Public name stays ShooterCoaster.

**Consequences:** Growth work competes with game work in the Director's plan. Paid spend is
always bounded by a number Alex sets, and every public action has a human on it.

## 2026-10-23 — Audio never throws to the page (Builder, #115)

**Context:** Tone.js asserts that a source's start is strictly after its previous one. `nextTriggerTime` (#63) assumed the audio clock is frozen within a JS turn; it is not (`currentTime` ticks every ~3 ms mid-task), so a late music note that Tone clamped to the live clock could be followed by one landing exactly on it, and the throw escaped from Tone's clock callback as a page error (#114).
**Decision:** `nextTriggerTime` pushes late times `LATE_MARGIN` (20 ms) past `currentTime`, so Tone never clamps a start we scheduled. Every SFX play function and music loop callback also wraps its Tone calls in `try/catch` into `soundGuard.ts`: one sound is dropped and counted, nothing reaches the page. The smoke's `audioBurst` fails on any drop.
**Consequences:** Route every new trigger through `nextTriggerTime` and every new play function / loop callback through `dropSound`. Don't remove the margin: the guard alone would hide the bug as silent drops.

## 2026-10-23 — Gameplay SFX: one pre-built kit per level, master limiter, music duck (Builder, #24)

**Context:** Kill sounds now layer up with the combo, hits tick, waves get a per-biome
stinger. Creating Tone.js nodes per shot or kill leaks and stutters on phones, and
stacked layers + music can clip.
**Decision:** `SFXManager` builds every gameplay SFX node once per level (`prepareLevelSFX(biome)`,
from `MusicController`) into an `owned` list, reuses them for every shot / hit / kill / wave,
and `disposeSFX()` frees the list on level exit. The smoke test's mobile run checks
`__SC_TEST__.audio().sfxNodes` stays flat across taps. All audio goes through
`sfxChannel` / `musicChannel` (so mute covers it) into one `Tone.Limiter(-1)`; the music
bus has a low-pass (`setMusicDucked`) that closes to 800 Hz whenever `timeScale < 1`.
Sound-design numbers live in pure `src/audio/sfxDesign.ts`. No `PolySynth` for SFX: it
allocates and garbage-collects voices on its own.
**Consequences:** New SFX get a node in `createKit` (via `own()`), never in a play
function. Anything new must connect to one of the two channels, not to the destination.

## 2026-10-23 — Seeded RNG: fixed seeds for layouts, a run seed for spawns (builder, #33)

**Context:** Enemy spawns and most decoration scatter used `Math.random`, so no two runs or
QA screenshots matched, and daily runs / ghost replays (#11) need reproducible spawns.
A mulberry32 `createRng` already lived in `shared/trackScatter.ts`.

**Decision:** One PRNG, `src/utils/rng.ts` (`createRng(seed)` is callable like
`Math.random` and has `next`/`range`/`pick`; `hashString`; `seedFromQuery`). Anything that
shapes the world uses it:
- Decorations, trees, landmarks and title props use **fixed seeds in code** (a literal per
  scatter, trees `hashString('trees:<biome>')`), so every visit looks the same. Each scatter
  creates its own rng, so adding or reordering props never reshuffles the others.
- Enemy spawns use the game store's **`runSeed`**, set by `startRun(levelId, seed?)`, the
  single way to start or restart a level: explicit seed > `?seed=` > `Date.now()`. Replay
  gets a fresh seed. The smoke test pins seed 1337 and checks `spawnDigest()`.
- `Math.random` stays for per-frame cosmetic jitter (particles, SFX pitch, muzzle flash,
  explosion colour) and, for now, the per-enemy motion parameters inside the enemy
  components (`useMemo(() => Math.random()…)`): spawn positions are seeded, movement is not.

**Consequences:** Never add `Math.random` to scatter/layout code; take an rng. Changing a
seed or the order of draws from one rng changes that layout (and the screenshots). Ghost
replays will also need the enemy motion parameters seeded (derive a per-enemy seed from
`runSeed` + enemy id).

## 2026-10-23 — Analytics custom events from store phase changes, 2 properties max (Builder, #98)

**Context:** The team is on Vercel Pro (Alex, 2026-10-22), so Web Analytics custom events
are available. They count against the plan's event allowance, and Pro records at most 2
properties per event.
**Decision:** `src/app/analyticsEvents.ts` maps game-store phase transitions to
`level_start` {level}, `level_complete` {level, stars} and `level_quit` {level,
progress_pct in tens}. `src/main.tsx` subscribes to the store and calls `track()` only
behind the existing `analyticsEnabled` gate, so dev, `vite preview`, CI and smoke runs send
nothing. Events come from the store, not from UI buttons, so every way into or out of a run
is covered once. `level_complete` carries `stars` rather than a score bucket because a third
property would be dropped on Pro; stars is the game's own score bucket. No `share` event
until the game has a share action. Pause/resume and tab close send nothing.
**Consequences:** A run sends at most two events. Adding an event or property means
checking the 2-property limit and updating the table in `docs/marketing/README.md`. If the
team adds Web Analytics Plus (8 properties), a `score_pct` property can be added to
`level_complete`.

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

## 2026-10-24 — Each level's sky is baked into scene.environment (Builder, #121)

**Context:** Nothing set `scene.environment`, so metallic Standard materials (rails and
towers, the gun, golden balloons, eyes, stingers, the pyramid capstone) reflected black
and looked flat and dark. Idea from a review of mrdoob's MIT-licensed slop-newyork
(`lighting.js:bakeEnvironmentMap`); no code was copied, the bake uses three's own
`PMREMGenerator.fromScene`.
**Decision:** `SkyEnvironment` in `shared/Atmosphere.tsx` renders the biome's sky shader
(shared with `SkyDome` via `createSkyMaterial` / `setSkyUniforms`, sun disc off, glow
kept) on a unit dome into a PMREM once on level mount and sets `scene.environment` +
`scene.environmentIntensity` from `AtmosphereConfig.envIntensity` (0.45–0.6). The
render target is disposed on unmount. The bake is static: clouds don't scroll in the
reflections.
**Consequences:** Phong materials ignore `scene.environment`, so terrain, trees, props
and most enemy bodies keep their low-poly look. The crows are the exception: their
body, wing, breast, head and tail materials are `MeshPhysicalMaterial`, so they now pick
up the sky lighting too. Switching a material to Standard makes it reflect the sky
(tune with `metalness`/`roughness`). Every new biome needs an `envIntensity`. The smoke
fails a level without `scene.environment`. Cost: a one-off bake on mount (72 ms to
~5 s under SwiftShader on a loaded 2-CPU box), plus
shading cost every frame, because each Standard/Physical fragment now samples the env
map. QA measured level1 under SwiftShader at roughly 556 → 684 ms/frame (72 vs 56 frames
in a 40 s ride, bake subtracted); not yet measured on a real GPU.

## 2026-10-24 — Per-biome colour grade replaces the stock Vignette and the exposure knob (Builder, #122)

**Context:** Every biome went through the same Bloom → stock `<Vignette>` → ACES chain, so
the only per-biome colour control was `renderer.toneMappingExposure`, and the stock
vignette measured distance in UV space, so it stretched into an ellipse on portrait phones.
Idea from a review of mrdoob's MIT-licensed slop-newyork (`post-processing.js` "looks");
that repo was not reachable from this session, so no code was copied: the grade is written
from scratch and carries no third-party notice.
**Decision:** One custom `postprocessing` Effect, `src/canvas/post/ColourGradeEffect.ts`,
sits between Bloom and ToneMapping in the composer's single EffectPass (no extra
full-screen pass). It works on linear HDR colour: exposure, white balance (luminance-
preserving gains), split tone weighted by `l / (l + 0.18)`, contrast as
`0.18 * pow(c / 0.18, k)` per RGB channel, saturation + vibrance, and a vignette whose
distance is aspect-corrected and divided by the corner radius (round on any screen, 1 at the
corners). Values live in `AtmosphereConfig.grade`; `AtmosphereConfig.exposure` moved into
`grade.exposure` and the `AtmosphereExposure` component that set
`renderer.toneMappingExposure` is gone (it now stays 1). The three duplicated
`EffectComposer` blocks are one `PostEffects` component; the title uses `TITLE_GRADE`
(vignette only).
**Consequences:** Every new biome needs a `grade` (the `Record<BiomeType, …>` type and
`colourGrade.test.ts` enforce the keys and sane ranges). Don't re-add `toneMappingExposure`
anywhere: it would multiply with `grade.exposure`. Switching title ↔ level remounts the
composer (keyed), as before; switching between levels only updates uniforms.

## 2026-10-24 — Coaster camera weight is rotation only and follows Screen shake (Builder, #123)

**Context:** The coaster camera was a bare `lookAt(pos + tangent)`. Alex asked for bank, pitch, look-ahead and a speed FOV without breaking the rotation-only camera rule from #65.
**Decision:** `src/track/cameraRig.ts` computes bank from curvature × v² along the camera's right axis and pitch from the change in world speed, both soft-capped with tanh (8° / 3° on Full) and eased with `1 - exp(-dt·k)` in game time. They are applied with `rotateX` / `rotateZ` after `lookAt`, and the eye looks half way to a point 30 × trackScale units ahead (capped 12° off the tangent). Bank, pitch and the speed FOV kick (5°) scale with the Screen-shake setting (Off and prefers-reduced-motion disable them); the look-ahead always applies, since it only aims the view along the track. A frozen game clock freezes the rig, so frozen-time taps hit what is on screen.
**Consequences:** The default ('reduced') rides at half the gains. The smoke fails if bank, pitch or the FOV kick exceeds those caps; keep `CAMERA_WEIGHT_CAPS` in `e2e/smoke.mjs` in step with the constants.

## 2026-10-24 — Tree wind sway is a vertex patch on one shared clock (Builder, #124)

**Context:** Trees were static. Idea from Alex's review of mrdoob's MIT-licensed
slop-newyork (`createTreeMaterial`); its source was not read in this session, so the GLSL
was written from the issue's description and carries no third-party notice.
**Decision:** `shared/treeWind.ts` patches the trunk and canopy Phong materials at
`<begin_vertex>`: a world-space push of H·(h/H)² along a fixed wind direction, gusts as a
travelling wave over `instanceMatrix[3].xz` plus a per-tree hashed flutter. h/H comes
from a per-part uniform (`TRUNK_PART` / `CANOPY_PART`, which also build the instance
matrices), so both parts bend as one field and share one program. Every tree material
reads the module-level `treeWindTime`, set once per frame by `TreeField` from the R3F
clock (wall time, so trees keep swaying while paused or in slow-mo, like the kelp).
Canopy geometries now get a baked `color` attribute (darker underside): the canopy
material had `vertexColors` on with no such attribute, so every canopy rendered black.
**Consequences:** Tree instance matrices must stay translate + scale (the shader divides
the sway by the instance's X/Z scale). A new canopy geometry is shaded by `bakeCrownShade`
automatically; don't add `color` attributes in `canopyGeoFactory`.

## 2026-10-24 — Token ledger per run; QA trusts CI verify (interactive session for Alex, #147)

**Context:** Weekly Claude usage hit 40% in two days. Nothing measured tokens per run, and the
same full `npm run verify` ran several times per PR (CI, builder iterations, QA, QA again
after merging `main`), while on-label tasks bootstrapped twice (session + one subagent).
**Decision:** Every run logs its token use with `scripts/run-usage.cjs --post` to the
`token-ledger` issue; the status page and weekly report sum it. A green CI `verify` on the PR
head is QA's pass/fail: QA builds and smokes only the affected levels, and re-tests on top of
`main` only when `main`'s changes since the branch point overlap the PR's files. On-label
QA/Fix work in the main session. Independent reviewers re-run on a fix only if the fix is
≥~300 lines. Builders run the full verify once, before review.
**Consequences:** Semantic conflicts between a PR and unrelated `main` changes can reach
`main` and are caught by the post-merge production smoke (revert first). Don't restore the
repeated full verifies without checking the ledger for what they cost.
