# State of the game

_Rewritten by the Director on 2026-10-19 (first Director run). The Director rewrites
this weekly; the Maintainer edits it when fixing things._

## Summary

Playable, deployed, stable: 5 levels, all pass the smoke test, no open issues or PRs
before this week's queue. The game **works** but does not yet **look or feel**
finished: skies are the same washed-out drei `Sky` on every level (Inferno has a
blue daytime sky), the track reads as thin wire with hexagonal stick supports,
enemies are often unreadable at spawn distance, several levels have long empty
stretches, there is no touch input, and shooting has little feedback beyond an
explosion. Those are this week's targets (see VISION.md M1).

## What exists

### Levels (`src/levels/LevelRegistry.ts`)

| Level | Biome | Timer | Enemies (waves) | Landmarks / features | Director's read of the screenshot |
|---|---|---|---|---|---|
| 1 Theme Park | themePark | 75 s | 150 balloons (3 waves) + 3 golden | Ferris wheel, carousel, tents, trees, lamp posts | Pleasant; flat green plain, balloons tiny from the track; track = yellow wire into the distance |
| 2 Desert | desert | 60 s | 30 scorpions, 50 crows | Pyramid, rock arches, cacti, rocks | Sky blown out to white; scorpions read OK; HUD sits on the sun glare |
| 3 Ocean | ocean | 65 s | 20 jellyfish, 25 sharks, 30 flying fish | Sunken city, water shader, seafloor | Flat teal plane, dark blobs on the floor; jellyfish nice; little mid-ground |
| 4 Antarctica | arctic | 75 s | 25 scouts, 20 snowmen, 8 brutes | Ice fortress, mountains | Mostly empty pale sky; snowmen render as **black blobs** on snow; track grey on grey |
| 5 Inferno | volcanic | 120 s | 75 wisps, 25 imps, 25 golems, 6 drakes; 2 eruption waves | Volcano, lava rivers (shader), eruption shake + fog pulse | Strong terrain/lava, but **bright blue daytime sky** over a hellscape; a yellow particle streak near the track |

Common: title screen (3D park scene + Lobster title) → level select (cards, star
gating: level N needs 1 star on N-1) → 3-2-1 countdown → play → results (stars by
score %; replay / next).

### Systems

