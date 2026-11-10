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

## 2026-10-30 — Arctic trees get an unlit fill instead of a brighter scene (Builder, #62)

**Context:** Arctic pine canopies rendered as near-black "umbrellas" that players took for
enemies. Their colours (sRGB lightness 20–30%) were dark, but the bigger cause was light: the
low sun backlights the cone sides the rider sees, and ACES plus the arctic grade crush those
low values while the bright snow beside them stays pale. Even pale canopies (lightness ~60%)
rendered at about (27, 40, 76).
**Decision:** `BiomeTreeConfig.fill` adds that fraction of a tree's own lit colour (instance
tint × crown shade) as emissive light in the shared tree shader (`patchTreeFillFragment`,
uniform `uTreeFill`, same program for every tree). Arctic uses 0.35 with lighter blue-green
canopies (lightness 36–46%) and a lighter trunk. Raising the hemi light or exposure was
rejected: it would wash out the snow that makes the Antarctica frame. Volcanic keeps fill 0
(its trees are meant to be charred black).
**Consequences:** A biome whose trees read too dark can set `fill` without touching its
lighting. Draw calls, triangles and shader program count are unchanged.

## 2026-11-01 — Token efficiency: context budget, quiet logs, ledger diagnostics, builder run cap (Alex's session)

**Context:** The ledger's 168 runs (24 Oct – 1 Nov, ~226M weighted tokens) showed Builders at 71% of spend (~6M per run), cache writes at 48% of all spend, and builder runs re-writing their whole context ~15 times each, at ~157k tokens of context per turn. Spend went from ~12M/day to 82M on 31 Oct when Builders were fired back to back, which exhausted the old account.
**Decision:** The ledger records a `diag` per run (peak context, compactions, cache misses by cause, heaviest tool results). Noisy commands run through `scripts/quiet.sh`. CLAUDE.md gained a "Context budget" section, stopped being re-read by role files, and moved the smoke spec and test hook to `e2e/README.md` (47KB → 30KB). Builders stop once `builder_runs_per_day` (STEERING.md) is reached. QA (on label) no longer polls for the merge.
**Consequences:** Don't move the smoke spec back into CLAUDE.md or add "Read CLAUDE.md" to role files. Read the `diag` in new ledger entries to find what still drives cache misses before changing models or parallelism.

## 2026-10-31 — Local leaderboard: saved at once, renamed in place; persisted data is sanitised on load (Builder, #40, landed by #317)

