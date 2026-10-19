# Vision — ShooterCoaster

_Owned by the Director. v1 written by the first Director run (2026-10-19). Rewritten
or amended weekly; direction changes are logged in DECISIONS.md._

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
- **Per-frame budget**: ≤ 250 draw calls, ≤ 250k triangles per level on the smoke
  test; no per-frame allocations in hot paths; everything created is disposed.
- **Bundle**: `budgets.json` (700 KB gz total, 260 KB largest chunk) is a ceiling,
  not a target.

## Art direction per biome

| Level | Biome | Palette / sky | Hero landmark | Set-piece | Enemies (readability colour) |
|---|---|---|---|---|---|
| 1 Theme Park | themePark | Saturated greens, candy primaries; bright blue sky with soft clouds, warm sun | Ferris wheel, carousel | Fireworks on combo streaks; passing under the wheel | Balloons (any bright), golden balloons |
| 2 Desert | desert | Gold dunes, red mesas; warm hazy sky, low orange sun, dust | Pyramid, rock arches | Sandstorm wave; dust devils | Scorpions (dark on gold), crows (black on pale sky) |
| 3 Ocean | ocean | Teal water, deep blue horizon; cool sky, sun shafts | Sunken city, sea stacks | Shark wave breaches; whale passing | Jellyfish (glowing), sharks (white belly), flying fish (silver) |
| 4 Antarctica | arctic | White/blue ice, violet shadows; pale cold sky, aurora | Ice fortress, glacier walls | Aurora intensifies with combo; blizzard wave | Snowmen (navy scarves/coal — never dark bodies on snow), brutes |
| 5 Inferno | volcanic | Obsidian black, lava orange; **dark ash sky with red underglow** (never daytime blue) | Volcano, lava rivers | Eruption: shake, fog pulse, ember rain | Wisps (glow), imps (orange), golems (cracked lava), drakes |
| 6+ (planned) | see roadmap | | | | |

Rules of thumb: enemies must contrast with *both* terrain and sky from the camera's
usual angle; fog colour equals the sky's horizon colour; the sun colour tints
highlights; landmarks are 2× the size that feels right on paper
(see `.claude/skills/shooter-coaster-level-design`).

## Roadmap

### M1 — "Looks and feels like a game" (weeks 1–2, ends ~2026-11-02)

Exit criteria:
- Every level has a per-biome sky, lighting, fog and exposure; Inferno is dark.
- The track reads as a rollercoaster structure (lattice supports, tie beams, rails
  with proper thickness), not wire.
- Enemies are readable at spawn distance on every level (rim light / contrast rules).
- Shooting has muzzle flash, hitmarker, enemy hit flash, screen kick, death variety.
- HUD redesigned; results screen shows stars, accuracy, best combo; level select
  looks designed.
- Touch works end-to-end (title → level → results) on a phone-sized viewport.
- Smoke test captures a *combat* screenshot per level (kills, explosions, popups).
- `BiomeEnvironment.tsx` split per biome; vitest covers pure modules.

### M2 — "The arcade loop" (weeks 3–4)

Exit criteria:
- Combo system with tiers, break feedback, slow-mo rewards; accuracy and streak
  milestones announced.
- Each level has a mini-boss or a wave set-piece with a tell.
- Weapon variety via pickups (spread, rapid, piercing) with clear visuals/audio.
- Local leaderboards (top 10 per level) and a daily seeded run (deterministic spawns).
- Pause/settings/graphics quality options; adaptive quality on weak GPUs.
- Level 6 shipped as a full vertical slice (new biome, enemies, landmark, music).

### M3 — "Depth and spectacle" (weeks 5–8)

- Levels 7–8 (candidates: Neon Night City, Jungle Ruins, Sky Harbour, Haunted Mine).
- Track set-pieces: tunnels, loops with camera roll, drops with FOV kick and speed lines.
- Weather and time-of-day per level; ambient particle fields everywhere.
- Ghost replays (local) and, if Alex approves a backend, online leaderboards.
- Code-split per-level chunks; loading screen with shader warm-up.

### M4 — "Ship quality" (ongoing after M3)

- Accessibility (reduced motion, colour-blind safe enemy palettes, remappable input).
- PWA install, offline play, share-a-run screenshot.
- Performance: 60 fps on a 2020 mid-range phone at dpr 1.5.

## Idea backlog (pre-approved; builders may pull from the top when `agent:ready` is empty)

Ranked. Each must still be filed as an issue by whoever picks it up, following the
issue contract in PROTOCOL.md.

1. **Fireworks on combo streaks (Theme Park)** — pooled burst particles launched from
   behind the Ferris wheel every 5-combo; audio pop.
2. **Whale set-piece (Ocean)** — a huge low-poly whale breaches across the track at
   ~40 s; camera shake, splash particles.
3. **Dust devils (Desert)** — 3–5 spinning instanced cone stacks drifting across dunes.
4. **Aurora shader (Antarctica)** — full-screen band in the sky, intensity tied to combo.
5. **Ember rain after eruptions (Inferno)** — particle field burst from the volcano top.
6. **Weapon pickups** — floating pickups on the track: spread shot, rapid fire,
   piercing. 10 s duration, HUD icon, distinct SFX.
7. **Mini-bosses** — one per level, multi-hit with hit-points bar and weak points
   (Golden Balloon chain, Giant Scorpion, Kraken tentacles, Yeti, Magma Titan).
8. **Combo tiers** — 1×/2×/3×/5× with colour, music intensity and slow-mo at 5×.
9. **Daily run** — seeded RNG for spawns + date seed; separate local leaderboard.
10. **Local leaderboard** — top 10 per level with initials entry on the results screen.
11. **Track set-pieces** — tunnel segments (instanced arches with interior lights),
    loop-the-loop curve type with camera roll.
12. **Level 6: Neon Night City** — night sky, neon signs (emissive instanced panels),
    hover drones and billboard bots; synthwave music.
13. **Level 7: Jungle Ruins** — mist, temples, vines, toucans and spider swarms.
14. **Level 8: Sky Harbour** — floating islands, airships, cloud layer below the track.
15. **Shader warm-up + loading screen** — compile all materials on level load; branded
    progress bar; no first-shot hitch.
16. **Reduced-motion & colour-blind modes** — settings toggles; enemy palettes
    verified for deuteranopia.
17. **Share screenshot** — results screen button renders a branded PNG of the final frame.
18. **Photo mode** — pause with free camera orbit (already have the backtick freeze).
19. **Ghost replay (local)** — record aim/fire timeline, replay as a translucent crosshair.
20. **Online leaderboard** — **needs Alex's decision on a backend** (rule 4: no new paid
    services). Candidates: Vercel KV / Supabase free tier.
