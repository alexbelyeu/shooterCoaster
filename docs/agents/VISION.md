# Vision — ShooterCoaster

_Owned by the Director. v1 written by the first Director run (2026-10-19); v2 on
2026-10-26 (M1 closed, M2 brought forward, launch-week framing); v3 on 2026-11-02 (M2
closing on two items, M3 opened a week early with the finales and Level 6, milestones on
GitHub); v4 on 2026-11-09 (M2 closed; Alex's playtest bar — 60 s runs, no spawn gaps, a big
title world — leads M3; Level 6 becomes the Climbing Gym built through a level kit,
`docs/LEVEL-KIT.md`; Neon Metropolis deferred; enemy art briefs in `docs/art/ENEMIES.md`).
Rewritten or amended weekly; direction changes are logged in DECISIONS.md._

## Elevator pitch

A rollercoaster ride through spectacular themed worlds where you blast everything
that moves. Instantly playable in a browser, gorgeous in motion, tight arcade
scoring that makes you want "one more run". Think *House of the Dead* pacing on a
*Planet Coaster* ride, drawn like a stylised low-poly diorama.

## What "AAA" means here

Not photorealism and not asset packs. **Cohesion, polish and feel** within a
code-generated, flat-shaded, saturated look:

- Every frame could be a wallpaper: deliberate palette per biome, a sky that belongs
  to that biome, fog that matches the horizon, a sun that lights the scene.
- Nothing reads as "programmer art": no hexagonal sticks, no thin-wire tracks, no
  black blobs for enemies, no empty plains, no z-fighting.
- Every input has feedback within one frame: muzzle flash, hitmarker, enemy hit
  flash, pop, popup, sound, combo meter. Shooting must feel *great* before anything
  else matters.
- The ride is a character: speed, drops, banking, structure whooshing past.
- **A run has a shape, and it is 60 seconds long.** Every level, every mode (Alex, 8 Nov):
  waves *arrive* from the first second, there is almost never a moment with nothing to
  shoot, the pace rises, the boss arrives around two thirds in and the fight ends the run —
  never a timer quietly reaching zero. Theme Park's density ("it always seems like you could
  hit most of them") is the bar every level is measured against (the smoke's `pacing`
  metric: no-target share and longest gap, #450).

## Pillars

1. **Spectacle in motion** — speed, drops and set-pieces; every biome has landmarks
   and moments you remember (the volcano erupting, the Ferris wheel passing overhead,
   the aurora over the ice fortress).
2. **Juicy, readable shooting** — enemies pop against the scenery; every hit has
   feedback (flash, particles, audio, combo escalation, slow-mo on streaks).
3. **Arcade mastery** — scores, stars, combos, accuracy, local leaderboards, a daily
   seeded run, ghosts later; short runs (60–120 s) with high replay value.
4. **Cohesive stylised look** — code-generated geometry, shaders and post-processing
   with a strong art direction per biome; polish over realism.
5. **Runs everywhere** — smooth on a mid-range laptop and on phones (touch), fast to
   load, no blank screens.

## Quality bar (checked by QA on every PR)

- **First 30 seconds**: title → riding → first kill must feel instant and
  impressive. No blank canvas, no hitch on the first shot, music under the ride.
- **No screenshot-worthy bugs**: floating props, z-fighting, empty stretches,
  invisible or unreadable enemies, blown-out skies, geometry clipping the camera.
- **Each level** has a distinct silhouette, palette, sky, enemies, landmark, music
  and at least one set-piece moment.
- **Readable in the dark too**: on Inferno (and any night level later) the track, the
  landmark silhouette and every enemy must be identifiable in the 10 s ride
  screenshot without raising the exposure of the whole frame. Emissive edges and
  rim light, not a brighter sky.
- **Per-frame budget**: ≤ 250 draw calls, ≤ 250k triangles per level on the smoke
  test; no per-frame allocations in hot paths; everything created is disposed.
