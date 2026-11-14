# State of the game

_Rewritten by the Director on 2026-11-09 (fourth Director run, `main` @ a121897); Level 6
and the studio notes amended 2026-11-13 (mid-week re-plan for #513, `main` @ e6a98d2). The
Director rewrites this weekly; the Maintainer edits it when fixing things._

## Summary

Week 3 finished the arcade loop and gave four of five levels a finale. 50 merges in 7 days:
the Giant Scorpion (Desert) and the Yeti (Antarctica, with snowballs you shoot down), the
Ocean's water and opening, a coaster riding the title park with beat-locked cuts and
attract mode, a poster from the first paint, the local and the online (World) leaderboard,
the score-card image share, Alex's picked themes on one audio engine with intensity layers
(Tone.js is gone), real-player telemetry, a sharded PR smoke with a nightly deep run, a
deploy health check, a watchdog and an enemy turntable. M2 is closed.

Alex played every level on 8 Nov (#439): "music sounds awesome now"; Theme Park is the best
level for how enemies show up. What the game is **not** yet, in his words and mine: runs are
60 / 65 / 75 / 75 / 120 s instead of 60 s everywhere with a shape (#452); the Desert has
stretches with nothing to shoot, and nothing measures that on any level (#450, #451); the
title is a park on a flat green plain (#454, #459); Inferno has no finale (#320) and a glowing
slab beside the track (#331); far rails still draw as a cable net across every bright level
(#327); enemies are primitives up close (`docs/art/ENEMIES.md`, #462, #463); there is no
sixth world and no way to make one fast (`docs/LEVEL-KIT.md`, #453 → #457 → #460). Nothing
has been posted anywhere yet (#102 waits on Alex); 23 of W45's 28 visitors started no level.

## What exists

### Levels (`src/levels/LevelRegistry.ts`)

| Level | Biome | Timer | Waves / finale | Landmarks / features | Director's read of this week's screenshots |
|---|---|---|---|---|---|
| 1 Theme Park | themePark | 60 s | 3 × 50 balloons at 0 / 15 / 30 s (ring last), **Golden Blimp at 40 s** | Ferris wheel, carousel, midway, string lights, bunting, arch, fireworks on streaks, pickups | Still the best frame and Alex's density bar. The track loop shows as white cables over the hills (#327) |
| 2 Desert | desert | 60 s | 30 scorpions (trackside), 2 × 39 crows in V at 15 / 30 s; **Giant Scorpion at 40 s** (claws, tail, stinger) | Pyramid, arches, mesas, cacti, dust devils, sun flare, sand ripples, dust | Sunset mood is strong, the Scorpion lands. Alex: stretches with no enemies in view (#451). Crows are "a ball with sticks" up close (#462) |
| 3 Ocean | ocean | 60 s | 20 + 24 jellyfish, 28 sharks (trackside, floating), 36 flying fish at 0 / 14 / 23 / 32 s; **Kraken at 40 s** | Sunken city, sea stacks, water with glitter / swell / shallows / horizon (#430), seabirds, coral, plankton | Reads as an ocean now; jellyfish in view from the start. The whole rail loop sits on the frame as blue cables (#327). Kraken still pale hooks (backlog) |
| 4 Antarctica | arctic | 60 s | 44 scouts (line), 40 snowmen, 16 brutes at 0 / 15 / 30 s; **Yeti at 40 s** (fists, then the chest while it roars; snowballs are bonus kills) | Ice fortress, mountains, aurora (flares in the tell), crystals, drifts, pines, snow | Sky and snowmen good; the Yeti's snowball splat reads. 178 draws (was 394) |
| 5 Inferno | volcanic | 60 s | wisps ×2, imps, golems ×2 at 0 / 8 / 16 / 25 / 33 s, one eruption (25 s); **8 drakes at 40 s stand in for the boss** (#320) | Volcano, lava rivers, ash + embers, smoke column, emissive rails | Readable in the dark. The bright vertical slab beside the track remains (#331); wisp / imp / golem are the weakest enemies (#463). 116 draws (was 295) |
| 6 Climbing Gym | gym (interior) | — | planned (#513, 12 Nov): Alex's own gym from his blockout (`docs/levels/gym-blockout.json`); rats + dust bunnies (#515), lanternflies (#516), climbers as don't-shoot bystanders (#518), **the Medusa of the Starr** (#521) | planned: the Starr pit and star, the burning Flame (#520), the Tree headwall and rugged walls (#519), the Arch, the glass gym room; an authored spline track through four ride moments (#514) | #503 (a generic hall) was closed by Alex on 12 Nov; #457 superseded. Build order: #514 ∥ #515 ∥ #516 → #517 (level playable) → #518 ∥ #521 ∥ #520 ∥ #519 |

Common: title (poster → fly-by park with a riding coaster, beat-locked cuts, animated logo
and menu, attract mode after 30 s; any key / PLAY) → level select (postcards, stars,
`★ x / 15`, Daily Run card, keyboard nav; level N needs 1★ on N-1) → Ready / Set / GO
(shader warm-up behind it) → play → results (count-up, star pops + chime, threshold bar,
stats, NEW RECORD, World / This-device top 10 with initials entry, Levels / Replay / Share
menu with the score-card image). Pause: Esc / tab hide / blur → card, Resume (Ready / GO) /
Restart / Settings / Quit. Settings: quality, show FPS, music / effects volume, screen shake,
reduced motion (+ an internal-browser toggle coming, #446).

### Systems

- **Track** (`src/track/`): `TrigCurve` / `TrigCurve2` closed loops, rails + ties by
  `trackDimensions`, lattice towers, arc table, coaster camera by arc distance (`cameraRig.ts`,
  `cameraFov.ts`, `WindStreaks`), `minThickness.ts` pixel floor (the cause of #327).
- **Environment** (`src/levels/environments/`): per-biome modules over shared terrain /
  water (`OceanWater`: a patched Standard material over a seabed height texture, #430) /
  trees / atmosphere (sky dome, light, fog, grade, PMREM env) / scatter / `trackClearance` /
  `paintedParts` / `ringedRock` / `ParticleField` / `ContactShadows` / `landmarkDimensions`.
  All five biomes are outdoor; the Gym (#457) adds the interior shape. Post: one EffectPass
  (Bloom + grade + ACES; every shader must output finite values, #344).
- **Enemies** (`src/entities/enemies/`): 13 types + golden balloon over `EnemyBase`; parts
  merged per material and moving part (#350: Arctic 394 → 178 draws, Inferno 295 → 116).
  Spawner: waves on the level timer (`waveSchedule.ts`), formations placed ahead of the rider
  at activation (`spawnPlacement.ts`), trackside / water bands (`ENEMY_PLACEMENT`, #343),
  `wave:incoming` tell. Placement does not yet know where the camera will look (#451). The
  turntable (`npm run turntable`, #387) renders every enemy and boss close up.
- **Bosses** (`src/entities/bosses/`): `bossModel.ts` (weak points in phases, `retracted` set,
  `applyHit`, `hpFraction`), specs, `BossBase`, `BossSpawner`; Golden Blimp, Kraken
  (`krakenMotion.ts`), Giant Scorpion (`scorpionMotion.ts`, `pickPerch`), Yeti (`yetiMotion.ts`,
  `boss-projectile:` snowballs as bonus kills, `BossSpec.projectiles` in the server limits).
  Every boss arrives at 40 s of a 60 s run (#452, `levels/pacing.ts`); the smoke's boss step times each fight under 20 s at 2 hits a second.
- **Combat / effects / UI**: unchanged in shape from last week (combo tiers on game time,
  pickups, pooled explosions with a style per enemy, fireworks, HUD, `BossBar`, `SnowSplat`,
  `WeaponBadge`); the results screen gained `ResultsLeaderboard` (World / This device,
  initials entry) and the Share menu + score card (`scoreCard.ts`, `scoreCardImage.tsx`).
- **Audio** (`src/audio/`): **one engine** (#431): `AudioEngine.ts` (context + master chain,
  main chunk, tiny), the Scrimshaw score engine port (`scrim/`: parser, synth, scheduler,
  player, intensity `layers.ts` driven by the combo tier, `lint.ts`) and the arcade SFX
  (`arcade/`: recipes in the level's key, baked per level, voice pool, per-biome convolver);
  Alex's picked themes are the defaults for the title and levels 1–5 (Neon Marquee, Midway
  Rush, Dune Rider, Lagoon Run, Aurora, Hellgate); `?theme=` for listening rounds (none
  open). Offline renders through the same code (`audio:render` / `audio:check`). Missing:
  boss / results variations, positional kill sounds (backlog), the Gym's theme (#456).
- **Backend** (`api/`): `leaderboard.ts` (Supabase `scores`, top 10 per level, server limits
  from `scoreLimits.ts`, 5 POSTs / IP / 10 min), `telemetry.ts` (one beacon per page load;
  **`/api/telemetry` answers nothing until Alex runs `supabase/migrations/0002_telemetry.sql`**).
  Only scoaster.com's own build calls either.
- **State / analytics**: unchanged (`startRun`, `runId`, persisted scores / boards / daily;
  Vercel Web Analytics events, `?internal=1`, `/go/<campaign>`).

### Tooling

- CI `verify` on PRs: `unit + build` (989 tests + `tsc -b` + build + bundle budget),
  `lighthouse` (SEO 100, A11y / BP ≥ 95), one `smoke (<shard>)` per shard (ui, menus,
  level1, level1-steps, level2–5, mobile; `smokeSeconds` budgets scaled by the runner's
  measured speed, #443), then the `verify` gate; docs-only PRs skip the smoke (#409). The
  deep checks (full boss fights, waves, FRENZY end, initials, share, daily, pause, pickups,
  phone menus) run nightly against production (`prod-smoke.yml`); a fast deploy health
  check (`prod-check`) runs after every deploy; alerts on transitions only (#355).
- `npm run clip` (any level, the vertical cut, the title), `npm run og` (share card, poster
  stills, icons), `npm run turntable`, `audio:render` / `audio:check`, `scripts/quiet.sh`.
- Studio: pause switch, runbooks, decisions inbox folded nightly, status page with
  milestones, the watchdog (`studio-health`: red main, flaky checks, stuck PRs, token-heavy
  runs, player errors / slow levels), token ledger with per-agent splits, auto-merge after
  every CI run with conflict hand-back, builder context × turns budgets (#417, #433).
  **Two issues carry the `studio-status` label (#57 and #78)** — the page script should
  write one; worth a Maintainer look.

## Numbers (2026-11-09, full smoke on `main` @ a121897, 2-core SwiftShader)

| Scene | Draw calls | Triangles (frame) | Scene objs / tris (camera-independent) | Enemies on screen / readable / largest px | avg frame ms (software GL, relative only) |
|---|---|---|---|---|---|
| level1 | 80 | 173,503 | 156 / 193,138 | 8 / 8 / 31 | 465 |
| level2 | 93 | 196,858 | 164 / 217,041 | 5 / 4 / 25 | 459 |
| level3 | 82 | 192,069 | 73 / 172,424 | 10 / 10 / 78 | 521 |
| level4 | 178 | 206,635 | 180 / 216,336 | 18 / 12 / 27 | 520 |
| level5 | 112 | 151,669 | 103 / 150,772 | 30 / 18 / 48 | 456 |
| level6 | 44 | 151,521 | 92 / 167,084 | 7 / 7 / 42 | 353 (2026-11-14, #517 branch, ride shard) |

Title: 90 draw calls, 80 scene objects, 11,202 triangles (ceilings before today 114 / 89 / 11,356). Budgets: `scene.title` raised today to 140 / 130 / 60 000 for the title
world (#454 / #459). Bundle: 519 KB gz total JS (budget 630), largest chunk 172 KB (260),
startup 397 KB (435; three 172, r3f 114, app 111). Lighthouse (W45 report, this sandbox):
SEO / A11y / BP 100, Performance 43 mobile / 59 desktop (report only).

W44 → W45 (draw calls at the ride shot): L1 84 → 79, L2 110 → 92, L3 69 → 82 (water), L4
202 → 178, L5 295 → 116. All five under the 250 bar for the first time.

Players (W45, `docs/marketing/metrics/2026-W45.md`): 28 visitors, 65 views, nothing
posted; every level start came from one Mac browser (Alex's, un-flagged: #446 adds a
Settings toggle; `?internal=1` once fixes it now). Real-player baseline stays W44's: ≈ 5
visitors and ≈ 1 start a day, 19 % press PLAY. Mobile: 1 of 19 mobile visitors has started
a level in three weeks.

## Known bugs and visual problems (ranked)

0. **Studio stalled (13 Nov, #512, `needs-alex`)**: two scheduled Builders / QA runs passed
   with no token-ledger post since 12 Nov 07:35 UTC; 0 PRs open, ~30 issues waiting. Only Alex
   can check the scheduled tasks (CLAUDE.md rule 10). #511 (#503 approved 16 h, unmerged) is
   moot: #503 is closed.

1. **Fixed 9–10 Nov:** every run is 60 s with the boss at 40 s (#473, closes #452), and waves
   are placed where the camera will look (#470, closes #451). The nightly `pacing` step
   (#467) failed level2 / level4 on 9 Nov (#469, before those merged); on 069adc6 the Maintainer's
   local pacing run passes level2 (longest gap 2 s), level4 (2 s) and level5 (no gap).
2. **The smoke's enemy counts depend on the runner** (#471, P1): the same seed gives different
   pacing gaps and on-screen counts locally and on CI. It turned `main` red once on 10 Nov
   (#478: `smoke (level2)` readability, 1 readable of 2 on screen). #482 seeds enemy
   motion from the run seed, and frame-rate-dependent drift remains.
3. **The title world is a green plain** around the park (#436 → #454, #459).
4. **Far rails read as bold cables** across Theme Park, Ocean, Antarctica (#327): the pixel
   floor has no distance cue.
5. **Inferno's vertical glowing slab** beside the track; rivers as thin lines (#331). Known
   since W43.
6. **Inferno has no finale** (#320).
7. Enemies are primitives up close: crow, golem, wisp, imp, shark, drake (#381 → #462, #463).
8. **Telemetry endpoint dead** until Alex runs the migration (`docs/TELEMETRY.md`).
9. Smoke flakes on slow runners: frenzy-end leaderboard check (#367), the wave-gap and
   phone-tap flakes (#337). The W45 Reporter's sandbox run had 7 failing steps on 10 s click
   timeouts that pass in CI; this run: the same 5 (`quality` and `pickup` see a 17-draw level, the share menu clicks time out, `hidden-pause` combo, the phone run), filed as #464 (P2): the 17-draw level may be the lazy level chunk missing a run start, which would be a real bug on slow connections.
10. Small visual bugs bundled in #333 (Kraken tentacle jump, frozen particles on a reused
    slot, eruption carry-over) and #336; Kraken tentacles pale (backlog 3).
11. Arcade SFX follow-ups (#338: resume countdown muted, biome swap click); `timeScale` has
    three writers (#334).
12. Share / results edge cases (#357, #374, #235, #267) — P3 filler.

## Tech debt / architecture notes

- One React component + `useFrame` per enemy (up to 150 live) and per boss part; fine at
  today's counts. The pooled / instanced path is the M4 answer if a kit-built world needs it.
- `EnemySpawner.tsx` still mixes wave timing, placement and rendering (#294, parked); #451
  and #452 change the placement and timing it hosts, so #294 waits for them.
- Two particle systems and two kill sequences (#335, parked); the old composer's render
  targets leak on an MSAA change (#334).
- No linter: rules live in CLAUDE.md prose (#351 → #455, #461).
- `SharedEnemyAssets.ts` (~800 lines) and `e2e/smoke.mjs` (~3,000 lines) are the two files
  every builder touches; the full smoke is ~25 min here, PR shards ≤ 4 min each on CI.
- Builder cost: ~3.8M weighted tokens per builder run this week (87M / 23), down from ~6M;
  #343 (Ocean opening) cost 12.3M across its rounds. #444 (watchdog) tracks the heavy ones.
- 16 P3 refactor / follow-up issues are parked without `agent:ready` until the P1 work lands
  (list in the Director's decision entry); the Director re-queues them on 16 Nov.

## Half-done / placeholders

- Score engine: no boss / results variations; no positional kill sounds; the Gym has no
  theme yet (#456).
- Share: text + image ship; the World rank isn't in the share line (#445).
- Level 6: the Climber (#453) is ready to build; the Gym (#457), its theme round (#456), the
  scaffold (#460) and the leaderboard ruleset (#458) wait on their `Waiting on` issues.
- Enemy art: briefs written (`docs/art/ENEMIES.md`); nothing upgraded yet.
- PLAY-straight-to-ride (#329): blocked until the Showcase post has a measured week.
- Telemetry: shipped, table not created (Alex).
