# The level kit — how ShooterCoaster grows to many worlds

_Design doc for epic #437 (Alex, 8 Nov 2026: "procedurally create many more levels: new
worlds, new enemies"). Owned by the Director; builders fix it where it is wrong, in the PR
that found out. The first world built through it is the Climbing Gym: Alex's own gym from his blockout
(#513 → #514, #517; `docs/levels/`)._

## The idea

The five levels were each hand-built, and each one taught the studio a rule it now keeps
(the track extent formula, the readable-spawn rule, one mesh per material, the 60 s pacing
template). The kit turns those rules into **data and templates**, so a new world is a
checklist and an afternoon, and every world inherits the good ride for free. "Procedural"
here means _generated from parameters by code we own_, with the look still authored: the
game should never read as random terrain with random enemies.

## What stays hand-authored, what is generated

| Hand-authored (the look, the memory) | Templated or generated (the rules, the plumbing) |
|---|---|
| The **palette, sky, light, fog, grade** (`atmosphere.ts` preset, `config.ts` colour ramp) | **Pacing**: wave times and the boss `at` from `RUN_SECONDS` and a template (#452, `src/levels/pacing.ts`) |
| The **hero landmark(s)** and set-piece (Pyramid, Volcano, the gym's Starr and Flame) | **Placement**: where a wave lands, from the camera's look direction at activation (#451, `spawnPlacement.ts`); trackside / water / wall bands per enemy (`ENEMY_PLACEMENT`) |
| **Enemy designs** (brief in `docs/art/ENEMIES.md`) and their death style and kill sound | **Enemy motion patterns**: fly, walk, swim, surface, climb (`climbMotion.ts`, #453) are shared modules an enemy picks |
| **Bosses** (spec + choreography) | **Boss framework** (weak points, phases, retract, projectiles, tell, HUD): `bossModel.ts` |
| **Music** (a theme round, Alex's pick) | **Score slot, key table, layers lint** |
| A world's **props** (what a cactus, a hold, a lamppost looks like) | **Scatter**: seeded placement off the track and its towers (`trackClearance.ts`, `StaticInstances`) |
| | **Track**: a curve family + per-world params inside the extent formula; the generator must pass the pacing metric (no stretch facing away for > 3 s) |
| | **Every registration**: level config, `nextLevel`, stars, `maxScore`, server limits, shard, `budgets.json`, `#about` copy, postcard, turntable, score slot: `npm run new-world` (#460) |
| | **Quality gates for free**: the level's smoke shard, `scene` ceilings, the `pacing` budget, `LevelRegistry.test.ts`, readability probe, turntable sheet |

## A world, concretely

A world is `src/levels/environments/biomes/<biome>/` (`config.ts`, `Decorations.tsx`,
`Features.tsx`, `index.ts` → `BiomeDefinition`) plus one `LevelConfig` in
`LevelRegistry.ts`. Two shapes of world:

- **Outdoor** (all five today): terrain from the shared noise with the biome's colour ramp,
  sky dome, optional water, trees, scatter props, landmarks placed by a pure `layout.ts`
  against the track's arc table.
- **Interior** (the gym, #517): a hall (floor, walls, ceiling, windows), light from strip
  lights and windows, fog for depth, props on the walls. It is an ordinary biome with a
  flat floor shaped by the hall (the gym's sunken Starr pit is in its `heightFn`; DECISIONS
  2026-11-11), the outdoor biomes unchanged.
- **From a blockout** (the gym, #513): when a world is a real place, its layout is data
  (`docs/levels/`, a JSON blockout of typed pieces in metres), scaled uniformly to landmark
  size, and the track is **authored**: a closed `spline` curve through control points built
  from the blockout's anchors (#514), with tests that it hits the place's ride moments. The
  trig curves stay for the generated worlds.

A **level** is a roster, not a schedule: which enemies, how many per wave, in what formation,
which boss; the pacing template gives the seconds. The ride is one lap ≈ one run.

An **enemy** is: a model (parts merged per material, `SharedEnemyAssets.ts`), a motion
pattern, a placement rule (`ENEMY_PLACEMENT`: surface + band), a score, a death style, a
kill sound, a turntable entry, a brief. New enemies come from new combinations first
(a climbing figurine = figurine model + climb motion + wall surface + chalk puff), and new
models only where the world needs a character nothing else gives.

## The checklist for a new world (until `npm run new-world` does it, #460)

1. Read `.claude/skills/shooter-coaster-level-design` (track extent formula, enemy scaling,
   z-fighting, terrain-following) and `docs/art/ENEMIES.md` (style).
2. `biomes/<biome>/`: `config.ts` (colour ramp, trees or null, particles preset),
   `Decorations.tsx` (instanced props, seeded, off the track), `Features.tsx` (landmarks,
   set-pieces, contact-shadow footprints), `index.ts`; register in `biomeRegistry.ts`;
   `atmosphere.ts` preset; `theme.ts` accent + `LevelPostcard` art.
3. `LevelRegistry.ts`: the level with its roster and template; `previousLevel` /
   `nextLevel` chain; `maxScore` + stars (`LevelRegistry.test.ts`); `scoreLimits.ts` +
   `node scripts/gen-level-limits.mjs`.
4. Enemies: anything new in `SharedEnemyAssets.ts` (warm-up finds it), `enemyComponents.ts`,
   `ENEMY_PLACEMENT`, `SCORE_VALUES`, `deathStyles.ts`, `sfxDesign.ts`, `subjects.ts`.
5. Music: a slot in `scores/index.ts` + `SCORE_KEYS`; a theme round for Alex (`Listen:`).
6. Gates: `budgets.json` `scene.<id>` + `smokeSeconds.<id>` (+ `pacing.<id>`), a shard in
   `e2e/shards.mjs`, `#about` copy in `index.html` (`indexHtml.test.ts`), the level-select
   card, `docs/agents/STATE.md` row.
7. Prove it: `node e2e/smoke.mjs --shard <id>` and `--steps pacing --levels <id>`; look at
   the ride, enemy and combat shots; the turntable sheet for new enemies.

## Candidate worlds (Director's ranking)

1. **Climbing Gym** (#438 → #513): Alex's gym from his blockout; rats, lanternflies, dust
   bunnies, climbers you must not shoot, the Medusa. First.
2. **Neon Metropolis** (#322): night city, drones, billboard bots, helicopter. Deferred from
   M3; comes back through the kit.
3. **Jungle Ruins**: mist, temples, vines, toucans, spider swarms.
4. **Sky Harbour**: floating islands, airships, a cloud layer under the track.
5. **Haunted Mine**: interior #2, lanterns, bats, carts on side rails.
6. **Night Ride variants** of existing worlds: a lighting / grade preset and emissive props
   over the same layout: the cheapest "new level" the kit can make once the gym's interior
   lighting exists.
