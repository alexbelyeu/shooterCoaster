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

## 2026-10-25 — Bullets are drawn apart from their hit test, with a screen-size cap (Builder, #165)

**Context:** Bullets spawned on the camera and drew at full `bulletSize`, so Antarctica's radius-4 snowballs covered up to half the screen for a frame after every shot. The hit test has to stay on the camera ray: aim and touch aim assist are tuned against it.
**Decision:** `bullet.position` is still the hit test (camera ray, swept). Only the drawn copy changes (`combat/projectiles/bulletVisual.ts`): it starts at the muzzle tip the view-model placed on the bullet's first frame (the tracer's start) and merges into the ray over `TRACER_RANGE`, so it flies along the tracer. Its radius is capped by view depth to 1.5% of the canvas height, so it grows from small at the lens to full size. The smoke fails above 2%.
**Consequences:** For its first ~160 units a drawn bullet is up to one muzzle offset away from where it can hit. A new projectile type, or a bigger `bulletSize`, gets the same cap for free.

## 2026-10-25 — Results-screen run stats: where hits and best combo come from (builder, #25)

**Context:** The results screen shows accuracy and best combo, and `savedScores` now keeps `bestCombo` per level.
**Decision:** A hit is counted in `processHit` (`combat/CollisionManager.ts`), the one path both the bullet pool and the e2e hook use, so accuracy = `hits / shotsFired` (capped at 100%, "—" with no shots). `saveScore` still keeps the higher score's entry, but `bestCombo` is the max over every run, so a lower-scoring run with a longer streak still updates it. `bestCombo` is optional on `ScoreEntry`; entries saved before it read as 0. The results screen snapshots the run on mount (and reads the previous best before saving), so NEW RECORD is right and the screen doesn't repaint with the next run's zeros during its exit fade.
**Consequences:** Anything that adds another hit path must go through `processHit` or accuracy drifts. Don't make `saveScore` replace whole entries again without carrying `bestCombo` over.

## 2026-10-25 — Sense of speed stays rotation-only; streaks draw in the opaque pass (Builder, #27)

**Context:** #27 asked for 18° banking, +6° / +4° FOV kicks, wind streaks and a head bob. #123 had already shipped rotation-only bank (8°), pitch and a 5° speed FOV kick, and the smoke requires zero camera translation (#65).
**Decision:** Keep #123's bank cap; add a 3° drop FOV kick on steep descents (total cap 8°, `CAMERA_WEIGHT_CAPS` in the smoke) and camera-space wind streaks above 70% of top speed, both scaled by the Screen-shake setting. No head bob: it is a translation. `WindStreaks` builds its quads in clip space and is *not* `transparent`, with additive blending, no depth test and renderOrder 9: it sorts in the opaque list after the world (renderOrder 0) and before the gun (10), so the world never hides it and the gun stays on top.
**Consequences:** Transparent world objects (water, particles) draw over the streaks. A gun or other camera-attached opaque mesh must keep renderOrder above 9 to stay over them.

## 2026-10-25 — Contact shadows: one merged terrain-following mesh fed by a registry (Builder, #125)

**Context:** Nothing in the game casts a shadow, so towers and props float. The issue suggested one InstancedMesh of terrain-aligned quads, after slop-newyork's `createContactShadowMaterial` (MIT, Copyright (c) 2026 Mr.doob, https://github.com/mrdoob/slop-newyork).
**Decision:** `shared/ContactShadows.tsx` wraps the track and the biome in `SceneManager`; any component below it calls `useContactShadows(casters)` with footprints it already has (tower plan, theme park layout, mesas, cacti, sea stacks, ice crystals), and all of them are merged into one indexed geometry, rebuilt once when the set changes (`shared/contactShadows.ts`). Each footprint is a grid on `groundFn`, every triangle lifted over the terrain folds it crosses. An InstancedMesh was rejected: one flat quad per instance can't follow ridged ground (Arctic, Volcanic) under a 100-unit tower without clipping. The shading follows slop-newyork's rounded-box distance-field idea and was written from its description, with no code copied.
**Consequences:** One draw call per level, whatever the caster count. New props get shadows by calling the hook, not by editing the shadow module. The shadows darken, fade out with the fog and draw before other transparent meshes (`renderOrder -1`), so water and ponds blend over them.

## 2026-10-25 — Music crossfades on one never-stopped Transport; title start is any key, not any tap (Builder, #28)

**Context:** #28 asked for a 1 s title → level music crossfade, a "press any key / tap to start" hint and a cinematic title. Both music managers used to `transport.stop()` + `cancel()` on stop, which cut whatever else was scheduled, so two tracks could never overlap.
**Decision:** Each track plays into its own gain stage (`audio/musicBus.ts`) that ramps in over 1 s on start and out over 1 s on stop, then is disposed with its loops and synths. Nobody stops or cancels the Transport any more: a track only disposes its own loops. New loops start on the next bar line (in ticks), so a track always begins at the top of its phrase, and the tempo ramps when a track starts under one still fading. Start is any key (letters, digits, Space, Enter, arrows; not S, which mutes, and never Tab / Escape / function keys / shortcuts) or PLAY. A tap anywhere does not start, because the title invites you to shoot balloons and a missed one would throw you into level select, so on touch screens the hint reads "Tap PLAY to start". The fly-by blends two camera shots in position (with a lift) rather than a dissolve, which would need a second render target.
**Consequences:** The Transport runs from the first audio unlock for the whole session. Any future music source must use a `musicBus` and must not stop or cancel the Transport. During a crossfade both tracks' synths are alive for about 1 s.

## 2026-10-26 — Week 2: M1 closed, M2 starts early as "launch week", bosses enter the roadmap (Director)

