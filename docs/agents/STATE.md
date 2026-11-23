# State of the game

_Rewritten by the Director on 2026-11-16 (fifth Director run, `main` @ c6d60d2). The
Director rewrites this weekly; the Maintainer edits it when fixing things._

## Summary

Week 4 (9–15 Nov) delivered Alex's 8 Nov bar and a sixth world: 50 merges. Every run is 60 s
with the boss at 40 s and the fight ending the run (#473), waves are placed where the camera
looks (#470, #491, #580), the title park runs to the horizon (#492, #572, #586), Inferno has
its Magma Titan (#542) and lava channels in the ground (#559), far rails thin and haze with
distance (#560), the crow is a character (#573), the board drops pre-60 s scores (#571), lint
runs in CI with the hot-path rule (#482, #569), and **Level 6, Alex's climbing gym, is
playable** from his blockout (#526, #546) with rats and dust bunnies (#523), lanternflies
(#576), the barked Tree and rugged walls (#578), a first fire on the Flame (#581) and the
Medusa (#556). `npm run new-world` scaffolds the next world (#551); `?perf=1` records hitches
(#540).

Alex played the gym on 14–15 Nov. His verdict sets week 5: the hall must be **much bigger** so
the ride is as fast as elsewhere, **grimy Bushwick in low light**, the Medusa **bonier** with
two bridge jewels, the ride **through the Tree's gap** (#558), and the fire "**100x more
realistic**" (#583). His MacBook Neo's `?perf=1` report (#561) shows the game stuttering for
~15 % of every run (bursts every ~0.4 s) and 0.7–1 s frames in the countdown: the first real
measurement of how it plays on a modest laptop, and it is not good enough. The bystander
climbers (#518) are built (draft PR #555) and were blocked only on level 6's draw budget,
raised today. Nothing has been posted publicly yet (#102 waits on Alex since 9 Nov).

## What exists

### Levels (`src/levels/LevelRegistry.ts`)

Every level: 60 s, waves on `levels/pacing.ts` over the first 45 s, boss at 40 s.

| Level | Biome | Waves / finale | Landmarks / features | Director's read of this week's screenshots |
|---|---|---|---|---|
| 1 Theme Park | themePark | 3 × 50 balloons (ring last), **Golden Blimp** | Ferris wheel, carousel, midway, lights, bunting, arch, fireworks on streaks, pickups | Still the reference frame; the far loop now recedes instead of drawing a cable net |
| 2 Desert | desert | scorpions trackside, 2 × crows in V, **Giant Scorpion** | Pyramid, arches, mesas, cacti, dust devils, sun flare, sand ripples | Crows read as birds now (#573). Pacing passes; one thin opening moment left (#494) |
| 3 Ocean | ocean | jellyfish ×2, sharks, flying fish, **Kraken** | Sunken city, sea stacks, water (#430), seabirds, coral, plankton | Reads as an ocean. Kraken tentacles still pale hooks (#600); sharks primitive |
| 4 Antarctica | arctic | scouts (line), snowmen, brutes, **Yeti** (snowballs as bonus kills) | Ice fortress, mountains, aurora, crystals, drifts, pines | Solid; the heaviest level for draws (sits at the 250 bar) |
| 5 Inferno | volcanic | wisps ×2, imps, golems ×2, eruption, **Magma Titan** (vents, heart, crown) | Volcano, lava channels in the ground (#559), ash + embers, smoke column | The slab is gone and the Titan lands. Wisp / imp / golem are the weakest-looking enemies left (#463) |
| 6 Climbing Gym | gym (interior, `HALL_BOUNDS`) | rats, dust bunnies, crows standing in for lanternfly swarms on the walls (#575), **Medusa of the Starr**; bystander climbers in PR #555 | Alex's blockout at `GYM_SCALE` 16: the Starr pit and star, the Flame with #581's fire, the barked Tree with `TREE_GAP`, rugged grimy panels, holds and volumes, contact shadows, the Arch, the glass room; authored spline through four ride moments | Playable and recognisably his gym, but small for the coaster, clean and evenly bright; the fire reads as paint; the Medusa's face too round (#558, #583 → #592–#595, #599) |

Common flow unchanged from last week: poster → title (fly-by park, attract mode) → level select
(postcards, stars, `★ x / max`, Daily Run card) → Ready / Set / GO (Ready holds for the lazy level
chunk, #574) → play → results (count-up, stars, World / This-device top 10, initials, Share with
the score card and its World rank, #562). Settings has the internal-browser toggle (#564).

### Systems

- **Track**: `TrigCurve` loops for levels 1–5 and an authored `spline` for level 6
  (`gymTrack.ts`; #527 routes every curve through `createTrackCurve`); far track thins and hazes
  with distance (#560, `withTrackHaze`).
- **Environment**: per-biome modules; the first interior (`biomes/gym/`: `blockout.ts` +
  `hallGeometry.ts` in three merged meshes, `wallPanels.ts`, `treeTrunk.ts`, `holds.ts`,
  `shadows.ts`, `FlameFire.tsx`); biome `bounds` clamp every placement. Title horizon in four
  draw calls (`titleHorizon.ts`).
- **Enemies**: 17 types incl. the Climber (wall surface, escapes unscored), rat, dust bunny,
  lanternfly (wall swarms, `hopGlideMotion.ts`); the crow's own flinch material. Turntable for
  every enemy and boss.
- **Bosses**: six — Blimp, Kraken, Scorpion, Yeti, Magma Titan (`titanMotion.hot.ts`,
  cracked-obsidian glow), Medusa (`medusaMotion.ts`, bead snakes, three phases).
- **Audio**: one engine (Scrimshaw port + arcade SFX); picked themes for title and levels 1–5;
  three Gym options waiting on Alex (#565, `?theme=`); no boss sections yet (#598).
- **Perf tooling**: `?perf=1` recorder + panel + Copy report, programs-after-warm-up on every
  ride, `--cpu-throttle`, `--level-chunk-delay` (#536 / #540). It can't yet tell our JS from
  GC / GPU / timers between frames (#596).
- **Backend / telemetry / analytics**: unchanged (leaderboard with the 60 s ruleset filter;
  telemetry still waits on Alex's migration `0002_telemetry.sql`).

### Tooling

- CI `verify`: `unit + build`, `lighthouse`, one smoke shard per level + ui / menus / mobile,
  docs-only PRs skip the smoke; ESLint with `sc/*` rules (`sc/no-math-random`,
  `sc/no-src-in-api`, `sc/no-hot-path-alloc`). Nightly full smoke against production in three
  parallel parts (#584). Deploy check after every deploy. Watchdog every 2 h.
- `npm run new-world` (#551), `turntable`, `clip`, `og`, `audio:render` / `audio:check`.

## Numbers

Full `npm run verify` on `main` @ c6d60d2, 2026-11-16 (4-core SwiftShader; frame ms relative only):
1369 unit tests, lint, build, bundle, Lighthouse and the full smoke all green (2566 s).

| Scene | Draw calls | Triangles (frame) | Scene objs / tris | Enemies on screen / readable / largest px | avg frame ms | pacing (no-target share, longest gap) |
|---|---|---|---|---|---|---|
| title | 81 | — | 79 / 56,838 | — | — | — |
| level1 | 80 | 173,503 | 156 / 193,138 | 9 / 9 / 40 | 239 | 2 %, 1.0 s |
| level2 | 117 | 203,738 | 164 / 217,041 | 12 / 11 / 28 | 548 | 2 %, 1.0 s |
| level3 | 85 | 192,465 | 73 / 172,424 | 11 / 11 / 71 | 268 | 0 %, none |
| level4 | 162 | 201,587 | 256 / 240,314 | 14 / 14 / 26 | 332 | 2 %, 1.0 s |
| level5 | 92 | 151,589 | 185 / 160,452 | 14 / 12 / 25 | 244 | 0 %, none |
| level6 | 60 | 178,385 | 90 / 189,696 | 12 / 12 / 104 | 240 | 0 %, none |

Programs after warm-up +0 on every level. Every level's longest no-target gap is ≤ 1 s
(M3's 3 s criterion met). Level 6 sat exactly at its old 60-draw ceiling; it is 130 / 160
from today. Bundle: 573 KB gz total (630), largest chunk 173 KB (260), **startup 417 KB
(435; was 397 a week ago: level 6's blockout and track, #589)**. Lighthouse: SEO / A11y / BP
100, Performance 43 mobile / 60 desktop (report only). The `?perf=1` numbers from real
hardware are in #561.

## Known bugs and visual problems (ranked)

1. **Stutter on a modest laptop** (#561, P1): MacBook Neo, Safari, `low`: 104 hitches in two
   runs, bursts of 200–370 ms frames every ~0.4 s for ~9 s of each 60 s run, 0.7–1 s frames
   in the countdown and before the poster leaves. Cause unknown (#596, #597).
2. **The Medusa's last weak point is out of view** (#856, P1; found 2026-11-23): since #769's
   rebuilt gym ride, the crown snake sits above the frame and then behind the car through her
   whole face-off, so the nightly's `boss level6` stays red (#707) until it is fixed. The step's
   stale ride fraction is fixed in #857.
3. **Level 6 isn't at Alex's bar** (#558, #583): too small for the ride, clean and bright, a
   painted-on fire, a round-faced Medusa, the ride beside the Tree instead of through it.
4. **Bystander climbers unmerged** (#518, draft #555): blocked on `scene.level6` until this
   week's Director PR.
5. **Lanternflies aren't on level 6's walls yet** (#575): crows stand in for the swarm wave.
6. Enemies still primitives up close: wisp, imp, golem (#463), the Kraken (#600), shark, drake.
7. Level 6's blockout and track sit in the startup JS (~4.7 KB gz, #589).
8. Smoke: settled steps can hold forever (#535 in #606); runner-dependent counts were fixed
   by #531 (#471 closed).
9. **Telemetry endpoint dead** until Alex runs the migration (`docs/TELEMETRY.md`).
10. Small visual bugs bundled in #333 (Kraken one-frame jump, frozen particles, eruption
   carry-over); dust bunny hairs dip into the floor (#524); an escaped climber counts as a kill
   in the HUD (#480).
11. Share / results / daily edge cases (#357, #374, #267) — P3 filler.

## Tech debt / architecture notes

- Gym code duplicates helpers that exist (`hallGeometry.ts` has its own paint / merge; the
  authored floor resolves in two places): bundled in #601 after the scale-up.
- Several setup-heavy modules with per-frame functions aren't `*.hot.ts` yet, so the hot-path
  rule can't see them (`krakenMotion`, `medusaMotion`, `climbMotion`, `arcLength`,
  `ridePhysics`, `titleCoaster`, `windStreaks`).
- One React component + `useFrame` per enemy; fine at today's counts, and a candidate cause to
  rule in or out for #561.
- `EnemySpawner.tsx` still mixes timing, placement and rendering (#294, parked).
- Ground bosses repeat exposure-window / relocate / heading helpers (#605).
- `SharedEnemyAssets.ts` and `e2e/smoke.mjs` remain the files every builder touches.
- Two issues still carry the `studio-status` label (#57 and #78).

## Half-done / placeholders

- Level 6: bystanders (#518), lanternfly walls (#575), the scale / look / Medusa / fire passes
  (#592–#595, #599), the theme pick (#565 → #566).
- Audio: boss sections (#598); results variations and positional kill sounds in the backlog.
- PLAY-straight-to-ride (#329): blocked until the Showcase post (#102) has a measured week.
- Telemetry: shipped, table not created (Alex).
