# Vision — ShooterCoaster

_Owned by the Director. v1 written by the first Director run (2026-10-19); v2 on
2026-10-26 (M1 closed, M2 brought forward, launch-week framing); v3 on 2026-11-02 (M2
closing on two items, M3 opened a week early with the finales and Level 6, milestones on
GitHub); v4 on 2026-11-09 (M2 closed; Alex's playtest bar — 60 s runs, no spawn gaps, a big
title world — leads M3; Level 6 becomes the Climbing Gym built through a level kit,
`docs/LEVEL-KIT.md`; Neon Metropolis deferred; enemy art briefs in `docs/art/ENEMIES.md`); v4.1 on 2026-11-13
(Alex, #513: Level 6 is **his own climbing gym**, built from his blockout, with don't-shoot
climbers, rats / lanternflies / dust bunnies and the Medusa of the Starr); v5 on 2026-11-16 (Level 6
shipped; Alex's gym notes #558, the fire #583 and the MacBook Neo stutter #561 lead week 5; smooth on a
modest laptop moves into M3); v6 on 2026-11-23 (Alex, #610: **ten levels at the highest degree before
the first public post**; #703: every ride a thrill through the ride kit, `docs/RIDE-KIT.md`; M4 becomes
"Ten worlds, every ride a thrill"; Neon Metropolis returns as level 7; the idea backlog, emptied in week 5,
is rewritten).
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
- **Bundle**: `budgets.json` (665 KB gz total, 260 KB largest chunk, 436 KB startup; 700 KB total is
  the hard ceiling for ten worlds) is a ceiling, not a target. A world loads in its own chunk and never
  adds to startup.
- **The ride is a thrill** (`docs/RIDE-KIT.md`): every level's ride is a storyboard with a start, a drop,
  airtime, a near miss and an ending, inside the comfort limits (`rideComfort.ts`).

## Art direction per biome