**Context:** Second Director playtest. Every M1 exit criterion is met on `main` (per-biome
atmosphere + grade + env map, lattice track, readable enemies on 1–3, hit feedback and a
gun, HUD / results / level select, touch, combat screenshots, per-biome modules, vitest).
The first public post goes out Mon 2 Nov (Marketer, #102). The screenshots still show
three things a visitor would screenshot back at us: no visible enemies on Antarctica,
a vertical rail into the sky on levels 4 and 5 (`TrigCurve2` doesn't close), and an
Inferno that is a black triangle on dark red. And a run has no shape: waves are static
scatters, nothing arrives, every level ends on a timer.

**Decision:** M1 is closed a week early and M2 ("the arcade loop and the finale") starts
now, framed as launch week: P1 is whatever makes the first Theme Park run better or
removes a screenshot-worthy bug (the three above, the smoke flake that blocks honest
verification in every cloud session, combo tiers, spawn choreography, fireworks, and the
clip). **Bosses enter the vision**: every level gets a finale through one boss framework
(multi-hit, weak points, HP bar, tell, reward), Theme Park and Ocean first. Alex's
slop-newyork backlog (#126) is split: the launch-safe foundations (perf gate, lazy
Tone.js) become issues now; the feature items (positional SFX, drone orbit, gamepad, photo
mode) are ranked at the top of the VISION backlog for the week after launch; the
structural ones (baked SFX buffers + voice budget, aerial fog, chunk culling, Metropolis,
helicopter boss, Night Ride, WebGPU capability event) sit lower with a trigger each. The issue queue is consolidated: QA follow-ups that touch the same files are
merged into one issue each, fixed bugs are closed, and the total stays near the
~30-issue weekly capacity.

**Consequences:** Builders touching `EnemySpawner`, `EnemyBase` and `CollisionManager`
this week (choreography, death variety, boss framework) must keep the pure parts in
separate modules so parallel PRs don't collide; the boss framework PR goes first and the
two boss issues depend on it. Changing `TrigCurve2` changes the level 4 / 5 track shape,
tower layout and the pinned curve test; the skill's track-extent formula must be
re-checked. The budget stays 700 / 260 KB; the Desert draw-call overage (268 > 250) is a
P2 fix, not a budget raise.

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

## 2026-10-28 — Formation waves are placed at activation, relative to the rider (builder, #30)

**Context:** Formations (V, line, school, spiral, ring) only read if they appear where the
player is looking, and the rider's position when a wave activates depends on coaster speed
and frame timing, so it can't be precomputed at level load like scatter spawns.

**Decision:** `entities/spawning/spawnPlacement.ts` (pure) lays a formation wave out in two
steps: at load each member gets a seeded slot in its group's local frame; at activation the
spawner anchors each group on the track ahead of the rider (first point in the rider's
forward cone, else straight ahead) and turns slots into world positions plus an entry start.
`spawnDigest()` hashes the slots, not world positions, so `seed-check` stays deterministic.
An enemy with an `entry` is not a collision target until it reaches its slot (no shots or
touch aim assist on enemies still flying in). #179's ground-enemy placement should build on
the same module (frame + slot → position) rather than in `EnemySpawner.tsx`.

**Consequences:** A formation's world positions differ run to run with the same seed (the
layout doesn't). Formation members get a shared `heading` (crows, scouts, fish) or hold their
slot (ring balloons), so the shape survives after the entry. Waves still activate on the
wall-clock `setTimeout` schedule until #36 moves them to game time; the `wave:incoming` tell
is a second timer 1 s earlier on that same schedule.

## 2026-10-28 — Combo tiers on a game-time clock (builder, #34)

**Context:** Combos added +0.25× per kill up to 4× inside a 2 s `performance.now()` window, so
a pause or slow-mo could break a chain, and nothing told the player when one dropped.

**Decision:**
- One tier table, `src/combat/comboTiers.ts`: 1–3 kills 1×, 4–7 2×, 8–14 3×, 15+ 5×; windows
  2.0 / 1.8 / 1.6 / 1.4 s. The kill-sound layers (`sfxDesign.killTier`) and HUD colours
  (`theme.comboColor`) read the same tier index; don't add a second table.
- Windows are measured on a game clock (`src/core/gameClock.ts`, `delta × timeScale`), advanced
  only by `GameTimer` on playing frames through `combat/comboRuntime.ts`. That module also breaks
  lapsed chains (`combo:broken`) and runs the 5× FRENZY slow-mo (`combo:frenzy`).
- The frenzy writes `timeScale` only while it runs, and gives up when anyone else sets a
  different value (the last-enemy 0.1 slow-mo, a test freeze). `startRun` resets `timeScale` to 1.
- Score includes the multiplier, `maxScore` stays the base (no-combo) score, and `computeStars`
  clamps the fraction at 1. A kill is registered before it is scored, so it scores at the tier it reaches.

**Consequences:** Pause holds the combo exactly. Kill-sound layers now start at 4 / 8 / 15 kills
(were 3 / 6 / 10). Anything new that changes `timeScale` should set it once and leave it, not
fight the frenzy every frame.

## 2026-10-29 — Ground enemies stand beside the track ahead of the rider; smoke gates readability (Builder, #179)

**Context:** Antarctica's snowmen (and Inferno's imps and golems) were scattered over a
disc of radius ~2,400 around the origin while the track runs high over the ridges.
`pickReadableSpawn` only guarantees an enemy is near *some* track point once per lap, so
the ride screenshot showed 0 readable snowmen and a scout was 9 px at 1,000 units.

**Decision:**
- Scatter waves of `snowman` / `snowmanScout` / `snowmanBrute` / `lavaGolem` / `fireImp`
  (`placedBesideTrack` in `spawnPlacement.ts`) get seeded trackside slots at load (arc
  distance 700–2200 ahead, 60–400 to either side) and are placed on `groundFn` from the
  rider's track index when the wave activates. `spawnDigest` hashes the slots, as for
  formations. Other scatter types keep `pickSpawn` + `pickReadableSpawn`.
- Snowman model scale 1 → 1.3, scout 0.6 → 0.9 (silhouettes 65 and 48 units; `RADII`
  scaled to match).
- `npm run smoke` fails a level whose ride screenshot has fewer than 2 enemies ≥ 12 px
  on screen.

**Consequences:** A new ground enemy that should be in the player's face goes in
`placedBesideTrack`, not a bigger `pickSpawn` radius. Removing a type from that list
brings back the "nothing to shoot" ride. The readability gate means a level design that
leaves the opening seconds empty now fails CI.

## 2026-10-29 — Dark levels read by emissive edges, not exposure (Builder, #180)

**Context:** Inferno was a black cone on dark red with a dotted yellow line beside the track. The line was a lava river: its UVs ran 0..1 along 2 km, so the lava shader's crust cells were 500 units long and their cracks drew one long yellow line that aliased into dots.
**Decision:** Lava strips (rivers, volcano streaks) use `uv.x` 0..1 across and `uv.y` = distance along in strip widths, and `LavaShader` fades its crack pattern to an average heat once a cell is a few pixels wide (`fwidth`). The volcano is one vertex-coloured rock mesh with a baked `glow` attribute (reusing `createTerrainMaterial`): HDR crater lip, dim red upper slopes. `TrackParams.glow` adds the track's own (squared, ≈ linear) vertex colours as emissive, so a bright `color2` spine and ties glow while dark rails stay dark. The volcanic grade and sky are unchanged.
**Consequences:** New lava geometry must follow the UV convention or the stripe comes back. Other dark levels can opt in with `track.glow`; it changes the track's shader program (`track-glow` cache key), which `ShaderWarmup` compiles with the level.

## 2026-10-29 — Boss framework: weak points in phases, mounted dormant, timed on the level timer (Builder, #181)

**Context:** Each level gets a finale boss (VISION; Theme Park's Golden Blimp first, Ocean's Kraken next).
Bosses need several hit zones, phases, their own HUD and score, without forking the enemy, combo,
score-popup, SFX or kill-counter paths.

**Decision:**
- Rules are pure in `src/entities/bosses/bossModel.ts`: a `BossSpec` is a list of weak points
  (`id`, `radius`, `offset`, `hp`, `score`, `phase`) plus a `reward` and a `tell`. Only the
  lowest phase with a live weak point is exposed; the boss is defeated when every weak point is
  destroyed. Total hp is derived (`maxHp`), not stored. Specs live in `bossSpecs.ts`;
  `computeMaxScore(waves, boss)` adds `bossMaxScore` (Σ weak point scores + reward), so `maxScore`
  and stars include the boss.
- `BossBase.tsx` registers one `CollisionManager` target per *exposed* weak point, and re-syncs
  them inside the hit itself (not in an effect), so the next hit in the same frame or JS turn
  already sees the new phase and aim assist never snaps to a hidden one. Each destroyed weak point
  is a normal kill (`registerKill` + `addScore`, kill pop, explosion, `enemy:killed`), so combos,
  popups, SFX and kills/accuracy work unchanged; the last one also scores the reward. Boss
  events: `boss:spawn`, `boss:hit`, `boss:defeated`. HUD state is `boss` in the game store
  (reset by `startRun`), so the bar survives the HUD remounting after a pause.
- A concrete boss supplies `move(frame)` (root and weak point groups, game time, time since
  defeat), `body`, `rigging` and `renderWeakPoint`. A Kraken's independently moving tentacles
  animate their part groups in `move`; a retract phase can be a new `retracted` set on
  `BossState` filtered by `exposedWeakPoints`.
- `BossSpawner` mounts the boss **dormant** (invisible, no targets) with the level, so
  `ShaderWarmup`'s warm-up frame compiles its programs (incl. the instanced confetti); it shows
  the tell at `at - tell.seconds` and activates at `at`, both read from GameTimer's
  `timeRemaining` (pause- and countdown-safe), not `setTimeout`.
- The Golden Blimp rides with the coaster (a fixed distance ahead of the camera's smoothed
  horizontal heading) rather than holding a world position: the ride covers thousands of units
  in the ~20 s finale, and a fixed boss would be behind the rider in seconds.

**Consequences:** A new boss is a spec, a component around `BossBase` and an entry in
`BOSS_COMPONENTS`; its geometry/materials go in `bossAssets.ts` (walked by `ShaderWarmup`).
The boss's kills count toward `kills` but not the HUD's wave kill strip (`totalEnemies`).

## 2026-10-29 — Streak rewards trigger on the store's combo count, not the `enemy:killed` payload (builder, #182)

**Context:** `enemy:killed` is emitted after the ~80 ms kill pop and reads `combo.count` then, so several kills resolved in one frame (a spread shot, `killNearest`) all report the final count. A "every 5th kill" check on the payload skipped the 5th.
**Decision:** The combo-streak fireworks subscribe to `useGameStore` and fire when `combo.count` rises by exactly one onto a multiple of 5 (a real kill; `primeCombo` jumps don't count). They are mounted by the Theme Park's `Features.tsx`, so other biomes have none, and their whistle + pop voices are only built into the kit for `FIREWORK_BIOMES`.
**Consequences:** Future streak rewards should use the same store edge. The payload's `combo` is still the count at the pop, not the kill's own count (follow-up if anything else needs exact per-kill counts).

## 2026-10-29 — Enemy models are merged vertex-coloured geometries; crows flap in the vertex shader (builder, #92)

**Context:** Desert was over the draw-call budget: each scorpion was 37 meshes and each crow 16, so level 2 had ~1,200 scene objects with only scorpions alive and far more once the crows came.
**Decision:** A multi-part enemy is one merged, vertex-coloured geometry per material (`paintedAt` + `pose` from `shared/paintedParts.ts`, which also bake nested groups, scale and mirroring) built at module level in `SharedEnemyAssets.ts`. Parts that animate as a rigid group stay a child mesh (scorpion tail). Crow wings are in the merged geometry, tagged by an `aWing` attribute, and flap in the feather material's vertex shader. Each crow gets its own material instance from `createCrowFeatherMaterial(flap)` so its flap phase is its own uniform; all instances share one program through `customProgramCacheKey`, and the exported `CROW_FEATHER_MAT` exists so ShaderWarmup compiles that program.
**Consequences:** Crow = 2 draw calls, scorpion = 3. Parts merged into one material lose per-part material settings (the crow beak is no longer Phong, scorpion legs lost their faint emissive); colour differences live in the vertex colours. Don't split these back into per-part meshes; add a part to the merged list instead.

## 2026-10-29 — Audio moves to a port of Scrimshaw Jukebox; Sound designer role (Alex, interactive session)

**Context:** Sound is the game's weakest area: about a dozen basic Tone.js synths
playing hard-coded note arrays, and no role owns audio. Alex pointed at Scrimshaw
Jukebox (Simon Willison, built with Claude Opus 5.5): a plain-text score format that an
LLM writes reliably, played by a 65-instrument Web Audio synth with no samples. Its
source is Apache-2.0 (simonw/tools).

**Decision:** Port Scrimshaw's parser, synth and look-ahead scheduler to TypeScript in
`src/audio/scrim/`. It runs in parallel with Tone.js behind a flag until it reaches
parity (hard rule 7), then Tone.js is removed. All new music is written as scores (the
source of truth), not as code. The original is vendored, unmodified, in
`docs/audio/reference/` with its licence. Ported files keep a credit header naming the
source and saying they were changed. This is third-party *code* under Apache-2.0, not an
asset, so it doesn't fall under the CC0-only assets rule. Every sound is still our own
synthesis, and scores are original compositions. `type:audio` issues go to a new Sound
designer role. Direction is late-90s Sega arcade rail-shooter (`docs/audio/SOUND-BIBLE.md`).
Agents can't hear, so sound is checked by offline renders plus measurements. Alex
listens weekly and picks the first theme for each level in a `Listen:` issue.

**Consequences:** Tone.js work that only polishes the old engine is superseded (#109,
#168, and the Tone lazy-load half of #187). Audio PRs commit small MP3 renders to
`docs/audio/renders/` (overwritten in place). The Maintainer unblocks `Waiting on #<n>`
issues once what they wait on is closed.

## 2026-10-30 — Audio is checked by rendering the game's own code offline (Sound designer, #213)

**Context:** No agent can hear. The toolkit has to render what the game really plays, deterministically and
faster than real time, without depending on software GL's ~1 fps.
**Decision:** `src/audio/offlineRender.ts` swaps Tone's global context for an offline one for the length of a
render and builds a fresh master chain in it (`AudioEngine.swapInOfflineChain`; the channels are live
bindings), so the unchanged music and SFX managers play into it. The offline context keeps Tone's live 0.1 s
look-ahead, so loop callbacks schedule notes exactly as in the game, and `Math.random` is seeded for the
render. SFX throttles now run on the audio clock (`Tone.now()`), not `performance.now()`, since an offline
render runs its whole timeline in one JS turn. A render only runs on the title screen before audio unlocks.
Loop seams are judged against the closest bar line inside the loop, not as a raw level jump: music swells on
every downbeat. Mix targets are mirrored in `scripts/audio/metrics.mjs`.
**Consequences:** Capturing real-time output is not needed. Anything that adds a module-level Tone node outside
`createMasterChain` would not follow the swap. The future score engine plugs in as one more render kind
(`RENDERS` in `src/testing/audioRender.ts`).

## 2026-10-30 — The score engine runs on Tone's context, in its own stereo channel, loaded only under ?audio=scrim (Sound designer, #214)

**Context:** The Scrimshaw port has to run beside Tone.js until it reaches parity (hard rule 7), share the
game's ducking, volume and limiter, and leave default players' sound and bundle untouched.
**Decision:** `src/audio/scrim/` creates its Web Audio nodes on Tone's raw context (standardized-audio-context's,
so they connect to Tone nodes) and plays into `AudioEngine.scoreChannel`, a second music channel built with
`channelCount: 2`: Tone's channels fold their input to mono, which would flatten the scores' panning. It is
silent and unused without the flag (renders of the default sound match the baseline to −142 dB). The engine
and the scores are one lazy chunk (`musicEngine.withScrim`), so `?audio=scrim` costs default players nothing.
The `game` voicing (`GAME_VOICING` in `synth.ts`: 32 Hz high-pass, −6 dB limiter, out 0.53) sets scores to
−18…−16 LUFS through that channel; the port's `jukebox` voicing stays the original's, for parity renders.
Unlike the Tone.js music, a score holds its position while the run is paused and resumes there, and the results
screen gets its own score.
**Consequences:** When the score engine becomes the default, `musicChannel` and the Tone music managers can go;
`scoreChannel` stays. Offline renders seed `Math.random` the same way for the original page and the port, so a
parity render of the same score is near bit-identical; any change to the port's call order of `Math.random`
shows up there.

## 2026-10-30 — Death effects: one pool, styles as data, shared meshes (Builder, #29)

**Context:** Every enemy died in the same random-coloured fireball. Each type needs its own
death (confetti, feathers, splash, shards, motes…), and the boss framework reuses the pool
for weak points.

**Decision:** `ParticleExplosion` stays the one pooled effect, with `explode(position, style)`.
A `DeathStyle` (layers of shape / colours / speed / drag / gravity / size / spin, plus
lifetime, scale, lift, flash, kill timbre) per `EnemyType` lives in pure `effects/deathStyles.ts`.
All 8 slots share two InstancedMeshes (unlit boxes for every glow / flat shape via per-instance
stretch, and lit dodecahedra for chunks), with per-instance colour, instead of meshes per slot:
2 draw calls instead of the old 10. Ages run on game time (frenzy slow-mo slows a death; pause
holds it) and `holdFeedback` stops them at `HOLD_LIFE` so combat screenshots show the style.
Kill timbre per family (pop / flutter / crunch / splash / hiss) reshapes the existing snap +
ping voices (`KILL_TIMBRES`), so no new Tone nodes.

**Consequences:** A new enemy type needs a `DEATH_STYLES` entry (the `Record` enforces it; the
unit test checks it fits a slot and differs from the other types in its level). New effect
looks are new data, not new components. Particle fade is a size shrink (one shared opaque
material per mesh), so no per-particle opacity.

## 2026-10-30 — Graphics quality presets and one-way adaptive resolution (builder, #35)

**Context:** Weak GPUs and phones needed a way down; the issue asked for a quality setting, an automatic dpr scaler and an in-game Reduced motion toggle.
**Decision:** `quality: 'auto' | 'low' | 'medium' | 'high'`, default `auto`, which renders like `high`. The presets live in pure `src/canvas/graphicsQuality.ts` (dpr cap, MSAA, Bloom, particle scale, contact shadows), and consumers read them with `useQualityProfile()`. Only `auto` adapts. It times frames in `playing` only (the countdown's shader warm-up and pauses are left out). After 2 s of a smoothed frame time over 24 ms it scales the pixel budget by 0.7, at most 4 times. It never steps back up within a page load, so the resolution never flips back and forth, and it is off under `?e2e=1` so the smoke's dpr checks stay fixed. An explicit preset turns adaptation off. The Reduced motion setting is ORed with the OS query inside `prefersReducedMotion()`, so every existing consumer follows it, and `html.reduce-motion` mirrors the CSS `prefers-reduced-motion` rules.
**Consequences:** A new pixel-heavy effect should read `useQualityProfile()` and add a field to the presets instead of checking the quality name. Code that needs the OS-only value uses `systemPrefersReducedMotion()`.

## 2026-10-30 — Pause freezes the world; runs reset on `runId`; resume stays `paused` until GO (Builder, #36)

**Context:** Only the level timer stopped while paused: the coaster kept riding, bobbing enemies jumped
(they read the render clock), and Restart from the pause menu under `?e2e=1` (`paused` → `playing`) looked
like a resume to `GameTimer` / `EnemySpawner`, which reset on phase transitions.

**Decision:**
- Gameplay systems keep gating on `phase === 'playing'` (they already did); the coaster camera additionally
  holds at `effectiveDelta = 0` while `paused`. Enemy `updatePosition` gets game time (`gameTime()`, playing
  frames × `timeScale`) instead of `clock.elapsedTime`. Ambient scenery (water, trees, sky, particles) keeps
  wall time on purpose, so the frozen scene behind the menu still breathes.
- A run starts when `startRun` bumps `runId`, not on a phase change. `GameTimer`, `EnemySpawner` and
  `CoasterCamera` reset on it; wave 1 is announced on the run's first `playing`.
- Resume is a store flag, not a phase: `resume()` sets `resuming` while the phase stays `paused`, so
  everything stays frozen through the ~1.2 s Ready / GO and no gate needs a new phase; `Countdown` sets
  `playing` on GO. Any `setPhase` clears `resuming`, so a tab hide or Esc during it pauses again.
- Pause mix: dedicated gain stages after the music duck and on the SFX bus (`setPauseMix`), driven from a store
  subscription (a hidden tab gets no frames): music −12 dB with the slow-mo low-pass, SFX silent.

**Consequences:** New gameplay code that moves things must gate on `playing` (or use game time) to respect
pause. Code that resets per run should key on `runId`.

## 2026-10-31 — Arcade SFX are baked into AudioBuffers per level and played on a fixed voice pool (Sound designer, #217)

**Context:** The Tone.js kit reuses one synth per sound, so overlapping shots and kills cut each other off, every
trigger needs `nextTriggerTime` to dodge Tone's "start time must be greater" error, and "never create Tone nodes in
a play function" keeps it to a handful of voices. The new SFX (behind `?audio=scrim`, beside the Tone kit until
parity, hard rule 7) should be arcade-loud, layered and positional.
**Decision:** `src/audio/arcade/` renders every one-shot once per level (`bake.ts`: one OfflineAudioContext, the
score engine's instruments and helpers, the level score's key and tempo) into mono AudioBuffers, and plays each as a
fresh AudioBufferSourceNode on one of `VOICE_BUDGET` (24) pre-built voices (gain → low-pass → pan, send to a
per-biome convolver). The source node is the only thing created per sound; it is single-use by design, so there is
no start-time collision to guard. A full pool steals its lowest-priority, oldest voice with a 4 ms fade, or drops a
sound ranked below everything playing (`pickVoice`). For this engine that replaces the "no Tone nodes in a play
function" rule: long-lived node count is fixed (`4 × (24 + 1) + 4`), checked by the smoke under `audioBurst(64, 32)`.
Under the flag the master limiter is a hard-knee compressor (−3 dB, ratio 20, its make-up gain trimmed back), because
Tone's Limiter has a 30 dB soft knee that let kills loud enough to sit 6 dB over the music clip; the default
(Tone.js) sound keeps the old limiter and renders match `main` to −147 dB.
**Consequences:** Changing a sound means changing its recipe or `ARCADE_SOUNDS` and re-rendering
`scrim-sfx-sheet-level1`; a level costs one bake (~25 s of mono audio, a few MB) while its countdown runs. When the
arcade engine becomes the default, `SFXManager` and the soft limiter can go.

## 2026-10-31 — Biome particles are a BiomeDefinition field; a boost fades extra points, never re-layers them (Builder, #37)

**Context:** `ParticleField` was mounted by hand in the volcanic `Features.tsx`, and its eruption boost raised the secondary layer's share, so points switched layer and velocity mid-flight and teleported (#95).
**Decision:** Every biome sets `BiomeDefinition.particles` to a preset in the pure `shared/particlePresets.ts` (bounds unit-tested so no field reads as noise); `BiomeEnvironment` renders it. A point's layer is fixed by its seed. A preset `boost` adds a separate set of secondary points (seed `aRand` in [1, 2)) that are clipped away until its bus event, then fade in over `riseS`, hold, and fade out; a repeat event restarts the rise from the current strength. Touch screens draw half the points (until a quality setting lands, #35). The always-on seeds come first from the same LCG, so the volcanic field's normal look is unchanged.
**Consequences:** No biome code mounts particles itself; a new biome adds a preset. Don't drive a boost by changing `uSecondaryShare` or any per-point layer input at runtime: that brings the teleport back.

## 2026-10-31 — Results Share links land on /go/share and send a `share` event (builder, #87)

**Context:** #87 asked for `https://scoaster.com/?utm_source=share&…`, but UTM dimensions are
paywalled on Vercel Pro (docs/marketing/README.md), so a root link with only `utm_*` would be
unattributable. The README already reserves the campaign landing path `/go/share` for this button.
The Marketer's rule keeps custom events at ≤ 2 per run.

**Decision:** The shared link is `https://scoaster.com/go/share?utm_source=share&utm_medium=organic&utm_campaign=results`
(path for Vercel, UTM kept for other tools), built in `src/ui/share.ts`. A completed share or copy
(not a dismissed sheet) sends one `share` event (`level`, `stars`) through the `results:shared` bus
event, which only `main.tsx` turns into `track()` behind the analytics gate. It is player-initiated
and rare, so it is outside the ≤ 2 per run count.

**Consequences:** Changing the link or the copy is a one-file edit to `share.ts`; the smoke pins the
URL (`SHARE_URL` in `e2e/smoke.mjs`) and the text format, so update both together.

## 2026-10-31 — Self-hosted OFL fonts; portal build (builder, #88)

**Context:** The portal zip (itch.io, Newgrounds, CrazyGames) may not call other origins,
and `global.css` loaded Lobster + Inter from Google Fonts (the 2026-10-19 decision that
accepted that call named self-hosting as the way out). ASSETS.md allows only our own or CC0
assets without a decision.

**Decision:** Vendor the latin-subset woff2 files of Lobster and Inter (SIL OFL 1.1, which
allows bundling and redistribution with the licence) in `public/fonts/` beside their licence
texts, and use them in **every** build, not only the portal one. Both builds then make no
third-party request at runtime; this supersedes the 2026-10-19 Google Fonts exception. OFL
fonts are an accepted exception to the CC0-only asset rule; any other font still needs its
own entry. The portal build is `vite build --mode portal` (`base: './'`, no analytics, no
share-card tags); the normal build keeps `base: '/'`.

**Consequences:** ~80 KB of fonts come from our origin instead of Google's. Characters
outside the latin subset fall back to system fonts, as before for anything our English text
uses. The smoke fails if either face does not load, or on any request that leaves the
page's origin in a local run.

## 2026-10-30 — Arcade instrument palette in the score engine (Sound designer, #215)

**Context:** The arcade sound (`SOUND-BIBLE.md`) needs instruments the Scrimshaw port lacks:
FM bass, supersaw, distorted guitar, orchestra hit, synth brass, a 909 kit, risers. The
port's original instruments leave every note's nodes to garbage collection, and a power
chord distorted note by note doesn't sound like one.

**Decision:** The palette lives in `scrim/synth.ts` beside the originals (which stay
untouched), and its instruments are our own code, not Scrimshaw's. Each arcade note or hit
collects the nodes it creates and disconnects them all from its last source's `onended`
(`ownedNote` / `ownedHit`). An instrument may declare a channel `insert`, built once per
session voice and disconnected with the session; `distguitar` uses it so all of a voice's
notes go through one amp and cab. The instrument list in `SCORE-FORMAT.md` is the
contract: `palette.test.ts` checks it against the synth and the compiler both ways.
`audio:render --score <file> --chain game` measures a score through the game's music
chain, the same numbers as `--music <id> --engine scrim`.

**Consequences:** A new instrument needs a row in `SCORE-FORMAT.md`, a name in the
compiler's lists and a lint range, or the test fails. Melodic scores keep the existing
mix numbers; nothing in the game plays the palette until a theme uses it.

## 2026-10-31 — The ride wind belongs to each SFX engine; kill sounds come off the bus; music loops are `guarded` (sound designer, #109)

**Context:** The wind whoosh built its own Tone nodes on `CoasterCamera` mount, outside the level kit: `sfxNodeCount()` missed
them, it never started when Tone's chunk landed after the level mounted, it ramped (two Tone automation events) every frame,
and under `?audio=scrim` it was the only Tone SFX left. Kill sounds were played by `EnemyBase` / `BossBase` while every other
gameplay sound came from `LevelAudio` (was `MusicController`) bus listeners. The nine music loop callbacks each hand-copied a
`try/catch` into `soundGuard`.
**Decision:** `SfxEngine.wind(speed)`. The Tone kit builds the wind chain through `own()` (it runs silent for the kit's
life) and the arcade engine builds the same chain (looped seeded white noise → band-pass → gain) in its graph, so each
engine's `nodeCount()` covers it and the scrim path no longer needs a Tone SFX node. Both re-aim the wind only when pure
`windUpdateDue` says so (speed moved ≥ 0.02, at most every 0.1 s, and always to 0). `enemy:killed` carries the kill timbre
(`sound`) or the boss weak point (`bossPart`), and `LevelAudio` plays it. Music `Sequence` / `Loop` callbacks are wrapped
once in `guarded(where, cb)`. `SFXManager.test.ts` fails any bare `new` in `SFXManager.ts`, the limit of the smoke's
node-count check. `audioBurst` spaces its kill steps 35 ms apart on the audio clock across every combo tier and reports
`killsPlayed`; the smoke requires all 10.
**Consequences:** A new Tone kit node must go through `own()`. A new kill source emits `enemy:killed` with its sound
instead of calling `sfx().kill` (the Kraken's slam splash is a world effect, not a kill, and still calls it directly).

## 2026-10-31 — Which enemy parts reflect the sky env map (Builder, #139)

**Context:** The 2026-10-24 sky env map entry (#121) says "The crows are the exception"
among enemies picking up `scene.environment`. That was wrong: the level5 `fireImp`
(`FIRE_IMP_BODY_MAT`) and `infernalDrake` (`DRAKE_BODY_MAT`) bodies are
`MeshPhysicalMaterial` too, so they reflect the Inferno sky at its `envIntensity` 0.6.
Most other enemy bodies were `MeshPhongMaterial`, which ignores the env map, so glossy
parts read flat.
**Decision:** Glossy parts move to `MeshStandardMaterial` (in `SharedEnemyAssets.ts`): the
shark skin (body, snout, fins, belly), the scorpion shell and tail, and the snowmen's coal
eyes, mouth and buttons. Matte or soft parts stay Phong (balloons, jellyfish, flying
fish, snowman bodies, carrot, scarf and hat, wisps, golem, horns, spikes, wings). The full
list of enemy materials that reflect the sky: crow feathers, fire imp and drake bodies
(Physical); the parts above, golden balloons and knots, the scorpion stinger, the
jellyfish cores, every eye except the flying fish's, and every lit boss material (Standard).
**Consequences:** Moving a material between Phong and Standard changes how it looks in every
biome that uses it; Standard has no `specular` colour, so tune `metalness` / `roughness`
against the level's `envIntensity`. Each Standard fragment samples the env map, so keep
large or numerous enemies (Theme Park's ~150 balloons) on Phong unless the look needs it.

## 2026-10-31 — Wind streaks draw after the world's transparents, depth-tested just behind the gun (Builder, #144)

**Context:** The 2026-10-25 entry "Sense of speed stays rotation-only; streaks draw in the opaque pass" (#27) put `WindStreaks` in the opaque list with no depth test, so water, particles and explosions drew over it (the sea dimmed the streaks on water levels). The streak / gun order also hung on two magic numbers in two files.
**Decision:** Supersedes that entry's streak pass (the rotation-only rules stand). The streaks are `transparent` (still additive, no depth write) at `CAMERA_LAYER_ORDER.streaks` (100), so they draw after every world transparent. They are depth-tested at a fixed clip z just behind the gun's depth range (`BEHIND_VIEWMODEL_CLIP_Z`): the gun's vertex shader squeezes it into the front `VIEWMODEL_DEPTH_RANGE` (2%) of the depth buffer, and the world sits behind that, so the streaks pass over the world and fail only on gun pixels. `src/core/cameraLayers.ts` holds the camera-attached render orders (streaks / gun / tracer / muzzle flash) and both depth constants.
**Consequences:** World objects keep renderOrder below 100. A new camera-attached layer takes its order from `CAMERA_LAYER_ORDER`; one that must sit over the streaks either writes depth inside the gun's range or draws after them.

## 2026-10-31 — The Kraken surfaces at fixed spots in front of the rider and resurfaces, instead of riding along (Builder, #183)

**Context:** The Golden Blimp follows the camera because a fixed boss is behind the rider within seconds. Tentacles sliding across the water with the rider would look wrong, and a moving base would sweep through the rails and towers. The ride also loops over most of the sea in front of it, so few spots are clear, and spots chosen along the track's arc were often off screen in its knots.
**Decision:** Each tentacle (and later the head) surfaces at a fixed world spot 550–1150 units out within ±0.45 rad of the camera's view, checked against `trackClearance` (base and slam landing), the drawn seabed and the sea stacks / breaching rocks (`seaObstacles`, from the shared `oceanLayout` cache). It slams away from the rider, so its sucker side faces back. It stays up ~6.5 s or until it falls behind the camera, sinks, and surfaces again further on. A weak point not out of the water parks at y −9999, so it cannot be hit or aimed at.
**Consequences:** Exposure windows come and go (the pacing the issue asks for), and the boss never moves through the track. A spot can fail in a tight knot of the ride; the boss retries (`krakenMotion.test.ts` bounds the head's retries). A future ocean prop that stands out of the water belongs in `seaObstacles`.

## 2026-10-31 — Daily Run: UTC day, levels 1–3, saves kept apart from the campaign (builder, #184)

**Context:** The Daily Run gives everyone the same seeded run each day, offline (no backend until Alex decides).

**Decision:** The day is the UTC date (`levels/daily.ts`: seed `hashString('daily-YYYY-MM-DD')`), so every
player shares the same run; the card shows the local date and the rollover time in its tooltip. The level
rotates through levels 1–3 only, so a new visitor can play it without unlocking anything. A run carries a
`runMode` in the game store; daily results go to `savedDaily` (per UTC day, last 30 days) and `dailyStreak`,
never to `savedScores`, so dailies cannot change campaign stars, bests or unlocks. Seed precedence is
`seed` > `?seed=` > daily seed > `Date.now()`, so `?seed=` still pins a daily for testing. `restartRun()`
(Replay, pause-menu Restart) keeps the mode, and a daily keeps its seed.

**Consequences:** A future online daily leaderboard can key on the same UTC date and seed. Changing the
seed formula or the level rotation changes every past day's run; bump the key prefix deliberately if ever needed.

## 2026-10-31 — Weapon pickups: accuracy, pacing and targets that aren't enemies (Builder, #185)

**Context:** Spread fires 3 bullets per pull and a piercing bullet can hit 3 enemies, so the results screen's accuracy (`hits / shotsFired`) could pass 100% or stop meaning anything. Pickups are shot like enemies, but they are not enemies.
**Decision:** Every bullet is a shot (a spread pull counts 3), and a bullet counts as a hit once, on its first target, however many it pierces (`CollisionTarget.firstHitThisFrame` → `processHit(target, countHit)`), so `hits ≤ shotsFired` always. Shooting a pickup counts as a hit too. The fire interval moved from `BulletPool` to `fireAtNDC`, which reads it from the active weapon; the held trigger re-times itself each pull. Pickups are ordinary collision targets with `kind: 'pickup'`: `processHit` skips `enemy:hit` (no hitmarker, hit tick or combo) for them, aim assist weighs them at 0.6, and the e2e hook's enemy counts leave them out. They sit in the track parameter range 0.05–0.33, which every level's run reaches before its timer ends.
**Consequences:** Anything new that walks `getCollisionTargets()` as "the enemies" must skip `kind === 'pickup'`. Moving pickups past t ≈ 0.38 means some levels never reach them.

## 2026-10-31 — Rails and lattice have a pixel floor, done in the vertex shader (builder, #186)

**Context:** Past a few hundred units the rails and tower lattice thinned to sub-pixel hairlines that broke into
dashes and shimmered. LOD meshes or thicker steel would change the near view, triangles or draw calls.

**Decision:** `withMinThickness` (`src/track/minThickness.ts`) patches the track and tower steel materials: each
vertex moves outward along its cross-section direction (`aThick` attribute: unit direction + real radius) until the
part projects to at least `RAIL_MIN_PIXEL_RADIUS` (1.5 px) or `LATTICE_MIN_PIXEL_RADIUS` (0.5 px) in drawing-buffer
pixels. The FOV is read from `projectionMatrix[1][1]` in the shader, so portrait, rotation and the speed FOV kick need
no uniform update; only the drawing-buffer height (`trackViewportHeight`) is set, on resize / dpr change. Ties and
footings carry a zero `aThick` and keep their size. Up close the real radius is larger and nothing moves.

**Consequences:** Far track reads as a solid line (its rails merge into one ribbon; the tie colour fades out of it).
Any new track or tower geometry drawn with these materials must set `aThick` (zeros if it should not grow), and tower
instances must stay unscaled (the push is in instance-local units). Hit tests and the camera use the curve, not the
mesh, so gameplay is unchanged. The Low preset has no MSAA, so some crawl remains there; FXAA/TAA would be a separate issue.

## 2026-10-31 — Tone.js loads on the first gesture, in its own chunk (builder, #187)

**Context:** Tone.js (~64 KB gz) sat in the main chunk although no sound can play before a user gesture.
**Decision:** `src/audio/tone.ts` owns it. Every `initAudio()` call creates or resumes the page's own `AudioContext`
synchronously in its gesture handler (`unlockAudioContext`; iOS Safari starts a context only there, and a touch `pointerdown`
is not an activation, so the PLAY `click` after it must resume again); the first call also `import('./toneLib')`s Tone and
hands it that context with `setContext`. `loadTone()` only loads (offline renders use it before any gesture). Main-chunk
modules import Tone's types only and reach it through `tone()`, guarded by `isAudioReady()`; the master chain is built after
the load, and code that must start sound once it lands (title music, a level's music + SFX kit) uses `whenAudioReady`. PLAY
waits at most 300 ms for the chunk. `toneLib.ts` re-exports just the parts the main chunk uses, because a dynamic
`import('tone')` keeps the whole namespace (+16 KB gz). `vite.config.ts` `manualChunks.tone` holds Tone and `toneLib`.
Lazy chunks (score player, arcade SFX, offline render) import `tone` statically and gate on `isAudioReady()` / `loadTone()`.
**Consequences:** The main chunk drops by ~63 KB gz, total unchanged. A new Tone class used from the main chunk needs an export
in `toneLib.ts` (tsc says so). The smoke's title step fails if `tone-*.js` is fetched before the key press.
**For the Director:** consider a `jsStartupGzipKB` budget in `budgets.json` (startup JS is printed by `check:bundle`: 470 KB gz
at merge) so it can't creep back; builders may not add it (hard rule 6). The #187 target "main chunk ≤ 150 KB gz" is not met
(182 KB gz): the rest needs level / biome code splitting.

## 2026-10-31 — Per-level scene ceilings in budgets.json (builder, #188)

**Context:** The VISION bar (≤ 250 draw calls, ≤ 250k triangles per level) was not enforced. On `main` tonight
levels 4 and 5 draw 393 and ~290 calls at the ride screenshot, over that bar, and no open issue covers them, so the
issue's `knownOver` route (ceiling at 250, warn until a fix lands) had nothing to point at. Draw calls also swing
between runs (level 2 measured 91 and 112 on the same commit).

**Decision:** `budgets.json` `scene` sets each level's ceilings from today's measurements: draw calls +20% over the
higher of two runs, scene and track objects / triangles +15% (those are camera-independent and exact). Levels 4 and 5
get plain ceilings above 250 (472, 353) that stop further growth; the smoke fails a level past any ceiling, or one
with no entry. `knownOver: "#<issue>"` on a level's entry turns its failure into a warning, for use once the
Director files an issue to bring a level under the VISION bar (the ceiling can then drop to 250).

**Consequences:** A PR that grows a level's scene past its ceiling fails `verify` with the number in the log.
Raising a ceiling is a budget raise (Director, with a decision entry); a new level adds its own entry. Levels 4 and 5
stay over the VISION draw-call bar until the Director plans that work.

## 2026-10-31 — Real 404s, site headers, no CSP yet (builder, #193)

**Context:** `vercel.json` rewrote every path to `index.html`, so any URL answered 200 with the game: soft 404s and endless duplicate URLs for Google. Lighthouse also lists CSP and clickjacking checks.

**Decision:** Rewrite only `/api/*` and `/go/(.*)` (campaign landing paths, #171); every other unknown path gets `public/404.html` (`noindex`) with status 404. Campaign links must therefore start with `/go/`. Every response gets `nosniff`, `strict-origin-when-cross-origin`, a deny-all `Permissions-Policy` for unused powerful features and `COOP: same-origin`; only Vite's hashed `/assets/*` get a one-year `immutable` cache, so `public/assets/` must stay empty (the favicon moved to `/favicon.ico`). No CSP: the strict, nonce-based policy Lighthouse recommends needs a per-response nonce that a static Vercel site can't mint, and an allowlist CSP would need `'unsafe-inline'`. No `X-Frame-Options`, so the game stays embeddable. Lighthouse gates SEO 100 and Accessibility / Best Practices ≥ 95 in `verify`; Performance is reported only (software GL).

**Consequences:** A new client-side route (if the game ever gets one) needs its own rewrite in `vercel.json` and a case in `scripts/site.test.ts`. Revisit CSP and framing with a Vercel middleware if the site starts taking user input or accounts. Details and sources: `docs/marketing/SEO.md`.

## 2026-11-01 — Tone.js music tracks start on the next beat, not the next bar (Builder, #168)

**Context:** `startTransportAt` started a new track on the next bar line (2.2 s at 108 bpm, 3.3 s at 72 bpm) while the
outgoing bus faded to 0 in `MUSIC_FADE_S` (1 s), so a switch was often a fade out, silence, then the new track: a gap.
**Decision:** a new track starts on the next beat (≤ 0.83 s at the slowest tempo), and the Transport's tempo steps to the
new bpm on that beat instead of ramping, so the incoming track is in time from its first note (the step lands under the
outgoing track's last ~fraction of its fade). Both gain ramps still start at the switch, a constant-sum crossfade. The
fade log records each ramp's start and the incoming track's `firstNote`; the smoke fails a switch whose first note lands
after the outgoing fade ends.
Entering a run, the title track is handed over (`fadeOutMusicBus(..., untilNextTrack)`, scrim `handOverScore`): it keeps
playing until the level's track opens once its scene has mounted, and only then fades out under it (a 20 s fallback fades
it if no track opens). The smoke requires every checked switch to have an overlapping fade-out / fade-in pair.
**Consequences:** tracks no longer line up with the old track's bar grid (inaudible: it is fading out). Do not go back to
bar-aligned starts without also delaying the outgoing fade to the new track's first note.

## 2026-11-01 — Legacy v1 game and the api/ stubs removed from main (builder, #283)

**Context:** Alex asked for the repo to hold only what the game and studio use. The 2015
game (`js/`, `assets/`, `index.legacy.html`, `package.legacy.json`, `gulpfile.js`,
`.jshintrc`, `base.css`) was ~100 MB of the working tree that nothing built. The `api/`
serverless stubs (leaderboard, daily seed, ghost) were in-memory placeholders that only
the unimported `src/utils/api.ts` called; scores and the Daily Run are local.

**Decision:** Delete both from `main`. The last `main` commit that still has them is
`e78bd27d9a5b6bd2d776358f50b2c1a0d16a0bf8` (`git show e78bd27:index.legacy.html`,
`git checkout e78bd27 -- js assets` to get them back). The playable 2015 game stays on
the `gh-pages` branch (http://alexbelyeu.github.io/shooterCoaster/), which is kept.
`vercel.json` drops the `/api/*` rewrite and its `noindex` header, so `/api/*` is now a
plain 404 (the 404 page is `noindex`). The `/assets/*` immutable cache rule stays: it is
for Vite's hashed bundles in `dist/assets`, not the old folder.

**Consequences:** An online leaderboard or ghost backend (VISION 24, 26) starts from
scratch with Alex's backend decision (hard rule 4), not from these stubs. `.git` does not
shrink (no history rewrite, hard rule 2); fresh clones' working trees do.
