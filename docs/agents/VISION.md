# Vision — ShooterCoaster

_Owned by the Director. v1 written by the first Director run (2026-10-19); v2 on
2026-10-26 (M1 closed, M2 brought forward, launch-week framing). Rewritten or amended
weekly; direction changes are logged in DECISIONS.md._

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

### M1 — "Looks and feels like a game" — **done 2026-10-26** (one week)

Every exit criterion is met on `main` @ 51a5165: per-biome sky dome, lighting, fog,
colour grade and baked environment map (Inferno is dark); lattice towers and scaled
rails; readable enemies (rim light, white snowmen, readable-spawn rule); muzzle flash,
hitmarker, hit flash, rotation-only kick, first-person gun; HUD, results and level
select redesigned; touch end-to-end with aim assist; combat + results + mobile
screenshots in the smoke; per-biome modules; 36 vitest files. The one leftover,
death variety (#29), moves into M2.

### M2 — "The arcade loop and the finale" (weeks 2–3, ends ~2026-11-08)

**Week 2 (26 Oct – 1 Nov) is launch week**: the first public post (three.js Showcase,
Mon 2 Nov) goes out at the end of it, so everything that lands must make the *first
run on Theme Park* better and nothing may make `main` less stable.

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

### M3 — "Depth and spectacle" (weeks 4–7)

- Level 6 **Neon Metropolis** as a full vertical slice (new biome, enemies, helicopter
  boss, synthwave music), then levels 7–8 (candidates: Jungle Ruins, Sky Harbour,
  Haunted Mine).
- The remaining finales (Giant Scorpion, Yeti, Magma Titan).
- Track set-pieces: tunnels, loops with camera roll, drops with FOV kick and speed lines.
- "Night Ride" variants of existing levels (time-of-day lighting + grade presets).
- Positional audio, per-biome acoustics, a wind/speed bed; gamepad; photo mode; a drone
  orbit behind the results screen.
- Weather and ambient particle fields everywhere; fog tinted by the sky in the view
  direction; spatial chunking + fog-distance cut for whole-level instanced meshes.
- Portal build (itch.io / Newgrounds / CrazyGames); ghost replays (local) and, if Alex
  approves a backend, online leaderboards.
- Lazy-load Tone.js; code-split per-level chunks; loading screen.

### M4 — "Ship quality" (ongoing after M3)

- Accessibility (reduced motion, colour-blind safe enemy palettes, remappable input).
- PWA install, offline play, share-a-run screenshot.
- Performance: 60 fps on a 2020 mid-range phone at dpr 1.5.
- WebGPU only when the anonymous capability event shows a large share and the post
  stack has a WebGPU path — behind a flag (rule 7).

## Idea backlog (pre-approved; builders may pull from the top when `agent:ready` is empty)

Ranked. Each must still be filed as an issue by whoever picks it up, following the
issue contract in PROTOCOL.md. Items that are already filed as issues this week are
not repeated here (bosses for Theme Park and Ocean, fireworks, combo tiers,
choreography, death variety, pickups, leaderboard, daily run, pause, settings,
positional SFX, gamepad, photo mode, drone orbit, perf gate, lazy Tone).

1. **Giant Scorpion finale (Desert)** — rises from the dunes at the last wave;
   weak point: the tail stinger; segments break off per hit.
2. **Yeti finale (Antarctica)** — hurls snowballs that must be shot down; weak point
   the chest when it roars.
3. **Magma Titan finale (Inferno)** — climbs out of the lava river on the final
   eruption; cracks glow brighter as HP drops.
4. **Whale set-piece (Ocean)** — a huge low-poly whale breaches across the track at
   ~40 s; camera shake, splash particles.
5. **Blizzard / sandstorm waves** — a weather pulse (fog near distance + particle
   burst) tied to one wave per level; readability must survive it.
6. **Level 6: Neon Metropolis** — street canyons on a procedural grid, instanced
   traffic as scenery, emissive signage, hover drones and billboard bots, helicopter
   boss, synthwave music (merges the earlier "Neon Night City" with Alex's city idea).
7. **Track set-pieces** — tunnel segments (instanced arches with interior lights),
   loop-the-loop curve type with camera roll.
8. **Night Ride variants** — the same level with a night lighting/grade preset and
   emissive props; selectable from the level card once the level has 3★.
9. **Track-progress radar** — a cached offscreen-canvas minimap of the track with the
   coaster and enemies as dots; hidden in portrait.
10. **Fog tinted by the sky in the view direction** — GLSL patch applied through one
    shared `onBeforeCompile` helper (touches every material; measure first).
11. **Spatial chunking + fog-distance cut** for whole-level InstancedMeshes; only
    after `sceneStats()` shows a level over budget.
12. **Per-biome acoustics** — one procedural impulse response + convolver send
    (desert slapback, dry open sea, cavernous Inferno).
13. **Wind/speed bed with gust modulation** replacing the per-frame `rampTo` whoosh.
14. **Baked one-shot SFX buffers + voice budget** — bake kits to AudioBuffers at
    `prepareLevelSFX`, play each trigger as a native `AudioBufferSourceNode`; priority
    stealing, device-aware voice limits. Changes the "no Tone nodes in play functions"
    rule, so it needs a decisions-inbox entry. After launch.
15. **Level 7: Jungle Ruins** — mist, temples, vines, toucans and spider swarms.
16. **Level 8: Sky Harbour** — floating islands, airships, cloud layer below the track.
17. **Loading screen** — branded progress on boot (the per-level warm-up already runs
    behind the countdown).
18. **Reduced-motion & colour-blind modes** — settings toggles; enemy palettes
    verified for deuteranopia.
19. **Share screenshot** — results screen button renders a branded PNG of the final frame.
20. **Ghost replay (local)** — record aim/fire timeline, replay as a translucent crosshair.
21. **WebGPU capability event** — one anonymous `webgpu: yes/no` analytics event per
    visitor after launch, so the renderer decision can be made on real data.
22. **Online leaderboard** — **needs Alex's decision on a backend** (rule 4: no new paid
    services). Candidates: Vercel KV / Supabase free tier.

Not doing (from the slop-newyork review, #126): unpinned three.js from a CDN,
city-scale geodata, SSR / clustered lighting / cascaded shadows, leaf-card trees, FFT
water, the Preetham sky.
