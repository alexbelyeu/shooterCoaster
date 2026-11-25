import type { EnemyType, LevelConfig } from '@/types/level'
import { paceLevel, type PacedWave } from './pacing'
// Level 1's ride as plain numbers: the ride elements that build it stay out of the startup JS (#863). Every other generated
// ride is its world chunk's (`World.rides`), out of the startup JS altogether (#960).
import { PARK_LEVEL_RIDE } from './environments/biomes/themePark/parkLevel'

/** Level 1's lift-hill rings (`formationOrigin`). */
const LIFT_RINGS = { ahead: 700, side: 250, up: 150 }

/** Nearer the track than a line's default, so one placed straight ahead where the track doubles back is still in view. */
const JELLYFISH_LINE = { ahead: 600, side: 240, up: 0 }

/** Level 5's near ember spirals: at the default 900 ahead, the volcano's flank hid them up the lift (#937). */
const NEAR_EMBERS = { ahead: 300, side: 120, up: 160 }
/** Straight down the track: out of the cone the rider sees only through its exit hole, so anything off to the side is hidden. */
const EXIT_EMBERS = { ahead: 400, side: 0, up: 30 }

/**
 * Level 3's jellyfish (#937): a small line every 2 s, each placed in view where the rider is when it arrives, so one is
 * coming up as the last is shot (a scattered wave of twenty was cleared in 4 s up the lift, and nothing until the sharks).
 */
function jellyfishLine(count: number, waveLabel?: string): PacedWave {
  return { type: 'jellyfish', count, waveLabel, formation: 'line', formationOrigin: JELLYFISH_LINE, weight: 2 }
}

/** Level 4's waves (#937): seven snowmen beside the track every ~2 s. */
function snowmen(type: EnemyType, waveLabel?: string, count = 7): PacedWave {
  return { type, count, waveLabel, weight: 2 }
}