| Level | Biome | Palette / sky | Hero landmark | Set-piece | Enemies (readability colour) |
|---|---|---|---|---|---|
| 1 Theme Park | themePark | Saturated greens, candy primaries; bright blue sky with soft clouds, warm sun | Ferris wheel, carousel, midway | Fireworks on combo streaks; passing under the wheel; **finale: the Golden Blimp** | Balloons (any bright), golden balloons |
| 2 Desert | desert | Gold dunes, red mesas; warm hazy sky, low orange sun, dust | Pyramid, rock arches, mesas | Sandstorm wave; dust devils; **finale: Giant Scorpion** | Scorpions (dark on gold), crows (black on pale sky) |
| 3 Ocean | ocean | Teal water, deep blue horizon; cool sky, sun shafts | Sunken city, sea stacks | Shark wave breaches; whale passing; **finale: Kraken tentacles** | Jellyfish (glowing), sharks (white belly), flying fish (silver) |
| 4 Antarctica | arctic | White/blue ice, violet shadows; pale cold sky, aurora | Ice fortress, glacier walls | Aurora intensifies with combo; blizzard wave; **finale: Yeti** | Snowmen (navy scarves/coal — never dark bodies on snow), brutes |
| 5 Inferno | volcanic | Obsidian black, lava orange; **dark ash sky with red underglow** (never daytime blue). Lava rivers, crater rim and rails glow so the frame reads even though it is dark | Volcano, lava rivers | Eruption: shake, fog pulse, ember rain; **finale: Magma Titan** | Wisps (glow), imps (orange), golems (cracked lava), drakes |
| 6 Climbing Gym (M3, #513) | gym (the first **interior** biome) | Alex's real gym from his blockout (`docs/levels/`): a tall white hall, steel trusses, strip lights, windows above the low walls; white / grey walls with painted bands (yellow / black at the Starr and the Shield, blue / purple waves at the south end, green outlines on the Tree), holds in every colour, grey mats, black rope zones with a red stripe, chalk in the air | The **Starr** (a yellow / black star over a sunken pit), the **Flame** boulder with realistic fire burning on it that lights the hall (#583), the **Tree** (a barked trunk on roots with a gap under it, becoming a headwall), the Arch, the glass gym room. **Much bigger than the blockout's first scale, grimy "spectacularly Bushwick", in low, moody light** (#558) | Four ride moments (#514): thread the Arch, spiral round the burning Flame, **through the Tree's gap** and skim the glass room, dive into the Starr pit; the ride as fast as Theme Park's; **finale: the Medusa of the Starr** (#521), snakes in her curly hair as weak points; bony, a strong jaw and a large defined nose, two jewels on the bridge (#558) | New York rats, dust bunnies (#515), spotted lanternflies flashing red (#516); **climbers are bystanders**: shooting one costs points and the combo (#518) |
| 7 Neon Metropolis (M4, #322) | city (night) | Deep indigo sky with a warm haze at the horizon, magenta / cyan neon, wet asphalt reflecting it, towers with lit windows | The hero tower and an elevated train line the track threads | Launch down an avenue, a lift up a tower's face, a drop between towers, a head-chopper under the train (#871); **finale: the Helicopter** (#325) | Hover drones (dark, cyan rims), billboard bots (magenta faces) |
| 8 Jungle Ruins (M4, #869) | jungle | Deep greens and wet stone, white-gold sky, valley mist, god rays | A stepped temple pyramid, a waterfall, rope bridges | Up the temple's stairs, a drop through the waterfall, the temple as a dark ride, a jump gap over a ravine; **finale: a temple guardian** | Toucans, spider swarms on the walls, carnivorous plants |
| 9–10 (M4, through the kit) | Sky Harbour, Haunted Mine (`docs/LEVEL-KIT.md` ranks them) | | | | |

**The title screen is a world too** (#436): the park must read as a big, expansive,
intricate theme park to the horizon — rides, a crossing coaster line, midway rows, crowds,
water, lights, layered skyline silhouettes in fog — never a green plain, and still fast from
the first paint (#376's poster and budgets). Enemy and boss looks follow `docs/art/ENEMIES.md`; everything drawn over or around the world (screens, HUD, share card, store art) follows `docs/art/PERSONALITY.md`, the game's own personality: the travelling fair's shooting gallery.

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

**Status 2026-11-23:** week 5 shipped everything Alex asked of the gym (#558, #671: twice the size at
`GYM_SCALE` 48, Bushwick grime and low light, the Tree's gap, the Medusa's bony face, a far more real
fire that lights the hall, padded floors, lanternflies you can see, the bystanders), rebuilt its ride with
the new ride kit (#696–#702, #726, #761), the boss sections in every theme (#635), the Kraken, Shark,
Drake and Inferno trio as characters, and the whole idea backlog. What M3 still waits on is **Alex**:
his `?perf=1` re-run on the Neo (#561, then #620) and his replay of level 6 (#671 / #558 / #583). It
closes when those verdicts are in; anything they send back is filed into M4.

Exit criteria:
- **Every run is 60 s** on one pacing template (waves → boss at ~40 s → the fight ends the
  run), every level and the Daily Run (#452); old long-run scores leave the boards (#458).
- **No level has a no-target gap over 3 s** outside the boss tell: the smoke measures it
  nightly and a budget holds it (#450, #451).
- **Every one of the five levels ends on a boss**: the Magma Titan (#320) joins the Blimp,
  Kraken, Scorpion and Yeti, designed for the 20 s window.
- **The title world** reads as a big, intricate theme park to the horizon (#454, #459),
  still fast from the first paint.
- **Level 6 is Alex's climbing gym** (#513, rewritten 13 Nov; DECISIONS "Level 6 from the
  blockout"), the first world built through the level kit (`docs/LEVEL-KIT.md`): his
  blockout as data and an authored track through the four ride moments (#514), the hall
  at landmark scale and the level playable (#517), rats, dust bunnies and lanternflies
  (#515, #516), climbers as bystanders, the game's first don't-shoot rule (#518), the
  Medusa finale (#521), the Flame's fire, the Tree and rugged walls (#520, #519), its theme
  round for Alex (#456), then the `npm run new-world` scaffold (#460). Done: the Climber,
  #514–#517, #519–#521, #456, #460. Left, from Alex's 14–15 Nov notes: the hall much bigger
  with the ride through the Tree's gap (#592), spectacularly Bushwick in low light (#593), a
  bonier Medusa (#594), fire Alex calls realistic (#595, #599; he closes #583), the
  bystanders (#518), lanternflies on the walls (#575), his theme pick wired in (#565 → #566).
- **Enemy art** (#381): the briefs exist (`docs/art/ENEMIES.md`) and the crow (done, #573),
  the Inferno trio (#463) and the Kraken (#600) are characters in one style with the Climber.
- **Smooth on a modest laptop** (Alex's MacBook Neo, #561): no stall bursts during play and
  no visible frame over ~250 ms in the countdown on his `?perf=1` re-run (#596, #597).
- Done: the Ocean looks like water (#430) and opens with enemies in view (#343); Inferno's
  lava lies in the ground (#331); far rails recede (#327); lint in CI with the repo's rules
  and the hot-path rule (#455, #461), the startup JS budget (#420).
- Audio (Alex's priority, largely done): intensity layers (#347), picked themes as defaults
  for the title and every level (#386, #421), one engine (#431). Left in M3: a boss section
  in every level's theme (#598) and the Gym's picked theme (#566); positional kill sounds go to
  the backlog (epic #212).
- Studio tooling that landed this week stays green: sharded PR smoke + nightly deep smoke,
  deploy health check, watchdog, telemetry (Alex still has to run
  `supabase/migrations/0002_telemetry.sql`).
- Measured: the Showcase week's funnel against the W44 baseline, once #102 is posted,
  decides the PLAY-straight-to-ride experiment (#329, blocked until then).

Deferred out of M3: Neon Metropolis (#322–#325, a kit-built world later), tunnels and the
loop (#332, P3), the swoop intro and results orbit (#328, P3).

### M4 — "Ten worlds, every ride a thrill" (from 23 Nov, due 8 Jan; GitHub milestone 3)

Alex, 18 Nov (#610): no public post "until the game is AAA. We need 10 levels at the highest degree."
Alex, 19 Nov (#703): the rides are "lackluster. Make it way more fun." So M4 is quantity at the bar,
not quantity instead of it.

Exit criteria:
- **Ten levels**, each at the quality bar above (its own silhouette, palette, sky, landmark, enemies
  drawn to `docs/art/ENEMIES.md`, a set-piece, a boss finale, its own theme Alex picked), all on the
  60 s pacing template, perf gate and pacing budgets green. Levels 7 Neon Metropolis (#322) and 8
  Jungle Ruins (#869) first; 9 and 10 from `docs/LEVEL-KIT.md`'s ranking (Sky Harbour, Haunted Mine).
  Night Ride variants don't count.
- **Every ride a thrill**: levels 1–6 and every new world ridden as a ride-kit storyboard (start,
  drop, airtime, near miss, ending; #863–#867, #871), inside `rideComfort.ts`'s limits.
- **The on-ride photo** on the score card (#701).
- **Worlds load in their own chunks** (#862) and the startup JS goes down, not up (#861).
- Bosses all to their briefs (the Blimp #872, the Scorpion and the Yeti #873).
- Smooth on a modest laptop holds as worlds are added: the nightly `slow` part has a long-frame
  ceiling (#848) and the Neo verdict from M3 holds.
- Carried from the old M4: remappable input, PWA install and offline play, 60 fps on a 2020
  mid-range phone at dpr 1.5 from real telemetry (once Alex's telemetry migration runs), WebGPU only
  on real data (the capability event shipped, #851) and behind a flag (rule 7).

## Idea backlog (pre-approved; builders may pull from the top when `agent:ready` is empty)

Ranked. Each must still be filed as an issue by whoever picks it up, following the
issue contract in PROTOCOL.md, with the milestone set. Items filed as issues are not
repeated here. Week 5 shipped or filed every item of the previous list (results cuts, the
throttled nightly, the whale, weather waves, boss cues placed, shark and drake art, gamepad,
photo mode, Night Ride for level 1, the radar, aerial fog, the loading screen, colour-blind
palettes, ghost replay, the WebGPU event, the Daily Run board).

1. **Night Ride for levels 4–6** — after #880 (Desert, Ocean) sets the pattern; one issue.
2. **Medals for new worlds** — each world adds its three to `medals.ts` once #879 lands.
3. **Phone haptics** — `navigator.vibrate` on kill, boss weak point and boss defeat, off in
   Settings and under reduced motion.
4. **Remappable input** — keyboard and gamepad bindings in Settings, saved locally.
5. **PWA install + offline play** — a service worker that caches the hashed assets (never the
   `api/` calls), the manifest's install prompt from the title.
6. **Boss rush** — every boss back to back, unlocked when every level has 3★; a local best.
7. **Spatial chunking + fog-distance cut** for whole-level InstancedMeshes; only if a world can't
   hold 250 draws by batching alone.
8. **The Blender spike** (#381 step 4) — one enemy from a Blender script, with a recorded adopt /
   don't-adopt decision.
9. **Daily Run ghost** — today's World best as a ghost crosshair (needs a column; Alex runs the
   migration).

Not doing (from the slop-newyork review, #126): unpinned three.js from a CDN,
city-scale geodata, SSR / clustered lighting / cascaded shadows, leaf-card trees, FFT
water, the Preetham sky.