- **Bundle**: `budgets.json` (700 KB gz total, 260 KB largest chunk) is a ceiling,
  not a target.

## Art direction per biome

| Level | Biome | Palette / sky | Hero landmark | Set-piece | Enemies (readability colour) |
|---|---|---|---|---|---|
| 1 Theme Park | themePark | Saturated greens, candy primaries; bright blue sky with soft clouds, warm sun | Ferris wheel, carousel, midway | Fireworks on combo streaks; passing under the wheel; **finale: the Golden Blimp** | Balloons (any bright), golden balloons |
| 2 Desert | desert | Gold dunes, red mesas; warm hazy sky, low orange sun, dust | Pyramid, rock arches, mesas | Sandstorm wave; dust devils; **finale: Giant Scorpion** | Scorpions (dark on gold), crows (black on pale sky) |
| 3 Ocean | ocean | Teal water, deep blue horizon; cool sky, sun shafts | Sunken city, sea stacks | Shark wave breaches; whale passing; **finale: Kraken tentacles** | Jellyfish (glowing), sharks (white belly), flying fish (silver) |
| 4 Antarctica | arctic | White/blue ice, violet shadows; pale cold sky, aurora | Ice fortress, glacier walls | Aurora intensifies with combo; blizzard wave; **finale: Yeti** | Snowmen (navy scarves/coal — never dark bodies on snow), brutes |
| 5 Inferno | volcanic | Obsidian black, lava orange; **dark ash sky with red underglow** (never daytime blue). Lava rivers, crater rim and rails glow so the frame reads even though it is dark | Volcano, lava rivers | Eruption: shake, fog pulse, ember rain; **finale: Magma Titan** | Wisps (glow), imps (orange), golems (cracked lava), drakes |
| 6 Climbing Gym (M3, #457) | gym (the first **interior** biome) | Bright hall: warm skylight sun + cool fill, pale grey walls, holds in six saturated colours, chalk dust in the air, fog for depth | Huge sport-climbing walls with overhangs and arêtes, a bouldering zone on padded floors, catwalks, skylights | The track climbs a wall and crosses the hall at catwalk height; the last wave's "Top-out!" sprint; boss TBD (Director's call after the slice) | Climber figurines (orange / cyan helmets and harnesses, white chalk bags) on the walls, boulderers below — toy-like, nothing graphic |
| 7+ (candidates, through the level kit) | Neon Metropolis (city, night; drones, billboard bots, helicopter; #322), Jungle Ruins, Sky Harbour, Haunted Mine, Night Ride variants | | | | |

**The title screen is a world too** (#436): the park must read as a big, expansive,
intricate theme park to the horizon — rides, a crossing coaster line, midway rows, crowds,
water, lights, layered skyline silhouettes in fog — never a green plain, and still fast from
the first paint (#376's poster and budgets). Enemy and boss looks follow `docs/art/ENEMIES.md`.

Rules of thumb: enemies must contrast with *both* terrain and sky from the camera's
usual angle; fog colour equals the sky's horizon colour; the sun colour tints
highlights; landmarks are 2× the size that feels right on paper
(see `.claude/skills/shooter-coaster-level-design`).

## Roadmap

The roadmap runs as **GitHub milestones** (Alex, #192): this file keeps each milestone's
exit criteria; the milestone on GitHub is its issue set and progress bar. The Director
owns both (PROTOCOL.md "Milestones").

### M1 — "Looks and feels like a game" — **done 2026-10-26** (one week)

Every exit criterion is met on `main` @ 51a5165: per-biome sky dome, lighting, fog,
colour grade and baked environment map (Inferno is dark); lattice towers and scaled
rails; readable enemies (rim light, white snowmen, readable-spawn rule); muzzle flash,
hitmarker, hit flash, rotation-only kick, first-person gun; HUD, results and level
select redesigned; touch end-to-end with aim assist; combat + results + mobile
screenshots in the smoke; per-biome modules; 36 vitest files. The one leftover,
death variety (#29), moves into M2.

### M2 — "The arcade loop and the finale" — **done 2026-11-09** (weeks 2–3; GitHub milestone 1, closed)

Every exit criterion is on `main`: combo tiers with FRENZY slow-mo on game time; waves in
formations with a tell and a death style per enemy; the boss framework with the Golden
Blimp and the Kraken (and, since, the Giant Scorpion #348 and the Yeti #441); fireworks on
streaks; Inferno readable in the dark; a pause that freezes the run, settings, adaptive dpr;
the local leaderboard with initials (#346) and the Daily Run; weapon pickups; the smoke
green on `main` with a per-level perf gate (#305, #364, #372); `npm run clip`, the share
button and card, `/go/` paths, indexable text. One day over its 8 Nov due date. Week 2
(26 Oct – 1 Nov) was launch week in name only: the Showcase post (#102) is still in Alex's
hands.

### M3 — "Depth and spectacle" (weeks 3–7, 2 Nov – 5 Dec; GitHub milestone 2)

**Status 2026-11-09:** week 3 landed two finales (Scorpion, Yeti), the Ocean's water, the
title coaster, the online board, the score card and Alex's picked themes on one engine
(Tone.js gone). Alex's own playtest (#439) then set the bar for the rest of M3, and it
changes what Level 6 is: the exit criteria below are **rewritten** (DECISIONS "Week 4").
Week 4 (9–15 Nov) is **his bar first**: 60 s runs, no spawn gaps, the title world, the
Climber; then the Gym.

Exit criteria:
- **Every run is 60 s** on one pacing template (waves → boss at ~40 s → the fight ends the
  run), every level and the Daily Run (#452); old long-run scores leave the boards (#458).
- **No level has a no-target gap over 3 s** outside the boss tell: the smoke measures it
  nightly and a budget holds it (#450, #451).
- **Every one of the five levels ends on a boss**: the Magma Titan (#320) joins the Blimp,
  Kraken, Scorpion and Yeti, designed for the 20 s window.
- **The title world** reads as a big, intricate theme park to the horizon (#454, #459),
  still fast from the first paint.
- **Level 6 is the Climbing Gym**, the first world built through the level kit
  (`docs/LEVEL-KIT.md`): the Climber and the `wall` surface (#453), the interior biome and
  the playable slice (#457), its theme round for Alex (#456), the `npm run new-world`
  scaffold (#460). Its boss and boulderers follow once the slice ships.
- **Enemy art** (#381): the briefs exist (`docs/art/ENEMIES.md`) and the crow and the
  Inferno trio are characters (#462, #463) in one style with the Climber.
- The Ocean looks like water (done, #430) and opens with enemies in view (done, #343);
  Inferno's lava lies in the ground (#331); far rails recede (#327).
- **Lint in CI** (#351): ESLint with the repo's own rules in `verify` (#455), the hot-path
  no-allocation rule (#461); the startup JS budget exists (done, #420).
- Audio (Alex's priority, largely done): intensity layers (#347), picked themes as defaults
  for the title and every level (#386, #421), one engine (#431). Left in M3: boss / results
  variations and positional kill sounds on the arcade engine (epic #212).
- Studio tooling that landed this week stays green: sharded PR smoke + nightly deep smoke,
  deploy health check, watchdog, telemetry (Alex still has to run
  `supabase/migrations/0002_telemetry.sql`).
- Measured: the Showcase week's funnel against the W44 baseline, once #102 is posted,
  decides the PLAY-straight-to-ride experiment (#329, blocked until then).

Deferred out of M3: Neon Metropolis (#322–#325, a kit-built world later), tunnels and the
loop (#332, P3), the swoop intro and results orbit (#328, P3).

### M4 — "Many worlds, ship quality" (after M3)

- Worlds through the kit: Neon Metropolis, Jungle Ruins, Sky Harbour, Haunted Mine, Night
  Ride variants (`docs/LEVEL-KIT.md` ranks them); the Gym's boss and boulderers if they
  slip; procedural track variants per world once the pacing metric trusts the generator.
- Enemy art: the remaining enemies and the bosses to the briefs; the Blender spike
  (#381 step 4) with a recorded adopt / don't-adopt decision.
- Accessibility (colour-blind safe enemy palettes, remappable input), PWA install, offline
  play, a loading screen.
- Performance: 60 fps on a 2020 mid-range phone at dpr 1.5, read from real telemetry.
- WebGPU only when the anonymous capability event shows a large share and the post stack
  has a WebGPU path — behind a flag (rule 7).

## Idea backlog (pre-approved; builders may pull from the top when `agent:ready` is empty)

Ranked. Each must still be filed as an issue by whoever picks it up, following the
issue contract in PROTOCOL.md, with the milestone set. Items filed as issues this week are
not repeated here (the pacing metric and fix, the 60 s template, the Climber and the Gym,
the title park and world, the kit scaffold, the crow and Inferno trio, lint).

1. **Gym boss** — the Director's call after #457 ships; candidates: a giant climber
   figurine on the hardest overhang whose chalk bag, two hands and helmet are the weak
   points, exposed as it moves between holds; or a belayer duo at the base. Reuses the
   boss framework's retract + projectiles (#319).
2. **Boulderers** — the Gym's second enemy: dynos and falls onto pads, re-climbs
   (`docs/art/ENEMIES.md`).
3. **Kraken presence pass** — thicker, darker tentacles with bright sucker pads, a bigger
   head, a splash that reaches the camera; same spec and framework (brief in ENEMIES.md).
4. **Boss music variations** — each level's theme gets a darker, louder boss section the
   player switches to on `boss:spawn` (sound bible "Boss / finale" row), on the layers
   engine. `type:audio`.
5. **Whale set-piece (Ocean)** — a huge low-poly whale breaches across the track at ~30 s;
   camera shake, splash particles. Scenery, not a target.
6. **Blizzard / sandstorm waves** — a weather pulse (fog near distance + particle burst)
   tied to one wave per level; readability must survive it; the pacing metric must not
   regress.
7. **Positional kill and hit sounds on the arcade engine** — every hit / kill / boss cue
   placed by world position, plus per-biome acoustics send tuning (desert slapback, open
   sea, cavernous Inferno, the Gym's hall).
8. **Shark + Infernal Drake art pass** — next two from the briefs after #462 / #463.
9. **Gamepad** — right stick as a virtual cursor, RT fire, Start pause, A/B in menus.
10. **Photo mode** — pause, hide the HUD, orbit + zoom, PNG save; feeds the Marketer's
    share images.
11. **Night Ride variants** — the same level with a night lighting / grade preset and
    emissive props; selectable from the level card once the level has 3★.
12. **Track-progress radar** — a cached offscreen-canvas minimap of the track with the
    coaster and enemies as dots; hidden in portrait.
13. **Fog tinted by the sky in the view direction** — one shared `onBeforeCompile` helper
    (touches every material; measure first).
14. **Spatial chunking + fog-distance cut** for whole-level InstancedMeshes; only if a
    kit-built world can't hold 250 draws by batching alone.
15. **Loading screen** — branded progress on boot (the per-level warm-up already runs
    behind the countdown; the title poster covers the cold load).
16. **Colour-blind safe enemy palettes** — verified for deuteranopia.
17. **Ghost replay (local)** — record aim / fire timeline, replay as a translucent crosshair.
18. **WebGPU capability event** — one anonymous `webgpu: yes/no` telemetry field per
    visitor, so the renderer decision can be made on real data.
19. **Daily Run leaderboard** — a World board per UTC day on the existing API (the
    `scores` table gains a `day` column; Alex runs the migration).

Not doing (from the slop-newyork review, #126): unpinned three.js from a CDN,
city-scale geodata, SSR / clustered lighting / cascaded shadows, leaf-card trees, FFT
water, the Preetham sky.
