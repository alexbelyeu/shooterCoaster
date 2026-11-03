# State of the game

_Rewritten by the Director on 2026-11-02 (third Director run, `main` @ 8e66045). The
Director rewrites this weekly; the Maintainer edits it when fixing things._

## Summary

Week 2 gave the run a shape. 50 merges in 8 days: combo tiers with FRENZY slow-mo, waves
that fly in on formations with a tell, a death style per enemy, the boss framework with the
Golden Blimp (Theme Park) and the Kraken (Ocean), weapon pickups, the Daily Run, a pause
that freezes the world, settings with quality presets and adaptive resolution, a Share
button, fireworks, Antarctica and Inferno readable, rails that stay visible at distance,
the Scrimshaw score engine and arcade SFX behind `?audio=scrim`, lazy Tone.js, a portal
build, real 404s and a Lighthouse gate. M2's exit criteria are all on `main` except the
local leaderboard (finished on a branch, re-landing as #317) and a smoke that is green on
`main`.

What the game is **not** yet: three of five levels still end on a timer (Desert,
Antarctica, Inferno have no finale); the Ocean opens on an empty sea and its water reads
as a khaki bog; far rails draw as bold white cables across every bright level; Inferno has
a glowing vertical slab beside the track; the music does not react to play. The studio's
own health this morning: CI red on every PR for a runner-image reason (#311; fixed by PR #313 at 18:18 UTC),
and the smoke's level steps sample wall-clock level time, so slow runners fail the perf
gate and reach bosses early (#305 / PR #312, which found the Ocean opening problem #250 →
#316). Week 3 leads with those two, then the finales, the Ocean, and the first slice of
Level 6.

## What exists

### Levels (`src/levels/LevelRegistry.ts`)

| Level | Biome | Timer | Waves / finale | Landmarks / features | Director's read of this week's screenshots |
|---|---|---|---|---|---|
| 1 Theme Park | themePark | 75 s | 3 × 50 balloons (ring formation last), **Golden Blimp at 55 s** (5 golden balloons → gondola) | Ferris wheel, carousel, midway stalls, string lights, bunting, entrance arch, fireworks on streaks, pickups on the start | The best frame and the clip level. FRENZY, fireworks and the blimp all read. The whole track loop shows as thick white cables over the mountains (#327) |
| 2 Desert | desert | 60 s | 30 scorpions, 2 × 25 crows in V formation; **no finale** (#318) | Pyramid, rock arches, mesas, cacti, dust devils, occluded sun flare, sand ripples, dust particles | Sunset mood is strong; scorpions and crows readable (16 of 28). Draw calls 110 (was 268 before #205) |
| 3 Ocean | ocean | 65 s | 20 jellyfish, 25 sharks, 30 flying fish (school); **Kraken at 40 s** (5 pads → eye) | Sunken city, sea stacks, breaching rocks, foam rings, seabirds, coral, plankton particles | **Empty for the first 10 s** (jellyfish 15–45 units under water, scattered over a 1,100-unit disc: #316). Water is a flat teal-khaki plane, coral sits on dry-looking ground (#326). Kraken tentacles read as thin pale hooks in the rails' colour (backlog 1) |
| 4 Antarctica | arctic | 75 s | 25 scouts (line), 20 snowmen, 8 brutes, all trackside; **no finale** (#319) | Ice fortress, mountains, aurora, ice crystals, drifts, blue-green pines, snow particles | Sky, aurora and the snowmen line are good (11 of 11 readable). Heaviest level: 480 scene objects, 202–394 draws (#260); a steep far hill reads as a vertical rail because every far rail is the same 3 px (#327) |
| 5 Inferno | volcanic | 120 s | wisps (spiral) ×2, imps, golems ×2, drakes; 2 eruptions; **no finale** (#320) | Glowing volcano, lava rivers, ash + ember particles (eruption boost), smoke column, terrain lava glow, emissive rails | Readable now (25 of 41). A bright orange vertical slab stands beside the track in every shot and the rivers are thin lines (#331). 295 draws (#260) |

Common: title (fly-by park, any key / PLAY) → level select (postcards, stars, `★ x / 15`,
Daily Run card, keyboard nav; level N needs 1★ on N-1) → Ready / Set / GO (shader warm-up
behind it) → play → results (score count-up, star pops + chime, threshold bar, kills /
accuracy / best combo / time left, NEW RECORD, Levels / Replay / Share; a daily shows its
badge and NEW BEST). Pause: Esc / tab hide / blur → styled card, Resume (Ready / GO) /
Restart / Settings / Quit. Settings: quality (auto / low / medium / high), show FPS,
music / effects volume, screen shake, reduced motion.

### Systems

- **Track** (`src/track/`): `TrigCurve` / `TrigCurve2` (closed loops), rails + ties scaled by
  `trackDimensions`, lattice towers, arc table, coaster camera sampling by arc distance
  (`cameraRig.ts`, `cameraFov.ts`, `WindStreaks` after the world's transparents),
  `minThickness.ts` pixel floor (1.5 px rails / 0.5 px lattice, any distance).
- **Environment** (`src/levels/environments/`): per-biome modules; shared terrain / water /
  trees (wind sway, unlit fill per biome) / atmosphere (sky dome, light, fog, `envIntensity`,
  colour `grade`, PMREM env map) / scatter / `trackClearance` / `paintedParts` /
  `ringedRock` / `ParticleField` (one preset per biome, boosts on events) /
  `ContactShadows` / `landmarkDimensions`. Post: one EffectPass (Bloom + grade + ACES).
- **Enemies** (`src/entities/enemies/`): 13 types + golden balloon over `EnemyBase` (entry
  fly-in, hit flash, kill pop, death style). Merged vertex-coloured geometries; glossy parts
  reflect the env map. Spawner: waves on the level timer (pure `waveSchedule.ts`),
  formations placed ahead of the rider at activation (`spawnPlacement.ts`), ground types
  trackside (`ENEMY_PLACEMENT`), `wave:incoming` tell 1 s before. Water types still use the
  old disc scatter (#316).
- **Bosses** (`src/entities/bosses/`): pure `bossModel.ts` (weak points in phases, `applyHit`,
  `hpFraction`, `bossMaxScore`), specs, `BossBase` (one target per exposed weak point, kills
  through the normal path), `BossSpawner` (dormant mount, tell, activation on the level
  timer), `GoldenBlimp` (rides ahead), `Kraken` (surfaces at fixed spots), `BossConfetti`
  (a second particle system; #335 folds it into the pool). HUD `BossBar`.
- **Combat** (`src/combat/`): Pointer Events aim + touch aim assist, swept bullets from the
  muzzle, piercing hit lists, `comboTiers.ts` (1× / 2× / 3× / 5×, game-time windows,
  FRENZY envelope) run by `comboRuntime.ts` on `core/gameClock.ts`; weapon pickups
  (spread / rapid / piercing, 10 s) as instanced collision targets; `WeaponViewModel`;
  rotation-only trauma; hitmarker; score popups; `timeScale` still has three writers (#334).
- **Effects** (`src/effects/`): one pooled `ParticleExplosion` with a style per enemy type
  (`deathStyles.ts`), fireworks (Theme Park), score popups.
- **UI** (`src/ui/`): HUD (score, timer bar, combo meter with tier colour and ring, FRENZY
  flash, wave banner, boss bar, weapon badge), title, level select (`levelSelectModel.ts`),
  results (`resultsStats.ts`, `share.ts`), pause (`pauseMenu.ts`), settings, per-biome
  `theme.ts`. Self-hosted Lobster / Inter.
- **Audio** (`src/audio/`): Tone.js is still the default engine (lazy chunk on the first
  gesture; per-level SFX kit; title / level music crossfading on the beat on one Transport;
  pause mix). Behind `?audio=scrim`: the Scrimshaw score engine port (`scrim/`: parser +
  compiler pinned to the original, arcade instrument palette, scheduler, player with
  1 s crossfades), scores for title / levels 1–5 / results, three title and three Theme
  Park theme options on `?theme=` (PR #300, waiting on Alex's pick #301), and the arcade SFX
  engine (`arcade/`: recipes in the level's key, baked once per level, fixed voice pool with
  priority stealing, per-biome convolver). No adaptive layers yet (#321). Render + measure
  tooling: `audio:render` / `audio:check`, renders in `docs/audio/renders/`.
- **State** (`src/store/`): game store (`startRun(levelId, seed?, mode?)`, `runId`,
  `runMode`, `runSeed`, persisted `savedScores` + `savedDaily` + `dailyStreak`, `weapon`,
  `boss`), settings store (persisted). Leaderboard store on the #40 branch (#317).
- **Analytics**: Vercel Web Analytics page views + `level_start` (with `mode`) /
  `level_complete` / `level_quit` / `share`; off for `?e2e=1`, CI and `?internal=1`;
  `/go/<campaign>` landing paths pinned by the smoke.

### Tooling

- CI `verify` on PRs and on `main` after every auto-merge: vitest (685 tests) + `tsc -b` +
  build + bundle budget + Lighthouse (SEO 100, A11y / BP ≥ 95) + the headless smoke (title,
  landing, level select, daily, settings, five levels with ride / enemy / combat / shot /
  results shots and the per-level perf gate from `budgets.json`, quality presets, seed check,
  hidden pause, pause menu, countdown, speed, wave, two bosses, pickups, scrim engine, phone
  portrait + landscape). `portal` job builds and smokes the portal zip. Nightly + post-deploy
  production smoke → `agent:prod-broken`.
- `npm run clip` (level-1 clip in virtual time, re-rendered for the Showcase), `npm run og`,
  `npm run audio:render` / `audio:check`, `scripts/quiet.sh`, the token ledger with per-run
  diagnostics (#298), auto-merge sweep every 10 min.
- Studio: pause switch, runbooks per task, decisions inbox folded nightly, live status issue,
  two independent reviewers on PRs ≥ ~300 lines, `builder_runs_per_day` cap. Milestones on
  GitHub from this week (M2 #1, M3 #2).

## Numbers (2026-11-02, `npm run verify` on main @ 8e66045, 2-core SwiftShader)

| Scene | Draw calls | Triangles (frame) | Scene objs / tris (camera-independent) | Enemies on screen / readable / largest px | avg frame ms (software GL, relative only) |
|---|---|---|---|---|---|
| level1 | 84 | 174,311 | 156 / 193,138 | 9 / 9 / 27 | 2714 |
| level2 | 110 | 201,366 | 164 / 217,041 | 28 / 16 / 19 | 2183 |
| level3 | 69 | 161,673 | 173 / 165,224 | 6 / 6 / 54 (at ~12 s; 1 at a fixed 10 s per #305) | 2391 |
| level4 | 202 (394 in the W44 report) | 191,491 | **480** / 216,336 | 11 / 11 / 43 | **10,617** (2 frames in 48 s: "render loop stalled", the run's only failure) |
| level5 | **295** | 152,309 | 278 / 150,772 | 41 / 25 / 44 | 1917 |

Track alone: ~79–86k triangles per level (10 objects). Env bake 1.6–2.1 s per level
(software). Shader warm-up 6.5 s, 54 programs; first shot compiles nothing new. Bosses:
level1 92 draws, level3 178 draws during the fight. Lighthouse performance (report only):
28 mobile / 59 desktop.

W43 → W44 trend (draw calls / scene triangles): L1 94 → 84 / 187k → 193k, L2 268 → 110 /
208k → 217k, L3 73 → 69 / 159k → 165k, L4 176 → 202–394 / 211k → 216k, L5 109 → 295 /
138k → 151k. Levels 4 and 5 grew past the VISION bar in the week of #208 / #218 / #245
(#260 owns it; the `budgets.json` ceilings were not lowered to 250 because `knownOver`
would mute the whole level's gate while #260 is open).

Bundle: 562 KB gz total JS (budget 700), largest chunk 184 KB (budget 260), startup 472 KB
(app 184, three 172, r3f 115); Tone.js, the score engine, the arcade SFX and the render
tooling are lazy chunks.

Players (W44, `docs/marketing/metrics/2026-W44.md`): 37 visitors, 43 views, all direct;
8 starts (7 people) → 3 completes; 19 % of visitors press PLAY (desktop 21 %, mobile 11 %
on 9 mobile visitors); ≈ 5 visitors and ≈ 1 start a day is the baseline the Showcase post
(#102, Mon 2 Nov) is measured against.

## Known bugs and visual problems (ranked)

1. **Fixed: CI was red on every PR 2 Nov 10:43–18:18 UTC**: `ubuntu-latest` became Ubuntu 26.04
   and Playwright 1.58's `--with-deps` refuses it. #311 (closed); PR #313 pinned `ubuntu-24.04`.
2. **Smoke level steps sample wall-clock level time** (#305, PR #312): slow runners sample
   20–50 s into a level, fail the perf gate on enemy counts, reach the Kraken during
   `playLevel`, and overshoot `hidden-pause`'s 3 s slack. The production smoke issue #297
   stays open until `main` is green after it. #312 is blocked on the Ocean opening (#316).
3. **Ocean opens empty** (#250 → #316): jellyfish scatter 15–45 units under water across
   the sea; 1 readable at 10 s of level time, every time. Also the player's experience.
4. **Ocean water is a flat teal-khaki plane** (#326); coral on dry-looking ground; the
   Kraken's tentacles read as pale hooks (backlog 1).
5. **Far rails read as bold white cables** on Theme Park, Ocean, Antarctica (#327): the
   #186 pixel floor has no distance cue, so the whole loop sits on the frame.
6. **Inferno's vertical glowing slab** beside the track in every shot; lava rivers as thin
   lines (#331). Known since W43, never filed until now.
7. **Levels 4 and 5 over the 250 draw-call bar** (#260): 480 scene objects on level 4, 295
   draws on level 5. Level 4 also stalls the 2-core smoke (10.6 s a frame).
8. **Auto-merge stalls on a conflict** with the approved label still on (#299, P1): no role
   picks it up until the nightly Maintainer; #276 stalled twice.
9. `timeScale` has three writers; `FrenzyFlash` re-times on the wall clock (#334).
10. Smoke flakes: wave step can skip the tell-to-wave gap on a fast box (#279), phone PLAY
    tap "not stable" + a 5 s single-frame wait (#248) — bundled as #337; title-2 blank check
    flaked once on `main` CI (#291 added it).
11. Small visual bugs: Kraken's last tentacle flashes for a frame when the head surfaces
    (#264), a reused explosion slot can show frozen particles (#228), the eruption boost
    carries into a restart (#247) — bundled as #333.
12. Under `?audio=scrim` only: resume countdown muted, biome swap click, stray level score
    on leaving a run (#246, #236 → #338).
13. The combo meter shows "×19" best combo on a 6-kill smoke run (the hook's seeded kills
    count toward the combo but not the wave strip): cosmetic in tests only; worth a look if
    it shows in real results.

## Tech debt / architecture notes

- One React component + `useFrame` per enemy (up to 150 live) and per boss part; fine at
  today's counts. The pooled / instanced enemy path is the M4 answer if Level 6's traffic
  and drones push level 6 over the bar.
- `EnemySpawner.tsx` still mixes wave timing, placement and rendering, though placement is
  pure now (`spawnPlacement.ts`, `enemyPlacement.ts`, `rideProgress.ts`); #294 lists the
  leftovers.
- Two particle systems (`ParticleExplosion` pool + `BossConfetti`) and two kill sequences
  (`EnemyBase`, `BossBase`): #335.
- The old `EffectComposer`'s render targets leak when MSAA changes (#249 → #334).
- Audio runs two engines side by side (Tone.js default, Scrimshaw behind the flag) until
  parity (hard rule 7); every new sound has to be written twice or flagged. The sooner the
  picked themes and layers land, the sooner Tone.js goes (#321 → #302 → #303 → removal).
- `SharedEnemyAssets.ts` (~800 lines) and `e2e/smoke.mjs` (~3,000 lines) are the two
  files every builder touches; the smoke's wall time is ~20 min on CI, ~21 min here.
- The leaderboard lives on a branch (`agent/40-local-leaderboard`, 1,050 lines, approved
  twice) until #317 re-lands it.
- Builder cost: ~6M weighted tokens per builder run, mostly bootstrap and verify, whatever
  the issue's size; hence the bundled small issues (#333–#339): 29 ready issues for the week
  instead of 40.

## Half-done / placeholders

- Score engine: scores exist for every level but no adaptive layers (#321), no boss or
  FRENZY variations, Alex's picks pending (#301); Tone.js remains the default.
- Share: a text share exists (#253); the share menu is in QA (PR #304); the share image
  (#272) waits behind it.
- Milestones: M2 and M3 exist on GitHub; the status page and the weekly report don't show
  them yet (#330).
- Level 6: filed (#322 epic), nothing built.
