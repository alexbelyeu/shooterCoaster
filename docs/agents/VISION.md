# Vision — ShooterCoaster

_Owned by the Director. v1 written by the first Director run (2026-10-19); v2 on
2026-10-26 (M1 closed, M2 brought forward, launch-week framing); v3 on 2026-11-02 (M2
closing on two items, M3 opened a week early with the finales and Level 6, milestones on
GitHub). Rewritten or amended weekly; direction changes are logged in DECISIONS.md._

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
- **A run has a shape.** Waves *arrive* rather than appear, the pace rises, and every
  level ends on a moment you remember (a boss, an eruption, a breach) — not on a
  timer quietly reaching zero.

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
| 6 Neon Metropolis (M3) | city | Night; deep indigo sky, neon magenta/cyan signage, wet-asphalt reflections | Street canyons, a skyline, an elevated highway the track threads through | Helicopter boss (tilt/bob), traffic as scenery | Hover drones (cyan rims), billboard bots (magenta), the helicopter |
| 7+ (candidates) | see roadmap | | | | |

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

### M2 — "The arcade loop and the finale" (weeks 2–3, due 2026-11-08; GitHub milestone 1)

**Status 2026-11-02:** every criterion below is on `main` except two: the local
leaderboard (#317, the finished branch re-landed on today's `main`) and a smoke that is
green on `main` (#305 / PR #312 with #316, the Ocean opening). CI is red for a runner-image
reason (#311 / PR #313). M2 closes when those merge; the Director closes the milestone.

Week 2 (26 Oct – 1 Nov) was launch week: 54 code PRs landed and the first public post
(three.js Showcase, #102) is in Alex's hands on Mon 2 Nov.

Exit criteria:
- Combo tiers with break feedback and slow-mo at the top tier; the window runs on
  game time.
- Waves arrive in formations with a tell; every enemy type dies differently.
- A **boss framework** (multi-hit, weak points, HP bar, tell, reward) with the Theme
  Park and Ocean finales shipped; the other three finales are filed and ranked.
- Fireworks on streaks in the Theme Park (the clip level).
- Inferno readable in the dark (track, volcano, enemies) without a brighter frame.
- Pause menu that really freezes the run; graphics/audio settings; adaptive dpr.
- Local leaderboards (top 10 per level, initials) and a daily seeded run.
- Weapon pickups (spread, rapid, piercing) with clear visuals and audio.
- Smoke no longer flakes on 2-core sessions; CI `verify` runs on `main`; a perf gate
  on `sceneStats()` per level.
- Launch tooling: `npm run clip`, share button, `/go/` campaign paths, indexable text.

### M3 — "Depth and spectacle" (weeks 3–7, 2 Nov – 6 Dec; GitHub milestone 2)

Opened a week early on 2026-11-02 because M2's content was done and the queue needed
player-facing work. Week 3 (2–8 Nov) is **finales + the Ocean + the first city slice**;
every merged PR must still leave the game better on its own (the Showcase thread is live
this week).

Exit criteria:
- Every one of the five levels ends on a boss: Giant Scorpion (#318), Yeti (#319), Magma
  Titan (#320) join the Blimp and the Kraken.
- Level 6 **Neon Metropolis** as a full vertical slice (epic #322: city biome + drones #323,
  traffic + billboard bots #324, helicopter boss #325, a synthwave score). Levels 7–8
  (Jungle Ruins, Sky Harbour, Haunted Mine) are M4 candidates.
- The Ocean looks like water (#326) and opens with enemies in view (#316); Inferno's lava
  lies in the ground (#331); far rails recede (#327).
- Track set-pieces: tunnels with interior lights and a loop with camera roll (#332); a swoop
  intro and a results orbit (#328).
- Audio (Alex's priority): the score engine has intensity layers driven by the combo
  (#321), Alex's picked themes are the defaults (#302), levels 2–5 have picked themes
  (#303), boss / results variations, and Tone.js is gone at parity (epic #212).
- Levels 4 and 5 under the 250 draw-call bar (#260); the smoke green on `main` three days
  running.
- Portal listings live (itch.io first; #307 makes the zip downloadable); the share menu
  (#271) and a share image (#272).
- Measured: the Showcase week's start rate against the W44 baseline decides the
  PLAY-straight-to-ride experiment (#329, held until 9 Nov).

Also in M3 when the above is on track: "Night Ride" variants; positional audio and
per-biome acoustics on the new engine; gamepad; photo mode; weather pulses (blizzard,
sandstorm); fog tinted by the sky in the view direction; spatial chunking + fog-distance
cut for whole-level instanced meshes; ghost replays (local); online leaderboards only if
Alex approves a backend; a loading screen.

### M4 — "Ship quality" (ongoing after M3)

- Accessibility (reduced motion, colour-blind safe enemy palettes, remappable input).
- PWA install, offline play, share-a-run screenshot.
- Performance: 60 fps on a 2020 mid-range phone at dpr 1.5.
- WebGPU only when the anonymous capability event shows a large share and the post
  stack has a WebGPU path — behind a flag (rule 7).

## Idea backlog (pre-approved; builders may pull from the top when `agent:ready` is empty)

Ranked. Each must still be filed as an issue by whoever picks it up, following the
issue contract in PROTOCOL.md, with the milestone set. Items filed as issues this week are
not repeated here (the three finales, Level 6's children, Ocean water, far rails, the
lava wall, swoop + orbit, tunnels + loop, audio layers, PLAY-to-ride, milestone tooling).

1. **Kraken presence pass** — the tentacles read as thin pale hooks in the rails' blue
   (`level3-boss.png`): thicker, darker tentacles with bright sucker pads, a bigger head,
   a splash that reaches the camera; same spec and framework, no new mechanics.
2. **Boss music variations** — on the score engine, each level's theme gets a darker,
   louder boss section that the player switches to on `boss:spawn` (sound bible "Boss /
   finale" row); after the layers issue (#321). `type:audio`.
3. **Whale set-piece (Ocean)** — a huge low-poly whale breaches across the track at
   ~30 s; camera shake, splash particles. Scenery, not a target.
4. **Blizzard / sandstorm waves** — a weather pulse (fog near distance + particle burst)
   tied to one wave per level (Antarctica's brutes, Desert's second crows); readability
   must survive it.
5. **Positional kill and hit sounds on the arcade engine** — the engine already pans and
   low-passes by world position; make every hit / kill / boss cue use it, and add the
   per-biome acoustics send tuning (desert slapback, open sea, cavernous Inferno).
6. **Gamepad** — right stick as a virtual cursor, RT fire, Start pause, A/B in menus
   (~60 lines, dead zone + analog triggers + edge suppression).
7. **Photo mode** — pause, hide the HUD, orbit + zoom, PNG save; feeds the Marketer's
   share images (after #272).
8. **Night Ride variants** — the same level with a night lighting/grade preset and
   emissive props; selectable from the level card once the level has 3★. Start from
   Neon Metropolis's night atmosphere.
9. **Track-progress radar** — a cached offscreen-canvas minimap of the track with the
   coaster and enemies as dots; hidden in portrait.
10. **Fog tinted by the sky in the view direction** — GLSL patch applied through one
    shared `onBeforeCompile` helper (touches every material; measure first).
11. **Spatial chunking + fog-distance cut** for whole-level InstancedMeshes; only
    after #260 shows batching alone can't hold levels 4–5 under 250 draws.
12. **Level 7: Jungle Ruins** — mist, temples, vines, toucans and spider swarms (M4).
13. **Level 8: Sky Harbour** — floating islands, airships, cloud layer below the track (M4).
14. **Loading screen** — branded progress on boot (the per-level warm-up already runs
    behind the countdown).
15. **Colour-blind safe enemy palettes** — verified for deuteranopia (reduced motion exists).
16. **Ghost replay (local)** — record aim/fire timeline, replay as a translucent crosshair.
17. **WebGPU capability event** — one anonymous `webgpu: yes/no` analytics event per
    visitor, so the renderer decision can be made on real data.
18. **Online leaderboard** — **needs Alex's decision on a backend** (rule 4: no new paid
    services). Candidates: Vercel KV / Supabase free tier.
19. **Remove Tone.js** — once every level, the title and the results play on the score
    engine within the sound bible's targets (epic #212's last child).

Not doing (from the slop-newyork review, #126): unpinned three.js from a CDN,
city-scale geodata, SSR / clustered lighting / cascaded shadows, leaf-card trees, FFT
water, the Preetham sky.