- **Track** (`src/track/`): trig-curve tracks (`TrigCurve`, `TrigCurve2`), extruded
  rails + ties (`TrackMesh.tsx`, port of mrdoob's RollerCoaster), camera rides the
  curve with velocity from slope (`CoasterCamera.tsx`), FOV kick, wind whoosh.
  Pillars are `CylinderGeometry(…,1,6)` scaled in Y — the exact "hexagonal stick"
  anti-pattern the level-design skill forbids.
- **Environment** (`src/levels/environments/`): `BiomeEnvironment.tsx` (1025 lines,
  all five biomes: settings, colour ramps, terrain mesh, water shader, lava rivers,
  eruption handling, trees, landmarks), `BiomeDecorations.tsx` (1008 lines, instanced
  decorations per biome), landmark components, `LavaShader.ts`, `terrainNoise.ts`
  (simplex, per-biome configs, track-following flattening).
  Sky = drei `<Sky>` with a sun position per biome; fog per biome; one directional +
  one ambient light. Renderer tone mapping is `NoToneMapping`; ACES is applied in
  the `EffectComposer` (bloom, vignette, ACES).
- **Enemies** (`src/entities/enemies/`): 13 types + golden balloon, each a React
  component wrapping `EnemyBase` (own `useFrame`, registers a sphere target with
  `CollisionManager`). Shared geometries/materials in `SharedEnemyAssets.ts`
  (MeshPhong). Spawner (`EnemySpawner.tsx`) is time-based waves with random polar
  scatter (not seeded), score values and radii tables.
- **Combat** (`src/combat/`): mouse-only aim (NDC ray from cursor), click / hold to
  auto-fire every 60 ms, instanced bullet pool (350, speed 14, 5 s life), sphere
  collision, pooled particle explosions, HTML score popups, combo (2 s window,
  +0.25× per kill, max 4×), slow-mo via `timeScale`.
- **UI** (`src/ui/`): HUD (score / enemies / timer / combo text), wave announcement,
  countdown, pause (Esc), results, level select, settings (show FPS), mute button.
  framer-motion transitions. CSS in `src/app/global.css` (Lobster + Inter from
  Google Fonts at runtime).
- **Audio** (`src/audio/`): Tone.js engine, per-biome generative music with
  intensity layers, title music, SFX (fire, explosion by combo, wind).
- **State** (`src/store/`): zustand `useGameStore` (phase, score, combo, timer,
  persisted best scores), `usePlayerStore`, `useSettingsStore` (persisted).
- **API** (`api/`): leaderboard, daily seed, ghost — in-memory placeholders, unused
  by the client in any meaningful way.
- **Legacy v1** (`js/`, `index.legacy.html`, `assets/`): not built, don't extend.

### Tooling

- CI (`verify`): `tsc -b` + vite build, bundle budget, headless smoke of title + every
  level (10 s each), screenshots uploaded as artifacts. Auto-merge on
  `agent:qa-approved` + green `verify`.
- Nightly + post-deploy production smoke → `agent:prod-broken` issue on failure.
- Test hook `?e2e=1` → `window.__SC_TEST__` (`levels`, `startLevel`, `frames`,
  `drawCalls`, `triangles`, `avgFrameMs`, `errors`, plus `autoFire`, `killNearest`,
  `stats`, `endLevel`, `setTimeScale` since #44). Smoke saves `<level>-combat.png` and
  `<level>-results.png` and fails a level on zero kills.
- No unit tests. Leva + drei `Stats` behind the "show FPS" setting.

## Numbers (2026-10-19, `npm run verify` on main @ 247c69a, headless SwiftShader)

| Scene | Draw calls | Triangles | avg frame ms (software GL — relative only) |
|---|---|---|---|
| level1 | 196 | 141,829 | 387 |
| level2 | 198 | 163,931 | 274 |
| level3 | 84 | 151,079 | 424 |
| level4 | 150 | 138,847 | 385 |
| level5 | 92 | 124,185 | 600 |

Bundle: 509 KB gz total (three 172, r3f 121, app 215) — budget 700 / 260. One app
chunk; no code splitting.

## Known bugs and visual problems (ranked)

1. Inferno sky is daytime blue (BIOME_SETTINGS gives every biome the same drei Sky
   model; only the sun position changes). Desert and Antarctica are over-exposed.
2. Track supports are scaled hexagonal sticks; rails read as thin wires beyond
   ~300 units; rail thickness does not scale with `track.scalar` (Desert = 60 vs
   Theme Park = 20, so the Desert track is relatively 3× thinner).
3. Level 4 snowmen render near-black against snow (material/lighting), brutes too.
4. Long empty stretches: Theme Park plain, Ocean surface, Antarctica mid-ground.
5. No touch / pointer input: unplayable on phones. HUD not laid out for small screens.
6. Shooting feedback is thin: no muzzle flash, no hitmarker, no enemy hit flash, no
   screen kick; every enemy dies the same way.
7. HUD is plain text; results and level-select screens are unstyled compared to the
   title screen.
8. Bullet colour/size are special-cased by `levelId === 'level4'` in `SceneManager`
   (should be config).
9. Combo timing uses `performance.now()`, so pausing or slow-mo affects the window.
10. `LevelConfig.environment.skybox` / `groundColor` are legacy fields, unused or
    nearly so.
11. Bullets are frame-rate dependent: `BulletPool` moves each bullet a fixed
    `BULLET_SPEED` (14 units) **per frame** but expires it after 5 s of wall-clock time.
    Bullet speed and range therefore scale with refresh rate (slower on 30 Hz, 2.4× faster
    on 144 Hz). At headless ~1 fps they travel ~70 units and never hit anything, which
    is why the smoke autofire gets 0 kills. Fix: scale by `delta` (Maintainer, 2026-10-19).
12. Level 4 explosions render as large dark blobs instead of orange (seen in the
    PR #44 combat screenshots; likely the same material/lighting issue as known bug 3 above).
13. Smoke ride checks pass by a thin margin in Claude cloud sessions (11–15 frames per
    10 s window vs `MIN_FRAMES=10`, 2-core SwiftShader). The title check polls to a
    deadline since #43; the level checks still use a fixed window and do flake
    (9 frames seen). Tracked in #50.
14. Level 4 and 5 tracks (`TrigCurve2`) are not closed loops. The `(angle / 2)` altitude
    ramp makes the end π·varC·scalar higher than the start (≈440 units on level4, ≈628 on
    level5), and `useTrackProgress` wraps a full lap back to t=0, so the camera
    would fall by that height. It shows as the near-vertical track sections in those
    screenshots. PR #46 (open) adds a unit test that pins the current behaviour
    (found 2026-10-19).

## Tech debt / architecture notes

- `BiomeEnvironment.tsx` and `BiomeDecorations.tsx` are 1000-line multi-biome
  switchboards; every level task touches them → merge conflicts between parallel
  builders. Split per biome (queued this week).
- One React component + `useFrame` per enemy (up to 150 live) — fine today; a
  pooled/instanced enemy system is the M2–M3 path if enemy counts grow.
- Spawner uses `Math.random` → not reproducible (blocks daily runs, ghosts, and
  deterministic screenshots).
- Runtime third-party call: Google Fonts CSS (pre-existing; recorded in DECISIONS).
- Alex's branches `abelyeu.*` are fully merged into `main` (0 commits ahead) — safe
  to ignore; deletion is Alex's call.
- `docs/HEAP-BOTTLENECKS.md` findings (source maps in prod, Tone.js graph size)
  are not yet acted on.

## Half-done / placeholders

- `api/` serverless stubs (leaderboard, daily, ghost) — in-memory, not wired to UI.
- `usePlayerStore` exists but gameplay barely uses it.
- Settings screen has one option (show FPS).
