import type { LevelConfig, LevelRide } from '@/types/level'
import { paceLevel } from './pacing'
// Level 1's ride as plain numbers: the ride elements that build it stay out of the startup JS (#863). Every other generated
// ride is its world chunk's (`World.rides`), out of the startup JS altogether (#960).
import { PARK_LEVEL_RIDE } from './environments/biomes/themePark/parkLevel'

/** Level 1's lift-hill rings (`formationOrigin`). */
const LIFT_RINGS = { ahead: 700, side: 250, up: 150 }

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
    maxScore: 30 * 20 + 78 * 15 + 2 * 60 + 4 * 40 + 400, // 1770 + the Giant Scorpion's claws, tail segments and reward (bossSpecs.ts) = 2450
    message: 'Ready for this one?',
    nextLevel: 'level3',
    // The ride kit's dark ride (#864, `desertTrack.ts`): a lift hill, the drop into the Pyramid, a jump gap between mesas.
    ...paceLevel({
      // Weights are seconds (45 over the wave span). Two scorpion packs so the straight run to the lift doesn't put all
      // thirty in view (#864: draws); a first V over the lift hill's crest, where the climb pitches the view at the sky (5 s);
      // the second pack on the sand before the door, under the drop (11 s); the sandstorm's V meets the car out of the Pyramid (16 s), the
      // last V comes in over the climb to the airtime crest (28 s).
      waves: [
        { type: 'scorpion', count: 12, waveLabel: 'Incoming!', weight: 5 },
        { type: 'crow', count: 9, waveLabel: 'Over the Top!', formation: 'v', weight: 6 },
        { type: 'scorpion', count: 18, waveLabel: 'Out of the Sand!', weight: 5 },
        { type: 'crow', count: 30, waveLabel: 'A Murder of Crows!', formation: 'v', weather: 'sandstorm', weight: 12 },
        { type: 'crow', count: 39, waveLabel: 'More Crows!', formation: 'v', weight: 17 },
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
    maxScore: 44 * 18 + 28 * 25 + 36 * 12 + 5 * 60 + 400, // 1924 + the Kraken's 5 sucker pads and reward (bossSpecs.ts) = 2624
    message: 'Have you ever been alone in the middle of nowhere... And surrounded by enemies?',
    nextLevel: 'level4',
    // The ride kit's (#865, `oceanTrack.ts`): a lift, a splashdown into a glass tunnel under the sea, through a sea arch.
    ...paceLevel({
      waves: [
        // "Into the Deep!": the jellyfish arrive as the car dives into the glass tunnel (~14 s).
        { type: 'jellyfish', count: 20, waveLabel: 'Into the Deep!', weight: 3 },
        { type: 'shark', count: 28, waveLabel: 'Sharks!', weight: 2 },
        { type: 'jellyfish', count: 24, waveLabel: 'Jellyfish Bloom!', weight: 2 },
        { type: 'flyingFish', count: 36, waveLabel: 'Flying Fish!', formation: 'school', weight: 3 },
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
    maxScore: 36 * 15 + 40 * 30 + 16 * 50 + 2 * 60 + 400, // 2540 + the Yeti's fists and reward (bossSpecs.ts; snowballs are bonus kills) = 3060
    message: "You've made it! Congrats!",
    nextLevel: 'level5',
    // The ride kit's (#866, `arcticTrack.ts`).
    ...paceLevel({
      waves: [
        // A wave to each stretch of the storyboard (weights in seconds of the 45 s wave span), so no element rides empty
        // (#937): the station and the lift's foot, up the lift to the drop, the ice cave and out of it, the blizzard's
        // ridge, the crest, then the brutes down the helix. Half the party at a time also keeps the lift's draws
        // under the ceiling (all 44 at once went over it, #866).
        { type: 'snowmanScout', count: 18, waveLabel: 'Scout Party', formation: 'line', weight: 6 },
        { type: 'snowmanScout', count: 18, formation: 'line', weight: 6 },
        { type: 'snowman', count: 10, weight: 6 },
        { type: 'snowman', count: 15, waveLabel: 'Snowmen Incoming!', weather: 'blizzard', weight: 5 },
        { type: 'snowman', count: 15, weight: 6 },
        { type: 'snowmanBrute', count: 8, waveLabel: 'Brutes!', weight: 4 },
        { type: 'snowmanBrute', count: 8, weight: 12 },
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
    maxScore: 52 * 12 + 20 * 18 + 22 * 35 + 8 * 60 + 3 * 60 + 500, // 2234 + the Magma Titan's vents, heart and reward (bossSpecs.ts) = 2914
    message: 'You conquered the Inferno!',
    nextLevel: 'level6',
    // The ride kit's (#867, `infernoTrack.ts`).
    ...paceLevel({
      waves: [
        { type: 'emberWisp', count: 26, waveLabel: 'Embers Rise!', formation: 'spiral', weight: 2 },
        { type: 'fireImp', count: 20, waveLabel: 'Imps Attack!', weight: 2 },
        { type: 'lavaGolem', count: 12, waveLabel: 'Golems Awaken!', weight: 2 },
        { type: 'emberWisp', count: 26, waveLabel: 'Eruption!', isEruption: true, formation: 'spiral', weight: 2 },
        { type: 'infernalDrake', count: 8, waveLabel: 'Drakes Descend!', weight: 2 },
        { type: 'lavaGolem', count: 10, waveLabel: 'Golems Return!', weight: 4 },
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
    // Shoot the V2 sign and the V8 way round (#702) brings its own rats (#720): from 17 s, once the sign is shot (it can be
    // until the car reaches it, 18.7 s), they line the branch ahead (ridden 18.9–21.5 s), and only that run meets them.
    ...paceLevel({
      waves: [
        { type: 'dustBunny', count: 14, waveLabel: 'Chalk Dust!', weight: 8, bystanders: { type: 'climber', count: 4 } },
        { type: 'dustBunny', count: 24, waveLabel: 'Dust Bunnies!', weight: 4 },
        { type: 'rat', count: 16, waveLabel: 'Rats on the Mats!', weight: 8, bystanders: { type: 'climber', count: 3 } },
        { type: 'lanternfly', count: 36, waveLabel: 'Lanternflies!', weight: 5 },
        { type: 'rat', count: 18, waveLabel: 'The Pack!', weight: 20, bystanders: { type: 'climber', count: 3 } },
      ],
      boss: 'medusa',
      branch: { type: 'rat', count: 8, waveLabel: 'Pad Rats!', at: 17 },
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
    maxScore: 82 * 15 + 60 + 60 + 400, // 1230 + the Helicopter's searchlight, tail rotor and reward (bossSpecs.ts) = 1750
    message: 'You cleared Neon Metropolis!',
    nextLevel: 'level8',
    // The first v2 ride (#323; the full storyboard is #871): the car waits in a station on the curve's crest for the
    // countdown, GO launches it over the fins and it drops straight into the street canyons; gravity rides the rest,
    // the beat keeping a run to about half the lap. level1's curve family, extent varC × 13 × scalar = 1040.
    ride: {
      track: {
        varA: 3,
        varB: 17,
        varC: 4,
        scalar: 20,
        curve: 'curve1',
        ride: 'v2',
        mechanics: [{ kind: 'station', from: 0, to: 0.012, speed: 260 }],
        rideV2: { crawl: 100, drag: 0.001 },
        color1: 0xff3fb4,
        color2: 0x2ee6ff,
        glow: 0.6,
      },
    },
    // Hover drones patrol the street canyons in Vs and rings, then the Helicopter (#325) drops in over the street ahead.
    // Every wave is a formation ahead of the rider, one every ~6 s to 29 s, then the boss at 40 s. A wave of drones is
    // shot down in a few seconds and the towers hide stragglers: four big waves 10 s apart, two scattered over the whole
    // city, left the rider with nothing to shoot for most of the run (the pacing gate). The ring comes second, centred on
    // the track, so the drop into the canyons has targets; the last wave comes in three rings, so it lasts until the boss.
    ...paceLevel({
      waves: [
        { type: 'hoverDrone', count: 9, waveLabel: 'Drones Incoming!', formation: 'v', weight: 0.75 },
        { type: 'hoverDrone', count: 8, waveLabel: 'Surveillance Ring!', formation: 'ring' },
        { type: 'hoverDrone', count: 13, waveLabel: 'Patrol Wing!', formation: 'v' },
        { type: 'hoverDrone', count: 17, waveLabel: 'Street Sweep!', formation: 'spiral' },
        { type: 'hoverDrone', count: 14, waveLabel: 'Swarm Protocol!', formation: 'v' },
        { type: 'hoverDrone', count: 21, waveLabel: 'Lockdown!', formation: 'ring', weight: 2.5 },
      ],
      boss: 'helicopter',
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: {},
  },
  {
    id: 'level8',
    name: 'Jungle Ruins',
    description: 'Ride through Jungle Ruins',
    order: 8,
    biome: 'jungle',
    maxScore: 60 * 13 + 44 * 15, // 1440: no boss, a finale wave ends the run
    message: 'You cleared Jungle Ruins!',
    nextLevel: null,
    track: {
      varA: 3,
      varB: 17,
      varC: 4,
      scalar: 20,
      curve: 'curve1',
      ride: 'v2',
      mechanics: [{ kind: 'station', from: 0, to: 0.01, speed: 120 }],
      rideV2: { gravity: 480, crawl: 90, drag: 0.0012, zones: [{ kind: 'lift', from: 0.085, to: 0.122, speed: 60 }] },
      color1: 0xd8c9a0,
      color2: 0x3f8a4a,
    },
    ...paceLevel({
      waves: [
        { type: 'balloon', count: 30, waveLabel: 'Here They Come!', weight: 2 },
        { type: 'crow', count: 14, waveLabel: 'Crows!', formation: 'v', weight: 2 },
        { type: 'balloon', count: 30, waveLabel: 'More Balloons!', weight: 2 },
        { type: 'crow', count: 14, waveLabel: 'The Flock!', formation: 'spiral', weight: 3 },
      ],
      finale: { type: 'crow', count: 16, waveLabel: 'Final Wave!' },
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: { hasTrees: true, treeCount: 60 },
  },
]

export function getLevelConfig(id: string): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function getAllLevels(): LevelConfig[] {
  return [...LEVELS].sort((a, b) => a.order - b.order)
}

/** The rides that came with their worlds' chunks (`addRides`, from `loadWorld`), by level. */
const arrivedRides = new Map<string, LevelRide>()

/** A world chunk's rides, once it has arrived (`loadWorld`). */
export function addRides(rides: Readonly<Record<string, LevelRide>>): void {
  for (const [id, ride] of Object.entries(rides)) arrivedRides.set(id, ride)
}

/** A level's ride: the registry's (level 1's), else its world's once that chunk is in (#960); undefined before. */
export function levelRide(id: string): LevelRide | undefined {
  return getLevelConfig(id)?.ride ?? arrivedRides.get(id)
}

/** The level whose `nextLevel` is `id` (its star unlocks `id`); null for the first level or an unknown id. */
export function previousLevel(
  id: string,
  levels: readonly Pick<LevelConfig, 'id' | 'nextLevel'>[] = LEVELS,
): string | null {
  return levels.find((l) => l.nextLevel === id)?.id ?? null
}