/** Wave and boss times come from the pacing template (`pacing.ts`): a level lists its roster, never seconds. */
const LEVELS: LevelConfig[] = [
  {
    id: 'level1',
    name: 'Theme Park',
    description: 'Fun at the fair',
    order: 1,
    biome: 'themePark',
    maxScore: 150 * 13 + 5 * 65 + 400, // 1950 + the Golden Blimp's 5 golden balloons and reward (bossSpecs.ts) = 2675
    message: 'Well, that was easy...',
    nextLevel: 'level2',
    // The ride kit's classic (#863, `parkTrack.ts`): a station launch, a lift hill, camelbacks, past the Ferris wheel.
    ride: PARK_LEVEL_RIDE,
    goldenBalloons: 3,
    ...paceLevel({
      waves: [
        { type: 'balloon', count: 25, waveLabel: 'Pop em!', formation: 'ring', weight: 5 },
        // Up the lift hill (5–12 s), a ring every few seconds of the slow climb (a wave's later groups are a lift's length
        // apart): up in the sky it looks at, either side of the lift so its rails hide none of them.
        { type: 'balloon', count: 10, waveLabel: 'Up they go!', formation: 'ring', formationOrigin: LIFT_RINGS, weight: 4 },
        { type: 'balloon', count: 15, formation: 'ring', formationOrigin: LIFT_RINGS, weight: 4 },
        { type: 'balloon', count: 50, waveLabel: 'More Balloons!', weight: 15 },
        { type: 'balloon', count: 50, waveLabel: 'Final Wave!', formation: 'ring', weight: 17 },
      ],
      boss: 'goldenBlimp',
    }),
    starThresholds: [0.3, 0.6, 0.9],
    environment: {
      hasTrees: true,
      treeCount: 120,
    },
  },
  {
    id: 'level2',
    name: 'Desert',
    description: 'A murder of Crows',
    order: 2,
    biome: 'desert',
    maxScore: 56 * 20 + 63 * 15 + 2 * 60 + 4 * 40 + 400, // 2065 + the Giant Scorpion's claws, tail segments and reward (bossSpecs.ts) = 2745
    message: 'Ready for this one?',
    nextLevel: 'level3',
    // The ride kit's dark ride (#864, `desertTrack.ts`): a lift hill, the drop into the Pyramid, a jump gap between mesas.
    ...paceLevel({
      // Weights are seconds (45 over the wave span). A player hits about as many enemies a second as the waves bring, so
      // each wave is sized to last until the next is in view (#937: a wave cleared early is an empty second). Two scorpion
      // packs so the straight run to the lift doesn't put all of them in view (#864: draws); Vs up the lift hill (2, 6 and
      // 7 s: one wave per V of nine, so a second group doesn't fly in with the first), holding the sky to the crest; the
      // second pack on the sand before the door, under the drop (11 s), and ten on the passage's floor in the dark (13 s);
      // the sandstorm's V meets the car out of the Pyramid (16 s); More Crows over the airtime crest (22 s); then only
      // trackside scorpions (23 to 32 s), each pack in view as the one before it is cleared. The ride review saw every V
      // placed after the crest arrive late, on the straight to the boss, with the Giant Scorpion (40 s): what is left then
      // delays the fight, and past ~46 s the final lift turns the view away from it.
      waves: [
        { type: 'scorpion', count: 15, waveLabel: 'Incoming!', weight: 2 },
        { type: 'crow', count: 9, waveLabel: 'Over the Top!', formation: 'v', weight: 4 },
        { type: 'crow', count: 9, formation: 'v', weight: 1 },
        { type: 'crow', count: 6, formation: 'v', weight: 4 },
        { type: 'scorpion', count: 10, waveLabel: 'Out of the Sand!', weight: 2 },
        { type: 'scorpion', count: 10, waveLabel: 'In the Tomb!', darkFloor: true, weight: 3 },
        { type: 'crow', count: 30, waveLabel: 'A Murder of Crows!', formation: 'v', weather: 'sandstorm', weight: 6 },
        { type: 'crow', count: 9, waveLabel: 'More Crows!', formation: 'v', weight: 1 },
        { type: 'scorpion', count: 3, weight: 3 },
        { type: 'scorpion', count: 5, weight: 1 },
        { type: 'scorpion', count: 4, weight: 3 },
        { type: 'scorpion', count: 5, weight: 2 },
        { type: 'scorpion', count: 4, weight: 13 },
      ],
      boss: 'giantScorpion',
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: {
    },
  },
  {
    id: 'level3',
    name: 'Ocean',
    description: 'Aim for the snout!',
    order: 3,
    biome: 'ocean',
    maxScore: 74 * 18 + 28 * 25 + 36 * 12 + 5 * 60 + 400, // 2464 + the Kraken's 5 sucker pads and reward (bossSpecs.ts) = 3164
    message: 'Have you ever been alone in the middle of nowhere... And surrounded by enemies?',
    nextLevel: 'level4',
    // The ride kit's (#865, `oceanTrack.ts`): a lift, a splashdown into a glass tunnel under the sea, through a sea arch.
    ...paceLevel({
      waves: [
        // Up the lift and down the drop (0–10 s; lines of 7 up the lift, so one is still up as the next arrives), the sharks
        // round the glass tunnel (11 s, before the drop's last line is out of view), more jellyfish from the launch's crest
        // past the sea stacks (16–28 s), the flying fish on to the Kraken (29 s, before the last line is behind the rider).
        jellyfishLine(7, 'Into the Deep!'), jellyfishLine(7), jellyfishLine(7), jellyfishLine(7), jellyfishLine(6),
        { ...jellyfishLine(5), weight: 1 },
        { type: 'shark', count: 28, waveLabel: 'Sharks!', weight: 5 },
        jellyfishLine(5, 'Jellyfish Bloom!'), jellyfishLine(5), jellyfishLine(5), jellyfishLine(5), jellyfishLine(5), jellyfishLine(5),
        { ...jellyfishLine(5), weight: 1 },
        { type: 'flyingFish', count: 36, waveLabel: 'Flying Fish!', formation: 'school', weight: 16 },
      ],
      boss: 'kraken',
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: {
      hasWater: true,
      /** Out to sea down the south channel, past the drawn terrain, dead ahead as the car tips over the first drop (~12 s). */
      whale: { startSeconds: 11, lead: 4000, aim: 0.2 },
    },
  },
  {
    id: 'level4',
    name: 'Antarctica',
    description: 'The living snowmen',
    order: 4,
    biome: 'arctic',
    maxScore: 42 * 15 + 49 * 30 + 22 * 50 + 2 * 60 + 400, // 3200 + the Yeti's fists and reward (bossSpecs.ts; snowballs are bonus kills) = 3720
    message: "You've made it! Congrats!",
    nextLevel: 'level5',
    // The ride kit's (#866, `arcticTrack.ts`).
    ...paceLevel({
      waves: [
        // A small wave every ~2 s (#937), so no stretch of the storyboard rides empty: scouts from the station up the
        // lift and down into the ice cave, snowmen out of it, through the blizzard's ridge and over the crest, then
        // brutes down the helix to the Yeti. A snowman falls to one hit: a player meets about two a second.
        snowmen('snowmanScout', 'Scout Party'),
        snowmen('snowmanScout'),
        snowmen('snowmanScout'),
        snowmen('snowmanScout'),
        snowmen('snowmanScout'),
        snowmen('snowmanScout'),
        snowmen('snowman'),
        snowmen('snowman'),
        { ...snowmen('snowman', 'Snowmen Incoming!'), weather: 'blizzard' },
        snowmen('snowman'),
        snowmen('snowman'),
        snowmen('snowman'),
        snowmen('snowman'),
        snowmen('snowmanBrute', 'Brutes!', 6),
        snowmen('snowmanBrute', undefined, 6),
        { ...snowmen('snowmanBrute', undefined, 10), weight: 11 },
      ],
      boss: 'yeti',
    }),
    starThresholds: [0.2, 0.5, 0.8],
    combat: { bulletColor: '#000000', bulletSize: 40 }, // big dark snowballs against the snow
    environment: {
      hasTrees: true,
      treeCount: 80,
    },
  },
  {
    id: 'level5',
    name: 'Inferno',
    description: 'Descend into the volcanic depths',
    order: 5,
    biome: 'volcanic',
    maxScore: 82 * 12 + 21 * 18 + 26 * 35 + 13 * 60 + 3 * 60 + 500, // 3052 + the Magma Titan's vents, heart and reward (bossSpecs.ts) = 3732
    message: 'You conquered the Inferno!',
    nextLevel: 'level6',
    // The ride kit's (#867, `infernoTrack.ts`).
    ...paceLevel({
      waves: [
        // A wave to each stretch of the storyboard (weights in seconds of the 45 s wave span), so no element rides empty
        // (#937): the tube, up the lift, its top at the volcano's flank, the drop tower, out of the cone, the camelbacks,
        // then the turntable, where what is left stands along the track the car faces once it turns. A full group a wave
        // (12 embers, 7 in a line, 9 in a `v`), so each lasts until the next is in view: a player clears about 3 a second.
        // The Eruption rises out of the cone over the drop tower, low enough to be seen through the flank's hole, as the last
        // near embers leave the top of the frame on the approach to it (a second sooner than it was, the same spot); the imps
        // come a second before the drop, so they are on the cone's floor as the car falls; two spirals straight down the
        // track ahead of the exit hole, then the imps out on the plain.
        { type: 'emberWisp', count: 12, waveLabel: 'Embers Rise!', formation: 'spiral', weight: 4 },
        { type: 'emberWisp', count: 12, formation: 'spiral', weight: 4 },
        { type: 'emberWisp', count: 12, formation: 'spiral', formationOrigin: NEAR_EMBERS, weight: 4 },
        { type: 'emberWisp', count: 12, formation: 'spiral', formationOrigin: NEAR_EMBERS, weight: 2 },
        { type: 'emberWisp', count: 16, waveLabel: 'Eruption!', isEruption: true, formation: 'spiral', formationOrigin: { ahead: 300, side: 0, up: 100 }, weight: 4 },
        { type: 'fireImp', count: 7, waveLabel: 'Imps Attack!', formation: 'line', weight: 3 },
        { type: 'emberWisp', count: 10, formation: 'spiral', formationOrigin: EXIT_EMBERS, weight: 1 },
        { type: 'emberWisp', count: 8, formation: 'spiral', formationOrigin: EXIT_EMBERS, weight: 1.5 },
        { type: 'fireImp', count: 7, formation: 'line', weight: 0.5 },
        { type: 'infernalDrake', count: 4, waveLabel: 'Drakes Descend!', formation: 'v', weight: 1 },
        { type: 'lavaGolem', count: 7, waveLabel: 'Golems Awaken!', formation: 'line', weight: 2 },
        { type: 'fireImp', count: 7, formation: 'line', weight: 2 },
        { type: 'lavaGolem', count: 6, waveLabel: 'Golems Return!', formation: 'line', weight: 1 },
        { type: 'lavaGolem', count: 6, formation: 'line', weight: 1 },
        { type: 'lavaGolem', count: 7, formation: 'line', weight: 1 },
        { type: 'infernalDrake', count: 9, formation: 'v', weight: 13 },
      ],
      boss: 'magmaTitan',
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: {
      hasTrees: true,
      treeCount: 60,
    },
  },
  {
    id: 'level6',
    name: 'Climbing Gym',
    description: 'Ride the walls of the climbing gym',
    order: 6,
    biome: 'gym',
    maxScore: 36 * 15 + (14 + 24) * 12 + (34 + 8) * 18 + 8 * 50 + 500, // 1752 (the V8’s rats included) + the Medusa’s eight snakes and reward (bossSpecs.ts) = 2652
    message: 'You sent the Climbing Gym!',
    nextLevel: 'level7',
    // Authored from Alex's blockout (#514), the ride rebuilt from the ride kit's storyboard (#700, `gymTrack.ts`).
    // Every enemy is a gym pest: no birds indoors (#664). Climbers are bystanders (#518): the first wave brings some, to
    // teach the don't-shoot rule from the start. The waves follow the storyboard (#768): dust over the launch, more over
    // the roll (8 s), rats in the Training Area's dark cave (12 s), the lanternflies (#575) at 20 s, their swarm in groups
    // landing one after another on the Alaska walls beside the climbing car, each where the rider looks as it lands
    // (`placeWallSwarm`), then on the roof the car looks up into as it rolls over the top (#948), the last ones on the Starr
    // and the Shield the car looks at from the Shield's top and on the auto belay's fall (#957), and the pack in the pit
    // from 25 s, before the dyno.
    // Shoot the V2 sign and the V8 way round (#702) brings its own rats (#720): from 19 s, once the sign is shot (it can be
    // until the car reaches it, ~20 s), they line the branch ahead (ridden 20.2–22.5 s), and only that run meets them.
    ...paceLevel({
      waves: [
        { type: 'dustBunny', count: 14, waveLabel: 'Chalk Dust!', weight: 8, bystanders: { type: 'climber', count: 4 } },
        { type: 'dustBunny', count: 24, waveLabel: 'Dust Bunnies!', weight: 4 },
        { type: 'rat', count: 16, waveLabel: 'Rats on the Mats!', weight: 8, bystanders: { type: 'climber', count: 3 } },
        { type: 'lanternfly', count: 36, waveLabel: 'Lanternflies!', weight: 5 },
        { type: 'rat', count: 18, waveLabel: 'The Pack!', weight: 20, bystanders: { type: 'climber', count: 3 } },
      ],
      boss: 'medusa',
      branch: { type: 'rat', count: 8, waveLabel: 'Pad Rats!', at: 19 },
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: {},
  },
  {
    id: 'level7',
    name: 'Neon Metropolis',
    description: 'Drones over the city that never sleeps',
    order: 7,
    biome: 'city',
    maxScore: 57 * 15 + 25 * 20 + 60 + 60 + 400, // 57 drones and 25 bots, 1355, + the Helicopter's searchlight, tail rotor and reward (bossSpecs.ts) = 1875
    message: 'You cleared Neon Metropolis!',
    nextLevel: 'level8',
    // The ride kit's storyboard down the city's streets (#871, `cityTrack.ts`), shipped in the city world's chunk (#960).
    // The street and the air take turns (#963): billboard bots line the launch's avenue, where the rider is at street
    // level, hover drones patrol the canyons in a V and rings from the lift on (the towers hide the pavements from up
    // there), then the Helicopter (#325) arrives at 40 s over the helix. Every drone wave is a formation ahead of the
    // rider, each drone moved onto the street its approach sees best (`clearOfTowers`): scattered over the whole city, or
    // in the cross streets beside the ride's avenue, the towers hid them (the pacing gate, #950). Rings, not a spiral:
    // a ring's anchor is on the rails ahead, where the rider looks, and a spiral's 260 off to the side, behind the
    // towers; the weights bring each wave in about a second sooner, before the last one is all shot or out of sight.
    ...paceLevel({
      waves: [
        { type: 'billboardBot', count: 12, waveLabel: 'Billboard Bots!', weight: 0.75 },
        { type: 'hoverDrone', count: 9, waveLabel: 'Drones Incoming!', formation: 'v', weight: 0.8 },
        { type: 'hoverDrone', count: 10, waveLabel: 'Surveillance Ring!', formation: 'ring' },
        { type: 'billboardBot', count: 13, waveLabel: 'Street March!' },
        { type: 'hoverDrone', count: 17, waveLabel: 'Street Sweep!', formation: 'ring' },
        { type: 'hoverDrone', count: 21, waveLabel: 'Lockdown!', formation: 'ring', weight: 2.9 },
      ],
      boss: 'helicopter',
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: {},
  },
  {
    id: 'level8',
    name: 'Jungle Ruins',
    description: 'Toucans over the temple ruins',
    order: 8,
    biome: 'jungle',
    maxScore: 83 * 15 + 5 * 65 + 400, // 1245 + the Golden Blimp's 5 golden balloons and reward (bossSpecs.ts) = 1970
    message: 'You cleared Jungle Ruins!',
    nextLevel: null,
    // The ride kit's storyboard through the valleys (#1009, `jungleTrack.ts`), shipped in the jungle world's chunk.
    // Toucans over the canopy in Vs, rings and spirals ahead of the rider, one wave per stretch (0 s the station, 3 s
    // the turn onto the lift, 8 s the lift, 13 s the crest and drop, 19 s the valley run, 24 s the airtime crest, 29 s
    // the helix), each arriving as the last is shot down, then the boss slot, held by the Golden Blimp until the
    // guardian (#869). Each V is one
    // group of 9: on this curve a second group would sit within reading range of the rider from the wave's start.
    ...paceLevel({
      waves: [
        { type: 'toucan', count: 9, waveLabel: 'Toucans!', formation: 'v', weight: 0.6 },
        { type: 'toucan', count: 10, waveLabel: 'Over the Canopy!', formation: 'ring' },
        { type: 'toucan', count: 9, waveLabel: 'The Flock!', formation: 'v' },
        { type: 'toucan', count: 16, waveLabel: 'Temple Run!', formation: 'spiral', weight: 1.2 },
        { type: 'toucan', count: 9, waveLabel: 'Bills Out!', formation: 'v' },
        { type: 'toucan', count: 9, waveLabel: 'Down the Falls!', formation: 'v' },
        { type: 'toucan', count: 21, waveLabel: 'The Whole Jungle!', formation: 'ring', weight: 3.2 },
      ],
      boss: 'goldenBlimp',
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: { hasTrees: true, treeCount: 500 },
  },
]

export function getLevelConfig(id: string): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function getAllLevels(): LevelConfig[] {
  return [...LEVELS].sort((a, b) => a.order - b.order)
}

/** The level whose `nextLevel` is `id` (its star unlocks `id`); null for the first level or an unknown id. */
export function previousLevel(
  id: string,
  levels: readonly Pick<LevelConfig, 'id' | 'nextLevel'>[] = LEVELS,
): string | null {
  return levels.find((l) => l.nextLevel === id)?.id ?? null
}
