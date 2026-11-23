# State of the game

_Rewritten by the Director on 2026-11-23 (sixth Director run, `main` @ 7815b80). The
Director rewrites this weekly; the Maintainer edits it when fixing things._

## Summary

Week 5 (16–22 Nov) was the studio's biggest: ~170 merges. **Every one of Alex's gym notes landed**
(#558, #671): the gym at twice the size and then `GYM_SCALE` 48 (#614, #761), spectacularly Bushwick in
low light (#619, then a little brighter, #680), the ride through the gap between the Tree's solid trunk
and the wall (#663), the Medusa's bony jaw, almond eyes and sharp nose (#618, #684), a fire rebuilt as
flame tongues that lights the hall with smoke, sparks and shimmer (#623, #628, #642, #682), padded floors
and black paths (#681), lanternflies you can see (#678), no birds (#677), the bystander climbers (#555)
and the Training Area cave as a dark section (#764). Alex then asked for rides with "pizazz" (#703), and
the **ride kit** shipped in four days: real speed with beats solved onto their seconds (#705), the camera
and sound selling it (#709), loops / rolls / corkscrews / helices (#713), station launch, drop track, jump
gap and backwards (#717), shoot-to-switch junctions (#721, #807), a comfort gate (#762) and level 6's
ride rebuilt from its storyboard (#726, #769). The UI became **the travelling fair's shooting gallery**
(`docs/art/PERSONALITY.md`; title, level select, HUD, results, settings, pause, loading, 404). And the
whole idea backlog shipped: the whale (#796), sandstorm and blizzard waves (#799), results win / lose
cuts (#795), boss cues placed with per-biome acoustics (#805), the Shark and Drake (#816), gamepad
(#821), photo mode (#831), Night Ride for level 1 (#830), the track radar (#835), aerial fog (#837),
colour-blind safe palettes (#839), ghost replay (#846), the Daily Run World board (#855), the WebGPU
capability field (#851), the 10 s intro tour (#690), PLAY straight to the next level (#811).

What it costs: **startup JS and total JS sit exactly at their budgets** (436 / 436, 635 / 635 before
this week's raise of the total) after five +1 KB raises; production's nightly has been red since 11-20
for three different reasons, each fixed (a deploy mid-run #822, the phone share menu #843, the Medusa
out of view on the rebuilt gym #857 / #860; #707 closes on the next green nightly); and nothing has been
posted publicly. Alex's answer (#610, 18 Nov): **not until the game is AAA, with ten levels at the
highest degree**. That is M4.

## What exists

### Levels (`src/levels/LevelRegistry.ts`)

Every level: 60 s, waves on `levels/pacing.ts` over the first 45 s, boss at 40 s, a 10 s intro tour
before Ready. Levels 1–5 still ride trig loops (`curve1` / `curve2`); level 6 rides a v2 ride-kit spline.

| Level | Biome | Waves / finale | Landmarks / features | Director's read |
|---|---|---|---|---|
| 1 Theme Park | themePark | 3 × 50 balloons, **Golden Blimp** | Ferris wheel, carousel, midway, a tunnel set-piece (#649), fireworks, pickups; **Night Ride** at 3★ (#830) | The reference frame. The ride is a flat loop next to level 6's: first storyboard (#863). The Blimp is the last early boss below its brief (#872) |
| 2 Desert | desert | scorpions, crows in V, **sandstorm** wave, **Giant Scorpion** | Pyramid, arches, mesas, dust devils | Solid; ride flat (#864); Scorpion below brief (#873) |
| 3 Ocean | ocean | jellyfish, sharks (characters, #816), flying fish, **whale breach** at ~32 s, **Kraken** (a presence, #636) | Sunken city, sea stacks, water | The best-looking outdoor level now; ride flat (#865) |
| 4 Antarctica | arctic | scouts, snowmen, brutes, **blizzard** wave, **Yeti** | Ice fortress, aurora | Heaviest for draws; ride flat (#866); Yeti below brief (#873) |
| 5 Inferno | volcanic | wisps, imps, golems, drakes (characters), eruption, **Magma Titan** | Volcano, lava channels | Enemies are characters now; ride flat (#867, waits on #716) |
| 6 Climbing Gym | gym (interior) | rats, dust bunnies, lanternfly swarms, bystander climbers, **Medusa** | Alex's gym at `GYM_SCALE` 48, the Starr, the Flame's fire, the Tree's gap, the Training Area cave, the Arch, a V2 / V8 switch | Every 14 / 18 Nov note done; **waits on Alex's replay** (#671). The ride-kit ride: launch, heartline roll over the Flame, the cave, the switch, the wall lift, a dyno jump, the auto-belay drop, the Medusa helix |

Common flow: poster → title (the fair's front, the park to the horizon, attract mode; PLAY starts the
next unlocked level, WORLDS opens level select) → loading → intro tour → Ready / Set / GO in the seat →
play (fair-style HUD, radar, ghost crosshair of your best run) → results (fair board, win / lose music,
World / This-device / Daily boards, initials, Share). Pause has photo mode. Gamepad everywhere.

### Systems

- **Track**: trig loops (1–5) and v2 splines (6) through `createTrackCurve`; the ride kit
  (`src/track/elements/`, `rideV2.ts` solver, `mechanics.ts`, junctions, dark sections, tunnels,
  `rideComfort.ts`); far track hazes (#560); rides page `rides.html` (`turntable -- --rides`).
- **Environment**: per-biome modules; one owner for the scene fog (#801) plus aerial fog (#837); weather
  pulses (#799); Night Ride atmospheres keyed by biome (#829).
- **Enemies**: 17 types; crow, shark, drake, wisp, imp, golem and the gym's cast are characters;
  colour-blind checked by OKLab ΔE under deficiency (#838). Bosses: six, the Blimp, Scorpion and Yeti
  still below their briefs.
- **Audio**: one engine; picked themes for title and all six levels, boss sections and stings (#635),
  results cuts (#795; its Listen #794 waits on Alex), placed boss cues and per-biome reverb (#805).
- **Perf tooling**: `?perf=1` with the rAF / timers / outside split (#621); warm-up off visible frames
  (#626, #658); nightly `slow` part under cpu 4x and the programs-after-warm-up gate (#849).
- **Backend / telemetry**: leaderboard (campaign + Daily, #855); telemetry with a WebGPU field (#851),
  still dead until Alex runs `supabase/migrations/0002_telemetry.sql`.

## Numbers

NUMBERS_PLACEHOLDER

## Known bugs and visual problems (ranked)

1. **Production nightly red** (#707, P1): its last cause, the Medusa's crown snake out of view, is fixed
   on `main` (#857, #860); closes on the next green nightly.
2. **Bundle at the wall**: startup 436 / 436 KB gz; every feature last week bought +1 KB. #861 (P1)
   takes 20+ KB back; #862 gives each world its own chunk before levels 7–10.
3. **Stutter on a modest laptop** (#561 / #620, P1): waits on Alex's Neo re-run with the split recorder.
4. **Rides 1–5 are flat loops** beside level 6's storyboard (#863–#867).
5. **Flaky smoke step**: level 6's switch shot misses about half the time locally (#779, P1); the
   countdown check fails on 2 cores (#646 in #878).
6. The on-ride photo stalled a frame on CI and was closed after 3 rounds (#710); re-scoped onto photo
   mode's capture (#701).
7. Bosses below brief: Blimp (#872), Scorpion and Yeti (#873).
8. **Telemetry endpoint dead** until Alex runs the migration (`docs/TELEMETRY.md`).
9. P3 debts bundled this week: leaderboard (#874), share (#875), studio tooling (#876), enemy draws
   (#877), plus #335 / #336 / #339.

## Tech debt / architecture notes

- **One `LevelScene` chunk holds all six worlds** (158 KB gz): ten won't fit the experience on a phone
  (#862).
- Levels 1–5 are configured in `LevelRegistry.ts`; level 6 has its own track file. The storyboards move
  each level's ride beside its biome.
- Setup-heavy modules with per-frame functions not yet `*.hot.ts` (`krakenMotion`, `climbMotion`,
  `arcLength`, `ridePhysics`, `titleCoaster`, `windStreaks`): the hot-path rule can't see them.
- One React component + `useFrame` per enemy; `EnemySpawner.tsx` mixes timing, placement and rendering
  (#294, parked).
- `e2e/smoke.mjs` and `SharedEnemyAssets.ts` stay the files every builder touches.
- Two issues still carry the `studio-status` label (#57 and #78).

## Half-done / placeholders

- The ride kit's last pieces: storyboards for 1–5 (#863–#867), waves facing backwards (#716), the
  on-ride photo (#701).
- Level 7 Neon Metropolis (#322: #323 in progress, #324 / #325 / #871 wait on it, #868 its theme);
  level 8 Jungle Ruins (#869: #870 waits on #323).
- Verdicts waiting on Alex: level 6 (#671, #558, #583), the Neo (#561), results music (#794).
