# State of the game

_Rewritten by the Director on 2026-10-26 (second Director run, `main` @ 51a5165). The
Director rewrites this weekly; the Maintainer edits it when fixing things._

## Summary

Week 1 turned the prototype into a game: 64 PRs merged, M1 ("looks and feels like a
game") is complete and closed. Every level has its own sky, grade and baked environment
map, lattice towers, a first-person gun with flash/tracer/hitmarker, a camera that banks
and looks ahead, a real HUD, a star-reveal results screen, a postcard level select, a
fly-by title and touch play with aim assist. scoaster.com is live with analytics; the
first public post is planned for Mon 2 Nov (three.js Showcase, #102), gated on a
gameplay clip (#100).

What the game still is **not**: a run has no shape. Waves are random scatters that
exist from t=0, nothing arrives, nothing threatens, every enemy dies the same way, and
each level ends when a timer hits zero. Combos are a flat multiplier on wall-clock time.
That is M2's job (see VISION.md). Three things look wrong in this week's screenshots and
go first: **Antarctica's enemies are invisible** in the ride (0 of 4 on-screen enemies
readable, largest 9 px) and its trees are black silhouettes; **levels 4 and 5 show a
near-vertical rail climbing into the sky** (the `TrigCurve2` loop does not close);
**Inferno is a black triangle on dark red** with 15 px enemies. The headless smoke still
flakes on 2-core sessions (every level failed only the frame-count check this run, all
functional checks passed), which costs every Maintainer, Reporter and Director run
confidence and tokens.

## What exists

### Levels (`src/levels/LevelRegistry.ts`)

| Level | Biome | Timer | Enemies (waves) | Landmarks / features | Director's read of this week's screenshots |
|---|---|---|---|---|---|
| 1 Theme Park | themePark | 75 s | 150 balloons (3 waves) + 3 golden | Ferris wheel, carousel, midway stalls, string lights, paths, bunting, entrance arch | Good: bright, busy, balloons readable; the track passes the wheel. Best first impression we have; the clip level |
| 2 Desert | desert | 60 s | 30 scorpions, 50 crows | Pyramid, rock arches, mesas, cacti, dust devils, occluded sun flare, sand-ripple material | Good mood; crows chunky and readable up close. **268 draw calls** (budget 250): crows aren't batched (#92). Far track reads as hairlines |
| 3 Ocean | ocean | 65 s | 20 jellyfish, 25 sharks, 30 flying fish | Sunken city, sea stacks, breaching rocks, foam rings, seabirds, coral reef, archipelago terrain | Pleasant; coral and stacks sell it. Shallows read as khaki ground more than water; the mid-ground water lacks reflection/specular. Sharks read as grey blobs head-on |
| 4 Antarctica | arctic | 75 s | 25 scouts, 20 snowmen, 8 brutes | Ice fortress, mountains, aurora band, ice crystals, snow drifts | Sky and aurora are the best frame in the game, but **no enemy is visible** in the ride or combat shot, trees are flat black umbrellas (#62 not fixed), the fortress isn't in view, and the open track loop stands as a vertical rail in the sky |
| 5 Inferno | volcanic | 120 s | 75 wisps, 25 imps, 25 golems, 6 drakes; 2 eruption waves | Volcano, lava rivers (shader), ash/ember particle field, smoke column, terrain lava glow, eruption shake + fog pulse | **Too dark to read**: the volcano is a black triangle, lava rivers barely show, track is a dark line, enemies are orange dots (2 of 7 readable). A vertical dotted yellow streak sits beside the track in every shot. Same open-loop rail as level 4 |

Common: title (fly-by park, any key / PLAY, fade + whoosh) → level select (postcards,
stars, `★ x / 15`, keyboard nav; level N needs 1★ on N-1) → Ready/Set/GO (shader
warm-up behind it) → play → results (score count-up, star pops + chime, threshold bar,
kills / accuracy / best combo / time left, NEW RECORD; Enter = next, R = replay).

### Systems

- **Track** (`src/track/`): `TrigCurve` / `TrigCurve2`, extruded rails + ties scaled by
  `trackDimensions`, lattice support towers on the drawn terrain, arc table, coaster
  camera (`cameraRig.ts` rotation-only bank / look-ahead / pitch, `cameraFov.ts` portrait
  FOV + speed/drop kicks, `WindStreaks`). **`TrigCurve2` is not a closed loop** (bug 1).
- **Environment** (`src/levels/environments/`): per-biome modules behind
  `biomeRegistry.ts`; shared terrain / water / trees (wind sway) / atmosphere (sky dome,
  per-biome light, fog, `envIntensity`, colour `grade`) / scatter / `trackClearance` /
  `paintedParts` / `ringedRock` / `ParticleField` (volcanic preset only) /
  `ContactShadows` (one merged mesh per level). Sky baked into `scene.environment` once per
  level (PMREM). Post: one EffectPass (Bloom + colour grade + ACES).
- **Enemies** (`src/entities/enemies/`): 13 types + golden balloon, one React component
  + `useFrame` each over `EnemyBase` (sphere target, one hit = kill, hit flash, kill pop,
  explosion). Shared geometries/materials in `SharedEnemyAssets.ts` (how `ShaderWarmup`
  finds them). Spawner: time-based waves, seeded polar scatter kept within readable range
  of the track; all of a wave appears at once. No HP, no weak points, no formations, no
  bosses, nothing that attacks the player.
- **Combat** (`src/combat/`): Pointer Events aim (mouse/touch/pen), touch aim assist,
  hold to auto-fire, time-based swept bullets on the camera ray drawn from the muzzle
  (screen-size capped), `processHit` (accuracy), first-person weapon view-model (recoil,
  barrel flash, tracer), rotation-only trauma, hitmarker, score popups, combo
  (+0.25×/kill to 4×, **2 s `performance.now()` window**), slow-mo via `timeScale`
  (**not reset by `startRun`**, #108).
- **UI** (`src/ui/`): HUD (score tween, enemy bar, timer bar, combo meter, wave banner,
  countdown), title, level select, results, pause (bare overlay: Esc / tab hide / blur),
  settings (show FPS, screen shake), mute. framer-motion. Google Fonts at runtime.
- **Audio** (`src/audio/`): Tone.js; `sfxChannel` / `musicChannel` → master limiter;
  per-level pre-built SFX kit (fire variants, hit tick, kill layers by combo, wave
  stingers), music + title music on one never-stopped Transport with 1 s crossfades via
  `musicBus`; every trigger through `nextTriggerTime`, every play guarded by
  `soundGuard`. Slow-mo ducks the music bus. No positional audio.
- **State** (`src/store/`): `useGameStore` (phase, `startRun`, run counters, combo, timer,
  persisted `savedScores` with `bestCombo`), `usePlayerStore` (barely used),
  `useSettingsStore` (persisted).
- **Analytics**: Vercel Web Analytics page views + `level_start` / `level_complete` /
  `level_quit`; off for `?e2e=1`, CI, smokes and `?internal=1`. UTM dimensions are
  paywalled on Pro → `/go/<campaign>` landing paths (#171 pins them).
- **API** (`api/`): in-memory stubs, unused by the client.
- **Legacy v1** (`js/`, `index.legacy.html`, `assets/`): not built, don't extend.

### Tooling

- CI `verify` on PRs: vitest (36 test files) + `tsc -b` + vite build + bundle budget +
  headless smoke (title, level select, every level: ride / enemy close-up / combat /
  shot / results, seed check, hidden-pause, countdown + warm-up, speed, phone portrait +
  landscape with touch kills and audio stress). Auto-merge on `agent:qa-approved`.
- Nightly + post-deploy production smoke → `agent:prod-broken`.
- `?e2e=1` → `window.__SC_TEST__` (see CLAUDE.md for the full surface).
- Studio: pause switch, runbooks per task, decisions inbox folded nightly, live status
  issue, token ledger per run, two independent reviewers on PRs ≥ ~300 lines.

## Numbers (2026-10-26, `npm run verify` on main @ 51a5165, 2-core SwiftShader)

| Scene | Draw calls | Triangles (frame) | Scene objs / tris (camera-independent) | Enemies on screen / readable / largest px | avg frame ms (software GL — relative only) |
|---|---|---|---|---|---|
| level1 | 94 | 168,755 | 163 / 186,742 | 11 / 11 / 35 | 2529 |
| level2 | **268** | 187,378 | 1,191 / 208,213 | 6 / 5 / 16 | 2056 |
| level3 | 73 | 155,145 | 180 / 158,828 | 2 / 2 / 26 | 2108 |
| level4 | 176 | 182,389 | 487 / 210,766 | **4 / 0 / 9** | 2414 |
| level5 | 109 | 131,589 | 289 / 137,544 | 7 / **2** / 15 | 2132 |

Track alone: ~81–86k triangles per level (10 objects). Env bake 1.6–2.0 s per level
(software). Shader warm-up 2.3 s, 41 programs, first shot compiles nothing new.
W42 → W43 trend (draw calls / triangles): L1 213 → 94 / 145k → 169k, L2 294 → 268 /
166k → 187k, L3 107 → 73 / 152k → 155k, L4 182 → 176 / 141k → 182k, L5 134 → 109 /
125k → 132k.

Bundle: 498 KB gz total (three 172, r3f 114, app 211) — budget 700 / 260. One app chunk;
no code splitting; Tone.js (~64 KB gz) loads up front.

Players (W43, `docs/marketing/metrics/2026-W43.md`): 31 visitors, all direct, mostly
Alex's circle; 18 starts → 8 completes (44%) from 4 desktop players; levels 1–3 played,
nobody reached 5; **0 of 9 mobile visitors started a level** (too few to conclude).

## Known bugs and visual problems (ranked)

1. **`TrigCurve2` (levels 4, 5) is not a closed loop.** The `(angle / 2)` altitude ramp
   leaves the end π·varC·scalar above the start (≈ 440 units on level 4, ≈ 628 on
   level 5); the seam renders as a near-vertical rail into the sky, visible top-centre of
   both ride screenshots. `src/track/curves/TrigCurve.test.ts` pins the current shape.
   Filed this week.
2. **Antarctica enemies unreadable**: snowmen spawn on the ground far below a track that
   runs over mountain tops; 0 of 4 readable, largest 9 px (W43 report saw the same).
   Filed this week.
3. **Inferno too dark**: volcano silhouette black on black, lava rivers and track barely
   lit, enemies 15 px dots; a vertical dotted yellow streak beside the track in every
   shot (a particle or lava column needs a look). Filed this week.
4. Arctic / theme park tree canopies render as flat black silhouettes (#62; #149's fix
   covered the wind-sway canopies, the dark umbrellas remain in `level4.png`).
5. Desert draw calls 268 > 250 budget (crows unbatched, #92; scene has 1,191 objects).
6. `startRun` does not reset `timeScale`: slow-mo can stick at 0.1 into the next run (#108).
7. Combo window uses `performance.now()`, so pause and slow-mo affect it (fixed by combo
   tiers, #34).
8. Pausing restarts wave timers from zero (#152) and does not freeze the ride (#133):
   both folded into the pause-menu issue #36.
9. Music crossfade can leave a gap when the new track waits for the next bar (#168).
10. Smoke "render loop stalled" flakes on 2-core sessions: every level failed only the
    frame-count check in this run (6–9 frames per 10 s window vs `MIN_FRAMES=10`) while
    every functional check passed; same for the Reporter's run and two Maintainer runs.
    CI's runner passes. Polling level checks to a frame-count deadline (as the title check
    does) is the fix (#50, now P1).
11. CI `verify` never runs on `main`: the auto-merge workflow merges with `GITHUB_TOKEN`,
    whose pushes don't trigger `ci.yml`'s `push: main`. PR `verify` (run on the PR merged
    with `main`) and the post-deploy production smoke cover `main`. Fix: have
    `automerge.yml` dispatch `ci.yml` after a merge (`workflow_dispatch`, `actions: write`).
    Filed this week.
12. Results screen offers NEXT LEVEL after a 0★ run even though the next level needs 1★
    (`previousLevel()` rule, #162).
13. Ocean water reads as khaki shallows rather than water in the mid-ground; the sharks
    read as grey blobs head-on. Not filed; candidate for a polish pass after M2's core.
14. Distant rails and lattice thin to hairlines / shimmer beyond ~400 units on every
    level (most visible on Desert and Antarctica). Filed this week (minimum on-screen
    rail thickness).

## Tech debt / architecture notes

- One React component + `useFrame` per enemy (up to 150 live). Fine today; the boss
  framework should not copy it (one component with its own parts/weak points is fine, but
  shared HP / weak-point logic lives in a pure module). A pooled/instanced enemy system is
  the M3 path if counts grow.
- `EnemySpawner.tsx` (449 lines) mixes spawn-position rules per type, wave timing and
  rendering. Choreography (#30) should pull formation/placement into a pure, unit-tested
  module.
- Phase inference per system ("a new run started" guessed from phase edges) instead of a
  `runId` from `startRun` (#142); dead store actions (#106).
- `SharedEnemyAssets.ts` is 809 lines of geometry + material constants; acceptable while
  it is the warm-up's source of truth.
- Audio: Tone.js synths per kit; polyphony limited per node; no voice budget. The
  slop-newyork baked-buffer approach (VISION backlog 14) is the planned replacement, after
  launch, with a decisions entry.
- Runtime third-party call: Google Fonts CSS (DECISIONS). Tone.js in the main chunk.
- `docs/HEAP-BOTTLENECKS.md` findings (source maps in prod, Tone graph size) not acted on
  (folded into the lazy-Tone issue this week).
- Alex's `abelyeu.*` branches are fully merged; `gh-pages` / `master` are legacy.

## Half-done / placeholders

- `api/` serverless stubs (leaderboard, daily, ghost) — in-memory, not wired to UI.
- `usePlayerStore` exists but gameplay barely uses it.
- Settings screen: show FPS + screen shake only.
- `ParticleField` has one preset (volcanic); the other biomes have no ambient particles (#37).
- Pause screen is unstyled and does not freeze the ride (#36).
