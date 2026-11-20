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

**The ride:** every world's ride is a storyboard of the elements in `docs/RIDE-KIT.md` (launch,
lift hill, drops, airtime, inversions, near misses, a dark section, a finale and the photo). A ride
without them is a level that isn't finished.

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
| | **Every registration**: level config, `nextLevel`, stars, `maxScore`, server limits, shard, `budgets.json`, `#about` copy, postcard stub, score slot: `npm run new-world` (#460); a new enemy's turntable subject stays by hand |
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
  flat `floor` shaped by the hall (the gym's sunken Starr pit is in its `floor`, `gymFloor`; DECISIONS
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

## The checklist for a new world

`npm run new-world -- <levelId> --name "<Name>" --biome <biome> [--interior] [--score-from <levelId>] [--dry-run]` (#460) does
every step marked **(script)** and prints the rest. `--dry-run` prints the plan and writes nothing; an id,
biome or score that already exists is refused, so a second run changes nothing. The plan is pure in
`scripts/newWorldPlan.mjs` (unit-tested); the templates are `scripts/new-world/`: the biome files in `{outdoor,interior}/`, the atmosphere / terrain / reverb entries in `<kind>/registrations.ts`, the postcard stub in `postcard.tsx`, all real TS that the build typechecks and lint checks.

1. Read `.claude/skills/shooter-coaster-level-design` (track extent formula, enemy scaling,
   z-fighting, terrain-following) and `docs/art/ENEMIES.md` (style).
2. Biome. **(script)** `biomes/<biome>/` from the outdoor template (noise terrain, trees, seeded boulders
   beside the track, a stand-in spire) or the interior one (a flat `floor`, `bounds` inside a box hall
   (`HALL` in its `config.ts`), crates); `BIOME_TYPES` (`src/types/level.ts`: the one list of biome ids, which `BiomeType`, the terrain and particle tests and the turntable's `?biome=` read, #509), `biomeRegistry.ts`, the
   `atmosphere.ts` preset, `BIOME_TERRAIN_CONFIGS` (`utils/terrainNoise.ts`; an interior's is just `meshSize` and `authoredFloor: true`, which a test holds to its `floor`:
   `biomeHeightFunction` hands every caller its `floor`), `BIOME_REVERB` (`sfxDesign.ts`), a `theme.ts` accent and a `LevelPostcard`
   stub. **(by hand)** The look: palette, sky, light, fog, grade, the hero landmark in `Features.tsx`
   and its `hero` shot in `index.ts` (what the intro's 10 s tour passes on its way into the seat and the results orbit circles:
   the template's points at the stand-in spire's `LANDMARK_SITE`, or an interior's far wall; #328, #675; the tour's
   reveal and landmark pass are generated from it, and `hero.tour` swaps in hand-picked shots when they frame it badly),
   props in `Decorations.tsx` (seeded, off the track), contact-shadow footprints, the postcard art and
   accent; an interior sizes `HALL` around its track (its `BIOME_TERRAIN_CONFIGS` `meshSize` sizes the floor mesh if the
   default 6000 doesn't fit it).
3. Level. **(script)** `LevelRegistry.ts`: the level after the last one (its `nextLevel`, so the last
   level's star unlocks it), level1's track params, a starter roster of balloons and crows through
   `paceLevel` ending on a finale wave, `maxScore` from `SCORE_VALUES`; its row in
   `LevelRegistry.test.ts`'s finales table and its pinned lap in `track/ridePhysics.test.ts` `LAPS`;
   `node scripts/gen-level-limits.mjs` (the server's limits). **(by hand)** The track (inside the
   extent formula, or an authored spline from a blockout like the gym's; its `LAPS` pin follows), the
   world's own roster and boss; then `maxScore`, the finales row and `gen-level-limits` again.
4. Enemies **(by hand)**: anything new in `SharedEnemyAssets.ts` (warm-up finds it), `enemyComponents.ts`,
   `ENEMY_PLACEMENT`, `SCORE_VALUES`, `deathStyles.ts`, `sfxDesign.ts`, the turntable's `subjects.ts`.
5. Music. **(script)** `scores/<levelId>.scrim`, a copy of `--score-from`'s score (level1 by default), in
   `scores/index.ts`, with that score's key in `SCORE_KEYS`. **(by hand)** A theme round for Alex
   (`Listen:`); the winner replaces the copy and its `SCORE_KEYS` row.
6. Gates. **(script)** A shard in `e2e/shards.mjs` and the `ci.yml` smoke matrix; `budgets.json`
   `smokeSeconds.<id>` (the previous level's), `scene.<id>` and `pacing.<id>` as `placeholder`s that
   two clean local smokes of the level fill from the higher of what they measured (CI fails on a placeholder); `#about` in `index.html` (a line naming the world and its enemies, the world count in the
   copy and meta descriptions; `indexHtml.test.ts`). **(by hand)** Rewrite the `#about` line once the
   world has its enemies and landmark; a `docs/agents/STATE.md` row.
7. Prove it **(by hand)**: `node e2e/smoke.mjs --shard <id>` twice (sets `scene.<id>`) and
   `--steps pacing --levels <id>` twice (sets `pacing.<id>`); a run with any other problem records nothing
   (`placeholder not set`), so fix it and run again; commit the budgets they wrote; look at the ride,
   enemy and combat shots; the turntable sheet for new enemies.

## Set-pieces: tunnels

A tunnel (#332) is data: `TrackParams.tunnels`, each `{ from: <track t>, length: <arc units> }` (level 1's
`{ from: 0.18, length: 520 }` under the midway). Pure `src/track/setPieces.ts` `withTunnels` places it on the
arc table, so clearance, the camera and the e2e hook read it from there; `tunnelGeometry.ts` builds the mesh
and `TrackTunnels.tsx` draws it. `tunnelSpans` throws on (`setPieces.test.ts` places every level's tunnels, so `npm test` catches it):

- **the seam**: a tunnel and its portals (`portalDepth` at each end) must sit inside one lap, never across t = 1;
- **portal room**: the same margin at the track's start (`from` past `portalDepth` of arc);
- **overlap**: two tunnels need two portals' depth of open track between them.

Guidance: keep it short, about 2 s of ride at the speed the car has there (`ridePhysics.ts` `rideProfile`):
nothing outside is shootable from inside the tube, so it is time with nothing to shoot, which the `pacing` gate counts against the level's
`budgets.json` `pacing` ceilings (`longestGapSeconds`, `noTargetShare`). Put it between waves, not over one,
and run `node e2e/smoke.mjs --steps pacing --levels <id>` after placing it. The `speed` step (the `level1-steps` shard) shoots the
entry and the inside (`<id>-tunnel-entry.png`, `<id>-tunnel.png`).

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