**Context:** The results screen asks a placing run for arcade initials. A player can leave
(Levels / Replay / tab close) before confirming, and localStorage can hold anything: an older
build's shape, a hand edit, a half-written value.
**Decision:** `leaderboards` (top 10 per level, `store/leaderboard.ts`) and `lastInitials`
persist beside `savedScores` under the same `shootercoaster-scores` key; `ScoreEntry` is
unchanged. The run's entry is stored the moment the results screen mounts, under the last
initials used, and every letter change renames it in place (`setEntryInitials`), so no exit path
loses it; confirming only closes the entry. A tie ranks below the entries already there. The
persist `merge` runs everything loaded through `sanitizeSavedScores` / `sanitizeLeaderboards` /
`normalizeInitials`, and the Daily Run's `savedDaily` / `dailyStreak` through
`sanitizeSavedDaily` / `sanitizeStreak` (a custom `merge` drops any key it doesn't return), so bad
data loads as valid or empty, never as a crash; a level with a saved best but no board (saves
from before this) starts its board with that best under `---`.
While the entry is open it owns the keyboard (R and S are letters, Enter confirms) through a
window capture listener, except inside the open share menu; the screen's Enter = next / R =
replay return once it is confirmed. Settings "Clear local data" wipes scores, stars (so
unlocks), boards and the daily bests and streak, not settings. A daily run keeps its own best
(decision `2026-10-31 — Daily Run`) and never enters these boards: its results show no board.
**Consequences:** Anything new in the persisted game store needs its own sanitiser in that
`merge`, or it bypasses the guard.

## 2026-11-02 — Theme options live beside the scores, behind `?theme=` (Sound designer, #216)

**Context:** The taste gate needs two or three candidate themes per slot playable in the game before Alex picks one, without changing what anyone hears by default.
**Decision:** Candidates are ordinary scores named `<slot>.<name>` in `src/audio/scores/themes/`, listed in `SCORES` with their own `SCORE_KEYS` entry. `?audio=scrim&theme=<name>[,<name>]` swaps them in through `scoreIdFor(slot)`, read by the score player and the arcade SFX bake only; tracks keep their slot id, so crossfades, hand-overs and the e2e checks are unchanged. Once Alex picks, the winner's text replaces `<slot>.scrim` and the losing options are deleted with their `SCORE_KEYS` rows.
The title brief changes from a 20–30 s attract-mode theme to the same form as the level themes, a 1–2 bar intro then a 32-bar loop (about 45–50 s), so the title can hold someone browsing the menus for minutes without the loop wearing thin; Alex's pick in #301 confirms or reverses that.
**Consequences:** The lazy score-engine chunk carries the options until the pick (about 5 KB gzipped); default players never download it. Any later listening round (levels 2–5) reuses the same flag and folder.

## 2026-11-02 — Results share menu: own menu on desktop, `share` event carries `method` instead of `stars` (Builder, #271)

**Context:** The desktop system share sheet (macOS Safari: the page and Notes) read as broken. Vercel Pro records at
most 2 properties per custom event, and the `share` event already used both (`level`, `stars`).
**Decision:** The Web Share sheet is used only on a coarse pointer (phones, tablets) and when it works; everywhere
else Share opens our own menu of Copy link + plain share-intent links (no SDKs, scripts or runtime requests; a link
the player clicks is not a runtime call by the game). The `share` event now sends `level` + `method` (`native`,
`copy` or the network), dropping `stars`: which network brings players is the question the Marketer asked. Each
method gets its own `utm_campaign=share_<method>` (the native sheet moved from `results` to `share_native`).
**Consequences:** `share` events before 2026-11-02 have `stars`, later ones `method`. A network link's event means
the player opened that network's composer, not that they posted. Adding a network = one `SHARE_TARGETS` entry and
one `shareTargetHref` case, plus the smoke's `SHARE_TARGETS` list.

## 2026-11-02 — Auto-merge hands conflicting approved PRs back to Fix (Builder, #299 / #241)

**Context:** When an approved PR conflicted with `main`, `scripts/automerge.cjs` commented
`Auto-merge failed:` and left `agent:qa-approved` on it. No role watches that label, so the
PR waited for the nightly Maintainer (#276 stalled twice this way).

**Decision:** A conflict is detected from the PR's `mergeable === false` (checked before
`verify`, since CI doesn't run on a conflicting PR) or a merge answered "not mergeable".
The workflow then comments a conflict-only change request ("merge conflict only; full
review passed") and swaps `agent:qa-approved` → `agent:changes-requested`, which starts Fix
(on label); QA follows with the light re-review. Other merge failures (for example "Base
branch was modified") keep the label and are retried by the sweep. Conflict hand-backs
don't count towards the 3 sends back: nothing was wrong with the change. Each PR in a run
is handled in its own `try/catch`, so one API error can't skip the CI dispatch on `main`
after an earlier merge.

**Consequences:** Conflicts cost one light Fix + QA round instead of a stall. A PR that
keeps conflicting can loop Fix ↔ auto-merge without hitting the bounce limit; each loop
needs `main` to move again, so it ends once the queue drains.

## 2026-11-02 — The Giant Scorpion rides along on the sand; a broken tail segment closes up (Builder, #318)

**Context:** Desert's finale. The Kraken surfaces at fixed spots because it needs water; the scorpion can walk, and
the desert track loops over most of the ground ahead of the rider, so a fixed offset (the Blimp's) would often
stand it on the rails or a tower.
**Decision:** It rides like the Blimp (smoothed heading, a fixed distance ahead and to one side) but picks its spot
from a ranked list of [ahead, side] slots on either side (`scorpionMotion.ts` `PERCH`), keeping its current slot
while it stays clear of `trackClearance` (2D, towers included), the landmarks and mesas (`desertObstacles`); it
scuttles to the next clear slot when blocked. Its tail is laid from the live segments only, so breaking any segment
(not just the tip) shortens the tail and the stinger stays on the end, sitting on a bare stub for phase 1. Bosses
now get `incoming` (their tell) as a prop: the scorpion's dune heaves and the desert dust boosts
(`scorpion:burrow`) during it.
**Consequences:** At the highest points of the ride (~480 above the sand) the tail top (~480) is level with the
horizon rather than above it. Any new ground boss should reuse `pickPerch`'s slot approach rather than a fixed offset.

## 2026-11-02 — Score intensity layers: per-voice level gains, intro plays everything, wind-down a layer a bar (Sound designer, #321)

**Context:** The score engine's level music should follow the combo (base / +drums / +lead / FRENZY), for any score,
without breaking parity with the original Scrimshaw compiler or growing the node count.
**Decision:** A voice joins a layer with `layer=` (untagged = `base`; the field is absent otherwise, so parity
`toEqual` holds). Intensity is the combo tier index, sent by `LevelAudio` every frame. A layer is each voice's own level
gain ramped over 50 ms ending on a loop beat line, so no new nodes; silent voices keep playing their notes so a layer
comes in mid-phrase. A layered score gets one low-pass per track, 7 kHz below FRENZY, opened to 20 kHz at FRENZY;
untagged scores get none. The intro always plays every layer (it is the countdown fanfare). A rise lands on the next
beat; a fall drops one layer on the next beat and one per bar after, each asked for once the previous one has landed.
**Consequences:** Scores must make `base` stand alone (`scores.test.ts` checks it plays in every loop bar). The music
bus compressor keeps loudness nearly level across layers (level1: −16.6 → −17 LUFS), so layers read as density and
brightness, not volume. A FRENZY lost a fraction of a beat after it was asked still sounds for a bar. A pause keeps the layers: a session resumed before a scheduled step lands (a pause
during the intro, or just before a beat line) opens on what was playing and still takes the step on its beat line
(`resumeLayers`). FRENZY keeps both lifts: the arcade's `frenzyLift` loop is the SFX riser, the score's low-pass opening
is the music's; the slow-mo duck hides the opening for its 1.5 s, and the score stays bright for the rest of FRENZY.

## 2026-11-02 — Shaders feeding the composer must output finite, in-range values (Builder, #344)

**Context:** The title went fully black for a frame whenever a pixel centre landed exactly on one of drei `Sparkles`' point centres: its glow is `0.05 / distance - 0.1`, so alpha was Inf, blending made the pixel NaN, and Bloom's `mipmapBlur` carried that one pixel into every mip and back over the whole frame. Only with Bloom on, and only on frames where the alignment happened (random sparkle positions), so it read as an intermittent smoke failure blamed on the sun.
**Decision:** The title glints are our own `src/canvas/TitleSparkles.tsx` (seeded layout, glow clamped to [0, 1], negative corners discarded) instead of drei `Sparkles`. Any point/sprite shader that divides by a distance must floor the divisor and clamp alpha. The title smoke draws a sparkle centred on a pixel (`pointCentreColour`) and fails on anything outside [0, 1].
**Consequences:** Don't bring drei `Sparkles` back (or any third-party shader with an unbounded falloff) without the same check. A composer-wide NaN guard ahead of Bloom was left out: the source fix plus the check cover the one producer found; the five level scenes render no non-finite pixel along the ride.

## 2026-11-02 — Week 3: M3 opens early with the finales and Level 6; milestones on GitHub; small issues are bundled (Director)

**Context:** M2's content landed in week 2 (combo tiers, formations, death variety, two
bosses, pickups, daily run, pause, settings, share, launch tooling); only the leaderboard
(finished on a branch, lost to a conflict) and a green smoke on `main` remain. The queue
held 27 `agent:ready` issues, almost all P3 review follow-ups, and no player-facing work.
Alex asked for the roadmap to run as GitHub milestones (#192) and for sound to keep pace
(#212), whose next steps all waited on his theme pick (#301). Builder runs cost ~6M tokens
each regardless of issue size (ledger diag, #298).

**Decision:**
- M2 closes on #317 (re-land the leaderboard branch) and #316 + #305 (Ocean opening, fixed
  level-time sampling in the smoke). M3 ("Depth and spectacle", milestone #2, due 6 Dec)
  opens this week rather than next: the three remaining finales (#318 Scorpion P1, #319
  Yeti, #320 Magma Titan), the Level 6 Neon Metropolis epic (#322) as three vertical slices,
  the Ocean's water (#326), far-rail depth (#327), Inferno's lava (#331), a swoop intro and
  results orbit (#328), tunnels and a loop (#332).
- Audio engine work is decoupled from Alex's picks: intensity layers + FRENZY lift (#321,
  P1, any score) come first; #302 shrinks to swapping in the picked themes.
- The PLAY-straight-to-ride funnel change (#329) is filed but held until the Showcase
  week has been measured against the W44 baseline (Marketer, 9 Nov).
- Milestones: the Director owns them (REST only), sets one on every issue, closes and
  creates them against VISION.md's exit criteria (`.claude/agents/director.md`,
  PROTOCOL.md). #330 makes them visible on the status page and in the weekly report.
- Related small follow-ups are bundled into one issue per session (#333–#339 cover 16
  P3 issues, which lose `agent:ready` and close with the bundle's PR). #241 folded into
  #299; #187 closed as done; #40 superseded by #317.
- `budgets.json` was not lowered to the VISION 250-draw bar on levels 4–5: `knownOver`
  would silence the whole level's gate while #260 is open. #260 lands the ceiling itself.

**Consequences:** 29 `agent:ready` issues for the week (6 P1, 11 P2, 12 P3 of which 7 are
bundles) plus 7 blocked ones with named unblockers, against ~29 expected builder
completions (21 runs × parallelism 2 × ~70 %). If the Showcase week shows the
mobile start rate under half of desktop's on ≥ 20 mobile visitors, the next Director
run puts a phone title → PLAY → ride issue at P1 ahead of the finales.

## 2026-11-03 — Arcade SFX: a placed sound keeps its louder channel at its level (Sound designer, #321)

**Context:** The arcade engine pans each mono one-shot with a StereoPannerNode (equal power), so a sound at the centre
of the screen plays 3 dB down in both channels, while one at the side is up to 3 dB hotter in its near channel. The
enemy just shot is usually near the crosshair, so the most common kill was the quietest: in the level1 combat mix a
centred 1× kill read 4.6 dB over the music (target ≥ 6), against 7–8.7 dB for kills off to the side.
**Decision:** A placed sound (kills, hits) gets `panGain(pan)` (`sfxDesign.ts`): the louder channel stays at the sound's
level wherever it pans (+3 dB at the centre, 0 dB at the edges). Unplaced sounds (gun, cues, UI) stay as they were. The
kill bodies come down 1 dB (−3 dB, the hiss −4 dB), so the edges, which already met the master limiter, sit under it.
**Consequences:** Every kill clears the music by ≥ 6.7 dB in the level1 mix (seeds 1–3: 6.7 / 6.8 / 6.9), true peak
stays at −1.0 dBTP and short-term max at −13.0 LUFS, the top of its −15…−13 range. Centred hits are up to 3 dB louder
than before. The SFX sheet renders sounds unplaced, so it shows each sound 1 dB under the mix's centred kills.

## 2026-11-02 — Enemies: one mesh per material and moving part (Builder, #260)

**Context:** Formation and ground-scatter waves put 25–40 enemies of one type on screen at once. With one `<mesh>` per part (eyes, smile dots, buttons, shards, tendrils), Arctic drew 393 calls and Inferno ~290, over the VISION bar of 250.
**Decision:** In `SharedEnemyAssets.ts`, parts that share a material and move together are baked into one module-level geometry with `placedParts` (positions, rotations and scales as the meshes had them). Only parts with their own animation stay separate meshes (snowman arms, imp tail, golem arms, wisp core pulse). The ember wisp's six tendrils now flicker as one crown instead of each on its own. `budgets.json` holds level4 / level5 at 250 draw calls.
**Consequences:** New enemy models should follow the same rule; a new per-part animation means splitting that part back out deliberately. Hit flash and the warm-up are unaffected (they walk meshes and module exports).

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
budgets are unchanged. The readability probe samples the same moment; before this it ran a frame or more after the
stats, past the 15 s second waves on CI, which hid that level3 shows one readable enemy at 10 s from this track point (#250). `hidden-pause`'s wave slack is 1 s (whole-second timer store) + 2 × the longest frame since
Resume, not a fixed 3 s.

**Consequences:** Don't go back to wall-clock waits for level checks: the budgets and readability gate assume that
moment and track point. Players keep the frame-delta timer and ride (`levelTimeStep` / `e2eRideSeconds` only act
under `?e2e=1` with the knobs set). If CI's runners get much faster, its natural ride no longer matches 0.14, which
is fine: the smoke now sets it.

**Addendum (2026-11-04, Alex's chat):** The cap alone still let level time advance through the combat checks, so on
a slow runner a level could time out (or its boss surface) before the leaderboard and kill checks, which failed
docs-only PRs (`leaderboard: run ranked 0`, `kill used the bossPart death effect`, `fireShot() fired nothing`). The
level steps now also set `holdLevelTime` for the combat checks: the level timer stops while the game clock, enemies,
effects and combo run on, and the step releases it in the turn it ends the level. The readability gate needs an enemy
on screen and min(2, on screen) of them readable, so one readable enemy of one passes (#250).

## 2026-11-02 — Sea enemies float beside the track, in a band sized to the ride (Builder, #316)

**Context:** Ocean's jellyfish and sharks were scattered over a 1,100-unit disc around the origin, so the
first 10–15 s of the level showed an empty sea (#250). The ground trackside band (700–2200 arc units
ahead, #179) does not fit the Ocean: its ride averages ~250 units/s, so a wave placed 700–2200 ahead is
behind the rider within ~9 s, and its tight turns put much of that band behind the rider in plan.

**Decision:** `jellyfish` and `shark` use `'trackside'` placement on the water. `TRACKSIDE` has a band per
surface: ground stays 700–2200 ahead, water is 300–3600 ahead (60–400 to the side for both), about the
ride between Ocean's waves, so a wave stays in view until the next one lands. Half of each water wave
is drawn within 1500 ahead (`near` in the band), so the wave is on screen as it arrives: spread evenly
over 300–3600, at most 3 of the 20 opening jellyfish were ever in frame, and CI's readability gate
failed. A water slot searches across the track, then nearer or further within the band, for a point
over the sea that is in view on its approach: inside the formation anchors' 40° cone and within the
type's readable distance (`maxReadableDistance`) from the rider 1100 arc units before it (or at
activation) and 400 further on; failing that, the first point over the sea. With ~10 jellyfish in view
at once, a jellyfish's 7 draw calls (bell, core, five tentacles) took level3 to 131 draws (budget 89),
so its bell and tentacles are one merged geometry (2 draws with the glowing core; the whole bell rocks
instead of each tentacle swaying): 81 draws at the smoke's ride sample. Sharks
circle a 25–60-unit orbit through their spawn point instead of drifting (their old drift had radii up
to ~2,000 units). Ocean gets a second jellyfish wave (12, at 28 s) so the stretch before the flying
fish and the Kraken isn't empty; `maxScore` 2045 → 2261.

**Consequences:** A trackside band is about how far the rider travels while the wave is live, not just
view distance: re-check it when a level's speed or wave gaps change. Water slots are always over the
sea when there is sea within the band. `spawnPlacement.test.ts` checks level3's opening (ride t
0–0.025, the smoke's ride sample at any runner speed) keeps ≥ 4 readable jellyfish in view at seed 1337
and ≥ 2 (the smoke gate) at seeds 1–20. The trackside unit test now checks each enemy is in front of
the rider on the approach (600 arc units before it), not at placement time.

## 2026-11-03 — Production: a deploy health check, the full smoke nightly, alerts on transitions (Builder, #352)

**Context:** The post-deploy production run replayed the whole smoke against scoaster.com. Its runtime crept past its cap
(1465 → 1932 s), so every deploy "failed" with no failed check and emailed Alex through #297.
**Decision:** After a deploy, `e2e/prod-check.mjs` checks only that the deploy arrived intact (every built file served with
its headers, routes, title, one level to a kill, a phone run; ~3 min, 8 min cap). The full smoke runs against prod nightly
(60 min cap). Both run under `timeout`, so a slow run is a reported timeout, and a deploy run superseded by a newer deploy
is cancelled and says nothing. `scripts/prod-alert.cjs` keeps one `agent:prod-broken` issue per suite and uses it as the
state: it opens on green → red, stays silent while open and closes on the next green run. Choices that look arbitrary:
- The deploy check's kills go through `killNearest` (the bullet pool's hit path). Whether a tapped bullet lands depends on
  the software frame rate, and the nightly smoke and `verify` already gate touch aim assist.
- The files to expect come from a local `VERCEL=1` build of the deployed commit, matched to the deployed files by name
  without the hash, because Vercel's hashes can differ.
- CI's red-`main` report never comments on a production suite's issue, because that issue closes itself when prod goes green.
**Consequences:** A green → red change sends one email per outage. A timeout says "no check failed". The full suite still
catches CDN / runtime drift within a day. Don't move the full smoke back onto `deployment_status`, and don't just raise the cap.

## 2026-11-01 — Marketing clip: re-render for pushes only, no GIF in git (builder, #203)

**Context:** every `npm run clip` re-render committed to `docs/marketing/media/` adds its files
to git history for good; the GIF alone is ~7 MB, twice the MP4, and is made from the same frames.
**Decision:** re-render only for a launch or marketing push, committing the MP4 and stills.
`scripts/clip.mjs` writes the GIF next to the frames in `e2e-results/clip/<size>/` (gitignored);
the README has an ffmpeg line to make one from the committed MP4. The 2026-10-28 GIF already
committed stays (deleting it would not shrink history).
**Consequences:** ~3.4 MB of history per re-render instead of ~10 MB. Whether `docs/marketing/media/`
gets a size budget line is left to the Director.

## 2026-11-04 — Score card image: canvas, story on phones, feed on desktop (Builder, #272)

**Context:** The results Share button should share a picture of the run. Options were a WebGL capture of the scene, a server-rendered Open Graph image, or a 2D canvas drawn in the browser.
**Decision:** A 2D canvas card (pure layout in `src/ui/scoreCard.ts`, drawing in `scoreCardImage.tsx`) built from the level-select postcard SVG and the self-hosted fonts, drawn only when the player opens Share. Touch devices get the 1080×1920 story card (on the share sheet when `canShare({ files })`, else from the menu); desktops get the 1200×630 feed card (Save image / Copy image). The menu item reads "Save image", not "Download image", so it fits one line in the 2- and 3-column menus; its analytics method is still `image_download`.
**Consequences:** No WebGL readback, no server, no request. Per-score link previews would still need a server (out of scope). The sheet needs the click's user activation, so the story card starts drawing on the Share button's pointerdown.

## 2026-11-04 — CI smoke runs as parallel shards behind a `verify` gate, with a `smokeSeconds` budget (builder, #353)

**Context:** The smoke ran serially inside the one `verify` job: ~25 min of a 40-min cap, growing with every level,
boss and step, and every PR waited ~30 min for CI. The `main` ruleset requires a check named exactly `verify`.

**Decision:** `ci.yml` runs `unit + build`, `lighthouse` and one `smoke (<shard>)` job per shard in parallel, then a
`verify` job that needs them all and passes only if every one succeeded (it runs when one failed or was cancelled,
and then fails). The shard table is `SHARDS` in pure `e2e/shards.mjs` and the shards are named steps of the one
smoke, not a second runner (`--shard`, `--steps`). `shards.test.ts` holds them to running exactly what the full
`npm run smoke` runs:
`ui` (title, landing, levelSelect, daily, settings), `level1` (ride, frenzy, seed, boss, pickup), `level1-steps` (quality,
pause, countdown, speed, scrim), `level2`…`level5` (every per-level step on that level) and `mobile` (the phone run). Each
shard job builds the commit itself (~30 s), which is quicker than waiting on a shared build job.
New budget `budgets.json` `smokeSeconds`, per shard, checked on CI only (a 2-core session is slower): over budget fails
with `<shard> shard took X min, budget Y`, and a shard still running at twice its budget writes its results and exits
before the 25-min job timeout. The numbers are 1.5x the slower of each shard's smoke time on two CI runs of #364,
rounded up to 30 s (the short shards swung by up to ~50% between runs; budgets at 1.4x one run failed ui and level1):

| shard | run 1 / run 2 (smoke only) | budget |
|---|---|---|
| ui | 2.1 / 3.2 min | 300 s |
| level1 | 3.3 / 5.3 min | 480 s |
| level1-steps | 5.3 / 4.7 min | 480 s |
| level2 | 5.6 / 5.6 min | 510 s |
| level3 | 4.1 / 2.8 min | 390 s |
| level4 | 2.7 / 2.5 min | 270 s |
| level5 | 1.8 / 2.6 min | 240 s |
| mobile | 7.7 / 7.7 min | 600 s (1.3x: steady, and it sets the wall time) |

GitHub creates the `verify` check only when its needs end, so `automerge.cjs` and `studio-status.cjs` treat a head
with CI jobs still running and no `verify` yet as "verify waiting", not "no verify".

**Consequences:** `verify` took 8 min 46 s and 8 min 50 s wall on #364 instead of ~30. A new level needs a shard, a matrix entry in
`ci.yml` and a `smokeSeconds` entry (the unit test fails until all three exist). The phone run (`runMobile`, one
continuous session) is the long pole: the next big addition to it should split it into two shards instead of
raising its budget. Only the Director raises these budgets.

## 2026-11-06 — Online leaderboard: Supabase behind Vercel Functions (Builder, #365)

**Context:** Alex decided on 4 Nov 2026 (#365) to add an online leaderboard. This supersedes the
2026-10-19 decision "No online backend until Alex decides". He owns the account side: a dedicated
Supabase project on his free plan, its env vars in Vercel, and running the migration.

**Decision:**
- The browser only ever calls same-origin `/api/leaderboard`; `api/leaderboard.ts` (Vercel Function,
  Node runtime) is the only code with the Supabase secret key. It talks to PostgREST with plain fetch,
  no supabase-js. `check:bundle` fails if Supabase's URL, key names or REST path reach the browser.
- Only the production build calls it (`__BUILT_ON_VERCEL__`, not `?e2e=1`); dev, preview, CI, the
  smoke (stubbed with `page.route`) and the portal build never do. Every failure (no env vars, a
  paused project, timeout after 3 s) falls back silently to the local board; the API answers 503,
  never a 500 or details.
- Score ceiling = every kill at the top 5× combo multiplier, golden balloons included
  (`src/levels/scoreLimits.ts`), not the level's `maxScore`: `maxScore` is the no-combo score, so real
  runs pass it. api/ can't import `src/` at runtime (Vercel builds functions without the `@/` alias),
  so `scripts/gen-level-limits.mjs` generates `api/_lib/levelLimits.ts` and a unit test fails when it
  is stale.
- Rate limit (5 accepted POSTs per IP per 10 min) is a count over the `scores` table by `ip_hash`, an
  HMAC-SHA256 of the IP keyed by the secret key: no extra table, no raw IP stored.
- Only runs that place on the local board go online, once, after initials entry (or as the results
  screen closes). A run that misses the local board fetches and shows the World board.

**Consequences:** The game has one backend dependency, optional by design. New levels or score
changes need `node scripts/gen-level-limits.mjs`. Schema changes need Alex to run SQL by hand.
Scores are only plausibility-checked (no replay validation): a determined cheater can still post a
high but possible score; Alex can delete rows (docs/LEADERBOARD.md).

## 2026-11-04 — Studio-health watchdog: a plain Action that files the studio's own problems (builder, #370)

**Context:** Every flake, timeout and stuck PR in the week of 2 Nov was found by Alex reading GitHub
emails. Agents waved red checks through as "known flakes", and nothing noticed when scheduled runs
stopped.

**Decision:** `.github/workflows/studio-health.yml` runs `scripts/studio-health.cjs` every 2 h as a
plain Action, not an agent task, so it still runs when the agents are what's broken. Pure rules in
`scripts/studioHealthRules.cjs` keep one `studio-health` issue per problem (body marker), `agent:ready`
+ P1, ahead of feature work. Thresholds: runtime creep at a median of ≥ 75 % of a job's limit over ≥ 3
green runs; stalled when ≥ 2 scheduled Builders / QA slots (studio-status.cjs `SCHEDULE`, 2 h grace
each) pass without a token-ledger post, counting only slots after that role's work was queued (its
oldest queue label), after the last pause ended (pause state read once, `readPauseState` in
studio-status.cjs, honouring `PAUSE until`) and, for Builders, while `builder_runs_per_day` wasn't spent;
a flake is a failed job whose *same job* passed on the same commit (one workflow can run different jobs
on one commit), or one failing on a docs-only PR; approved PRs unmerged 3 h after
the label, `needs-qa` waiting 24 h; escalation to Alex once, when open 24 h and still seen in the last
24 h. It never duplicates the existing alerts: red `main` in ci.yml's `verify` and every prod-smoke
failure already open `agent:prod-broken` (revert first, PROTOCOL "When main breaks"), so the watchdog
only escalates those in place after 12 h. Runs older than a key's last close don't count, so closing an
issue after its fix sticks. PROTOCOL "No known flakes": a check failing without the change causing it is
a P1 bug in the check; QA never approves past it.

**Consequences:** Builders and the Maintainer spend runs on CI health before features. Findings about
the current state (stalled, stuck PRs, QA backlog) refile while the state holds even if closed by hand.
Workflow limits are read from main, so a job that ran well past one (an unmerged PR on an older
workflow file) is ignored for timeouts and creep.

## 2026-11-06 — Theme options are written in intensity layers; the registry reads `themes/` by glob (Sound designer, #303)

**Context:** The first listening round (#216) wrote its options without `layer=` tags, so a pick
needs rewriting before it can follow the combo. #303 adds twelve options for levels 2–5 while
PR #386 (the #301 picks) also edits `scores/index.ts`.
**Decision:** Every level option tags its voices base / drums / lead / frenzy, so Alex's pick
replaces `<level>.scrim` unchanged. Its seam render holds every layer (`--layers 3`), since a
seam render opens inside the loop at intensity 0. `scores/index.ts` reads `themes/*.scrim` with
`import.meta.glob`, the same change as #386, so a listening round adds only score files and their
`SCORE_KEYS` rows.
**Consequences:** The scores add ~43 kB (~7.5 kB gzip) to the lazy `?audio=scrim` synth chunk
until the losing options are deleted. A theme option's file name is its `?theme=` id, so names
must stay unique across slots.

## 2026-11-06 — Enemy turntable: real components, own build, own workflow (Builder, #380)

**Context:** Art review of enemies needs close-ups from every side and in motion, on every PR that touches them, without slowing the other PRs (#371/#372) or reaching the game's bundle.
**Decision:** `turntable.html` + `src/dev/turntable/` mount the shipped enemy and boss components (not copies) and are built only by `vite build --mode turntable` into `dist-turntable/`. Motion is real game-time animation with each subject's travel cancelled every frame; the Kraken alone is shown as `KrakenPose` (its parts around its head, posed by its real motion code) because the fight scatters its tentacles around the rider. `Math.random` is seeded per subject so images are byte-identical between runs. CI runs it in its own `turntable` workflow, path-filtered to `src/entities/**` and death styles, outside the required `verify`.
**Consequences:** A new enemy type must be added to `src/dev/turntable/subjects.ts` (its test fails otherwise), with its `front` yaw and motion window. The turntable never gates a merge: QA reads its artifact. Bloom and the biome colour grade aren't applied (no post-processing), so emissive enemies look flatter than in play; `?biome=` / `--biome` gives the biome's sky, lights and fog.

## 2026-11-06 — Picked title + level1 themes are the default; `?theme=` stays for later rounds; the title has no layers (Sound designer, #302)

**Context:** Alex picked "Neon Marquee" for the title and kept "Midway Rush" for level1 (#301). Decision
`2026-11-02 — Theme options live beside the scores` says later listening rounds (levels 2–5) reuse the flag and folder.
**Decision:** `title.neon` replaced `title.scrim` (A minor in `SCORE_KEYS`); every option file, its `SCORE_KEYS` row
and its renders are deleted. `scores/index.ts` reads `scores/themes/*.scrim` by `import.meta.glob`, so the `?theme=`
mechanism stays with an empty folder and a new round only adds files plus their `SCORE_KEYS` rows. The title score is
not tagged with `layer=`: nothing sets an intensity on the title, so a layered title's loop would open on whatever
intensity the last run left (the player's intensity is global), often base alone. Only level scores carry layers.
**Consequences:** `?theme=<name>` does nothing until a round adds options. Tagging the title would need the player
to hold the title at full intensity first.

## 2026-11-07 — Two smoke depths: PR shards render, the nightly runs everything (builder, #372)

**Context:** every PR ran the whole smoke (~400 checks on SwiftShader, ~10 min of CI), and its game-logic checks
rode on wall-clock timing: they caused the week's flakes (#305, #250, #367).
**Decision:** the CI shards (`e2e/shards.mjs` `SHARDS`) are the PR depth: rendering and integration, the ride and combat
on every level, the level-independent ride checks (`shot`, `results`) on level1 only, the title / level select /
settings UI, quality, speed and the phone run's touch play. Everything else (`nightlyOnly()`: daily, frenzy, seed,
pause, countdown, wave, boss, pickup, scrim, share, the phone menus) runs only in the full smoke, which the nightly
production run makes; game logic among it is covered by unit tests next to its pure module (e2e/README.md table).
The full run stays the default of `node e2e/smoke.mjs`; `shards.test.ts` holds the shards and `nightlyOnly()` to it.
**Consequences:** a PR that breaks only a deep check goes green and is caught by the next nightly (`agent:prod-broken`,
P1), up to a day later; builders and QA run the deep step their diff touches by hand (`--steps`). Don't add a check to
a PR shard unless it is about what the frame shows or how the pieces connect; put new logic in a unit test.

## 2026-11-07 — Real-player telemetry is first-party: one beacon per page load to `/api/telemetry`, read back as a public 24 h summary (Builder, #373)

**Context:** Nothing told the studio how the game runs for real players (CI renders on SwiftShader; Web Analytics
counts pages and level events). Hard rule 4 allows a new runtime network call only with an entry here; the issue rules
out third-party SDKs and anything identifying.
**Decision:** The game sends at most one `navigator.sendBeacon` per page load to its own `/api/telemetry` (a Vercel
Function next to the leaderboard, same Supabase project and env vars, table `telemetry_reports`), when the page is
first hidden or closed and only if it has something to say: up to 5 deduped errors (message + first stack frame, URLs
cut to their path), WebGL context losses, and per level played its median / p95 frame time with the quality and dpr,
plus touch / desktop, `hardwareConcurrency` and the GPU renderer string. Same gate as Web Analytics (Vercel builds
only; never `?e2e=1`, `?internal=1` or the portal build). No ids or cookies; the rate limit (10 reports per IP per 10
min) keys rows by an HMAC of the IP under a salt that changes every UTC day, so rows can't be linked across days, and
rows older than 30 days are deleted. `GET /api/telemetry` serves only an aggregate of the last 24 h (CDN-cached 5
min), and the status page and the watchdog read that over HTTPS: no Supabase secret in GitHub. Errors from other
origins and extensions are dropped. A level's phone budget is the new `budgets.json` `playerFrameMs.touchP95` (33.4
ms: past two vsyncs at 60 Hz), judged on the median of phone sessions' p95 once 3 sessions played it in 24 h; an error
is filed once seen in 3 sessions.
**Consequences:** The summary is public: it shows the game's own error messages and GPU names, nothing about a
player. Errors after the beacon has gone (the tab came back) are not reported. Alex runs
`supabase/migrations/0002_telemetry.sql` once; until then the endpoint answers 503 and the status page says
telemetry is unavailable. Only the Director changes `playerFrameMs`.

## 2026-11-07 — Title poster, lazy level scene, title and startup budgets (Builder, #376)

**Context:** On a cold load the page was black until ~485 KB gz of startup JS had run and the title scene had drawn (4.4 s on a throttled phone profile; Lighthouse mobile FCP 4.2 s, LCP 6.1 s). Alex asked for no empty or black frame ever, and for the title's cost to be budgeted.
**Decision:** index.html paints a poster before any JS: the title scene's still (`public/poster/*.webp`, rendered by `npm run og` with the title camera held at 0.3 s) under a copy of the title's logo laid out like `.title-screen`, so the live logo lands exactly on it; it fades once the canvas has drawn two frames. The level scene (`LevelScene.tsx`) is its own lazy chunk, prefetched when the title is idle. New budgets: `startupJsGzipKB` 440 (398 measured, enforced by `check:bundle`) and `scene.title` (drawCalls 114 = 95 × 1.2, objects 89, triangles 11356 = measured × 1.15, enforced by the smoke's title step), set like the level entries.
**Consequences:** Anything new on the title (the riding coaster of #376's second part) must fit `scene.title` or have the Director raise it. Anything imported by the title's modules is startup JS: level-only code goes through `LevelScene.tsx`. If the title's look changes, re-render the posters (`npm run og -- --poster`) so the crossfade still matches; the poster's text mirrors `.title-screen` in global.css, so changing one means changing the other.

## 2026-11-08 — Picked level 2–5 themes are the default, with the hook in `base` (Sound designer, #392)

**Context:** Alex picked `dunerider`, `lagoon`, `aurora` and `hellgate` (#391). The options were written with the
hook on `layer=lead` (heard only from a 3× combo), which #415 rules out: level scores keep their melody in `base`,
layers only add. #415 had not merged yet.
**Decision:** each pick replaced `level2…5.scrim` with its hook voice untagged (`base`), and the voice that doubled or
answered it moved down one layer to `lead` (Dune Rider's octave-down twang, Lagoon Run's horn stabs, Aurora's bell;
Hellgate's horns were already `lead`), so 3× still adds a line. FRENZY keeps its hats (and Hellgate's choir) plus the
filter opening. The full-mix renders are unchanged by the retagging. Every option file, its `SCORE_KEYS` row and its
renders are deleted; `SCORE_KEYS` holds each pick's key.
**Consequences:** at FRENZY, Dune Rider, Lagoon Run and Aurora add only hats and the open filter. A follow-up can
write a FRENZY counter-line for them if it feels thin in play.

## 2026-11-08 — The Ocean's water: a patched Standard material over a seabed height texture (Builder, #326)

**Context:** The sea was a transparent `ShaderMaterial` with no fog and no knowledge of the ground under it, so it read as a flat teal swamp the colour of the seabed showing through it.
**Decision:** `OceanWater` is a `MeshStandardMaterial` (so it reflects the baked sky env map) patched through `onBeforeCompile`: swell ripples plus two scrolling `vnoise` normal layers, each faded by its on-screen size (`fwidth`) so nothing shimmers without MSAA; a Schlick Fresnel that raises the alpha at grazing angles; a tight sun glint capped so the sun path doesn't out-shine a target; colour by the depth of the drawn seabed, read from a 129² R8 `DataTexture` of the terrain grid's vertex heights (`waterSurface.ts`), so shallows go turquoise with a foam lace at the shore and deep water goes blue. The plane reaches past the camera's far plane (even 75-unit cells over the terrain, ten growing cells each side beyond: +7 200 triangles) and caps its own fog at 0.6, so a darker sea meets the sky in a horizon line. The scene fog stays `sky.horizon` (fogging every far island to a bluer colour than the dome would open a seam).
**Consequences:** Still one draw call. Anything floating on the sea must keep using `WATER_WAVE_GLSL` with `clock.elapsedTime`. The depth colours assume the seabed sits within `SEABED_MIN_Y`..`SEABED_MAX_Y` (-60..20); a deeper biome would read as uniformly deep.

## 2026-11-08 — One audio engine: the score engine + arcade SFX; Tone.js removed (Sound designer, #416)

**Context:** Alex, 2026-11-07: once the melody fix (#415) and the level 2–5 themes (#392) were in, the score engine
becomes the only engine, "no need for fallback ?audio=tone. this can be fully removed". The score engine and the
arcade SFX already drew everything in plain Web Audio; Tone.js was left supplying only the context, the master
chain and the offline renders.

**Decision:**
- No `?audio=` flag: every visitor gets the score engine and the arcade SFX. `tone` is out of `package.json`; the
  context and master chain are plain Web Audio in `src/audio/AudioEngine.ts` (main chunk, tiny), and both engines
  stay lazy chunks loaded after the first gesture. `?theme=` stays for listening rounds.
- Offline renders (`npm run audio:render`) use an OfflineAudioContext on a scripted clock (`offlineRender.ts`).
  `--engine scrim` is gone; `--engine port|original` stays for `--score` parity renders. Renders lose the
  `scrim-` prefix.
- Every game stereo panner is an `upmixPanner` (`channelCountMode: 'explicit'`: a mono voice is copied to both
  channels before panning, no 3 dB centre dip). Every score and SFX level was mixed and measured on renders
  through Tone's offline context, i.e. standardized-audio-context, whose StereoPannerNode is always 'explicit'.
  On the spec's 'clamped-max' the SFX came out 3 dB quieter, kills under the 6 dB-over-music target, and the
  scores 0.7 LU quieter and narrower. With it, the re-renders match the old ones within 0.1 LU. The jukebox
  voicing (parity with the original page) keeps the spec's panner.
- Parameter ramps that start mid-ramp use `cancelAndHoldAtTime` (`AudioEngine.rampParam`): an offline context's
  `AudioParam.value` is still the start value, so reading it there jumped the slow-mo duck open with a click.
- Budgets lowered to lock in Tone's size: `jsTotalGzipKB` 700 → 630, `startupJsGzipKB` 440 → 435.

**Consequences:** One engine to maintain and measure; renders hear exactly what players hear. Switching a panner
back to the spec's mode changes the whole mix by 3 dB: don't, without re-measuring every level's `--mix`. The
`baseline-*` renders (the Tone.js sound) can no longer be re-rendered and stay as a record.

## 2026-11-08 — The title's coaster, beat-locked cuts and attract mode (Builder, #419)

**Context:** #376 part 2 asked for a coaster riding the title park inside budgets.json `scene.title` (114 draw calls, 89 objects, 11 356 triangles, ~1 500 triangles free), camera cuts and the logo on the music's beats, and an attract mode.
**Decision:** The coaster reuses the game's rails (`buildTrackGeometry`, 90 rings, ties 22 apart) on a light loop of sine hills outside the tent ring, with single steel columns instead of lattice towers and a four-car train: three draw calls, ~4 900 triangles. The room came from cheaper string-light bulbs and balloons (same look at title distances). The Ferris wheel moved 30 units in x and 15 in z so the track passes under its gondolas and outside its legs (`titleCoaster.test.ts`); the flag poles moved inside the loop. Camera cuts land on bar lines by running the camera's clock up to ±10% fast or slow (`beatLockedRate`), never by jumping it, so a cut still blends. Attract mode is a camera sequence and a CSS state on the same title scene (no level load); under `?e2e=1` it never starts unless a test sets `titleAttractIdleMs`.
**Consequences:** The title scene now sits at ~11 200 of its 11 356 triangles: anything more on the title needs triangles found elsewhere or a Director raise. The title clips are 9 s because a 1280×720 title frame takes ~0.8 s under SwiftShader and a builder's command stays under 4.5 min.

## 2026-11-09 — Bosses: retracted weak points and thrown projectiles (Builder, #319)

**Context:** The Yeti (Antarctica's finale) exposes its chest only while it roars, and throws snowballs the player
can shoot. The boss framework (2026-10-29) had phases but no way to hide a live weak point, and no notion of
anything a boss throws.

**Decision:**
- `BossState.retracted` (a set of weak point ids) hides a weak point without changing its phase: `exposedWeakPoints`
  filters it out, `applyHit` ignores it, `setRetracted` returns the same state when nothing changes. A boss toggles it
  from `move` through `BossFrame.retract(id, on)`, which re-syncs the collision targets at once, like a hit does.
  The Yeti keeps its chest un-retracted during phase 0 (its phase hides it anyway), so the hit that breaks the last fist
  exposes the chest in the same JS turn, and the next frame starts a roar at once (`roarNowEpoch`).
- Projectiles are not weak points: they never move `hpFraction` or the boss bar. Each is its own collision target with
  an id prefixed `boss-projectile:` (not `boss:`, so e2e `bossHit` skips them and they are shot like enemies), and a
  hit is a normal kill (`registerKill` + `addScore`, explosion, `enemy:killed`). They are bonus kills, so the level's
  `maxScore` (and stars) leave them out, but `BossSpec.projectiles` (`score`, `max`) adds them to the leaderboard's
  server limits (`scoreLimits.ts`), and the boss never throws more than `max` in a fight.
- A snowball homes on a point beside the camera as it moves (its arc is laid between its release point and that point
  each frame), so it always passes the rider instead of landing where the camera was.

**Consequences:** A boss that hides a part (a shell, a dive) or throws things reuses these two pieces. Raising a
projectile's score or `max` changes `api/_lib/levelLimits.ts` (`node scripts/gen-level-limits.mjs`).

## 2026-11-09 — Smoke shard time budgets scale with the runner's measured speed (Builder, #394)

**Context:** `smoke (level5)` failed `verify` on its `smokeSeconds` budget alone (4.2 vs 4.0 min, every check passing) on
a slow CI runner. Over ~35 CI runs per level shard (7-9 Nov) the same commit's shard took 1.0 min on one runner and
1.9 min on another (level3 up to 2.8 of 3.0), and the time follows the ride's wall ms per rendered frame: ~265-320 on
normal runners, ~440-545 on slow ones. A fixed budget either fails passing PRs on slow runners or is too loose to
catch a real slowdown on a normal one.

**Decision:** The smoke judges a shard's time in pure `e2e/shardTime.mjs`: the budget is multiplied by the ride's ms per
frame over a normal runner's 300 (`NORMAL_RUNNER_MS_PER_FRAME`), clamped to 1..2 (`MAX_RUNNER_SLOWNESS`). Over the
budget but within that allowance passes with a warning annotation; past it, or over budget on a normal-speed runner,
fails as before. Shards with no ride (ui, menus, mobile, level1-steps) keep their plain budget. The watchdog that
stops a stuck shard moved from 2x to 2.5x the budget so it never cuts off a run a slow runner is allowed to finish.
`budgets.json` is unchanged.

**Consequences:** The reference ms per frame and the cap loosen every level shard's budget when changed, so they are
the Director's, like the budgets. A PR that makes the ride render slower on SwiftShader also earns up to 2x time; CI
frame times swing ~2x between runners anyway, so the time budget never could catch that, and real-device frame time
is watched by player telemetry (`playerFrameMs`). Steps, waits and load time a PR adds still fail on a normal runner.

## 2026-11-09 — Week 4: Alex's bar before the player posts; the Climbing Gym is Level 6 through a world kit; M2 closed (Director)

**Context:** Week 3 landed 50 PRs: the Scorpion and the Yeti, the Ocean's water, the title coaster, the online board, the score card, Alex's picked themes on one engine. Alex then played every level (#439, 8 Nov) and set a bar of his own: runs of 60 s, no stretches with nothing to shoot (the Desert), a title world that looks big, and after that many more worlds made procedurally, the first a massive climbing gym. Nothing was posted in week 3 (the Showcase draft #102 waits on him); the Marketer's strategy v1.4 holds the player posts (#308) to that bar and keeps the dev post (#102) unblocked. M2's exit criteria are all on `main` (the leaderboard #346, the smoke green on `main` since #305 / #364).

**Decision:**
- **M2 closed** (milestone 1, one day over); its two flake bundles moved to M3. The epics #176 / #177 closed.
- **M3's exit criteria rewritten** (VISION.md): every level ends on a boss (the Titan #320 remains), every run is 60 s on one pacing template (#452), no level has a no-target gap over 3 s with a smoke metric and budget guarding it (#450, #451), the title park fills the frame (#454, #459), **Level 6 is the Climbing Gym** built through the world kit (#453 → #457, theme round #456), the enemy-art briefs exist and the three worst enemies are upgraded (#462, #463), lint runs in CI (#455, #461). Due date unchanged (5 Dec).
- **Neon Metropolis is deferred** (#322–#325 leave M3 and the ready queue): Alex's ask is a system that makes worlds, not the next hand-built one, and the world he wants first is the gym. The city comes back as a kit-built world (M4 candidate). `docs/LEVEL-KIT.md` is the design doc for #437: landmarks, bosses, the look and music stay hand-authored; pacing, placement, the biome scaffold and every registration are templated or generated.
- **Leaderboards under the 60 s rules** (#458): filter, don't wipe. Old long-run scores above a level's new limit drop off both boards on load / GET; comparable ones stay; Alex may truncate later. No database action needed for the switch.
- **`scene.title` raised** to 140 draw calls / 130 objects / 60 000 triangles (was 114 / 89 / 11 356) so #454 / #459 can fill the title world with instanced rides, crowds and silhouettes; the first-paint rules of #376 (poster, lazy level chunk, `startupJsGzipKB`) are untouched and the phone must still hold 30 fps on the title.
- **Queue:** 28 `agent:ready` issues (6 P1, 9 P2, 13 P3) plus 6 blocked with named unblockers (`Waiting on #n`, the Maintainer swaps them to ready), against ~29 expected completions. 16 P3 refactor / follow-up issues that touch the code the P1 work changes are parked without `agent:ready` until 16 Nov; #414 folded into #432; #338 re-scoped (no `?audio=scrim`); #328 to P3.
- STEERING.md's sound item is ticked: the engine is ported, Tone.js is gone (#431), every level and the title play Alex's picked themes (#386, #421). The sound epic #212 stays open for boss / results variations and acoustics.

**Consequences:** This week's builders' work is spread over `LevelRegistry.ts`, `spawnPlacement.ts`, the smoke and `TitleScene.tsx`, so conflicts between #451 / #452 and between #454 / #459 are expected: the title pair and the gym chain are serialised with `Waiting on`; #451 and #452 are not, and whichever lands second merges `origin/main`. If the Showcase post goes out this week, next Monday's Director reads its funnel before anything else and may put the phone title → PLAY → ride path at P1.

## 2026-11-09 — Pacing is measured on a fixed 0.5 s step, by targets inside the viewport (Builder, #450)

**Context:** Alex's playtest (#435, #439): some levels have stretches with nothing to shoot. The smoke's new nightly `pacing` step rides each level's whole run and fails a level over its `budgets.json` `pacing` ceilings.
**Decision:** The run advances a fixed `timerStep` of 0.5 level seconds a frame (`rideRate` 1), not the `timerStepMax` cap the other level steps use: a cap gives a different run on a faster runner, and between two capped local runs level2's longest gap moved from 4 s to 2 s. 0.5 s instead of 0.25 keeps the five runs (~800 frames) inside the nightly's 60-minute cap. "Nothing to shoot" is `stats().onScreenEnemies == 0`: any live target inside the viewport, however far away or small. The first 2 s after GO and the boss tell count neither way and end a gap. The ceilings are today's measured numbers plus headroom (enemy motion isn't seeded, so counts move a little between runs); the Director lowers them, to 3 s once the wave placement fix lands.
**Consequences:** Gaps are resolved to half a second. A level can pass while its targets are specks on the horizon: if the Director wants "readable" targets only, that is a change to what counts, made in one place (the sample in `pacingCheck`).

## 2026-11-09 — Waves are placed for the view the rider will have, spread over the wave's window (Builder, #451)

**Context:** The `pacing` step (#450) showed 8 s stretches with nothing on screen in Antarctica and Inferno (25% and 14% of the run): every group of a formation and every trackside slot sat within ~2 km ahead of the rider at activation, so on the bigger tracks the rider rode past a whole wave long before the next one. Formation anchors were also checked against the rider's heading at activation, which on a turn is not where the camera looks once the group has flown in.

**Decision:** Placement predicts the ride. Pure `track/ridePhysics.ts` holds the coaster's speed rule (`CoasterCamera` rides it) and `rideProfile` rides it from GO over the level time; `EnemySpawner` hands each wave a `RideAhead`: the arc the rider covers during the entry (1.8 s) and over its window (until the next wave, the boss or the end). A formation group's centre must be inside the rig's look direction (`cameraRig` look-ahead, 0.8 × half of `MIN_HORIZONTAL_FOV`) from where the rider is once it has flown in, else the other side, else straight ahead of that view; groups are `max(groupGap, window / groups)` apart. Ground trackside slots are stratified over the band and the band is stretched over the window (never under 700–2200, never past 3/4 of a lap), each on the side of the track in view on its approach. Water trackside bands and world-scatter waves are unchanged.

**Consequences:** Pacing (seed 1337): Antarctica 25% / 8 s → 4% / 2 s, Inferno 14% / 8 s → 3% / 3 s, Desert 4% / 2 s → 0% locally; Antarctica's and Inferno's `pacing` budgets ratchet down (Desert's stays: the nightly on CI measured an 8 s gap in its untouched scatter opening, so local and CI runs disagree). A change to the coaster's speed rule changes placement too (that is the point: keep it in `ridePhysics.ts`). Theme Park's first two waves are world scatter and keep their gaps.

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

## 2026-11-10 — The Climber: a `wall` surface, the escape rule, the chalk puff (Builder, #453)

**Context:** The Climbing Gym (#438) needs enemies that climb walls, a fourth placement surface beside air, ground and water.

**Decision:**
- **Wall surface.** A level lists its climbable walls as `LevelConfig.walls` (`WallSurface`: id, `origin` = bottom-left
  corner, unit `right` and `up`, `width`, `height`; the face points along `right × up`, towards the ride). `ENEMY_PLACEMENT`
  gives wall enemies `surface: 'wall', scatter: 'wall'`: the spawner starts each at the foot of a seeded wall
  (`wallSlots`, the run's rng), `WALL_STANDOFF` off its face, never pushed out of the near field and never flown in. A
  level with wall enemies and no walls, or a wall wave with a formation, throws.
- **Escape rule.** A climber that tops out escapes: it despawns unscored, with no penalty. `maxScore` still counts it, so
  letting one go costs only its points. `EnemyBase` supports this generally: `updatePosition` returning `'escaped'`
  unmounts the enemy through `onEscape`; the spawner takes it off the remaining count without the last-kill slow-mo.
- **Chalk puff.** Its death style is pale motes that drift slowly down plus a few helmet / harness flecks, no lit chunks
  and no flash; its kill sound is the new `KillSound` `'chalk'` (a dry pop, then a dust hiss). Nothing falls off the wall:
  the brief is friendly, no falls and no ragdoll.

**Consequences:** A gym level only adds walls and climber waves. The climb's pace (~1 m/s, `climbMotion.ts` `METRE` = 33
units) and the wall's height set how long a climber stays shootable: a level tunes its walls' heights, not the motion.
