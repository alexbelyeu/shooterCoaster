import type { LevelConfig } from '@/types/level'
import { paceLevel } from './pacing'
// Level 6's track and walls as plain numbers: the blockout they are built from stays out of the startup JS (#589).
// Level 1's ride as plain numbers: the ride elements that build it stay out of the startup JS.
import { PARK_LEVEL_TRACK } from './environments/biomes/themePark/parkLevel'
// Level 4's ride too (#866).
import { ARCTIC_LEVEL_TRACK } from './environments/biomes/arctic/arcticLevel'
import { GYM_LEVEL } from './environments/biomes/gym/gymLevel'

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
    track: PARK_LEVEL_TRACK,
    goldenBalloons: 3,
    ...paceLevel({
      waves: [
        { type: 'balloon', count: 50, waveLabel: 'Pop em!' },
        { type: 'balloon', count: 50, waveLabel: 'More Balloons!' },
        { type: 'balloon', count: 50, waveLabel: 'Final Wave!', formation: 'ring' },
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
    track: {
      varA: 5,
      varB: 27,
      varC: 2,
      scalar: 60,
      rollerSpeed: 0.000004,
      minRollerSpeed: 0.00006,
      curve: 'curve1',
      color1: 0x51411a,
      color2: 0x812a2a,
    },
    ...paceLevel({
      waves: [
        { type: 'scorpion', count: 30, waveLabel: 'Incoming!' },
        { type: 'crow', count: 39, waveLabel: 'A Murder of Crows!', formation: 'v', weather: 'sandstorm' },
        { type: 'crow', count: 39, waveLabel: 'More Crows!', formation: 'v' },
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
    track: {
      varA: 3,
      varB: 36,
      varC: 4,
      scalar: 20,
      rollerSpeed: 0.00001,
      minRollerSpeed: 0.0001,
      curve: 'curve1',
      color1: 0x416fa0,
      color2: 0x31ffd5,
    },
    ...paceLevel({
      waves: [
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
      /** Through the gap between two islands, out where the sea runs on past the drawn terrain, ~30 s in and gone before the Kraken. */
      whale: { startSeconds: 31.25, lead: 3700, aim: 0.1 },
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
    track: ARCTIC_LEVEL_TRACK,
    ...paceLevel({
      waves: [
        // Longer, so the blizzard's wave meets the rider out of the ice cave, on the ridge's lift; 36, not 44: the whole party
        // stands up the slow first lift in view at once, and 44 put the scene over its draw-call ceiling (#866).
        { type: 'snowmanScout', count: 36, waveLabel: 'Scout Party', formation: 'line', weight: 1.5 },
        { type: 'snowman', count: 40, waveLabel: 'Snowmen Incoming!', weather: 'blizzard' },
        { type: 'snowmanBrute', count: 16, waveLabel: 'Brutes!' },
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
    track: {
      varA: 3,
      varB: 40,
      varC: 5,
      scalar: 40,
      rollerSpeed: 0.000005,
      minRollerSpeed: 0.00005,
      curve: 'curve2',
      color1: 0x2a2a2a,
      color2: 0xff4400,
      glow: 1.0,
    },
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
    maxScore: 14 * 15 + (14 + 24) * 12 + (34 + 8) * 18 + 8 * 50 + 500, // 1422 (the V8's rats included) + the Medusa's eight snakes and reward (bossSpecs.ts) = 2322
    message: 'You sent the Climbing Gym!',
    nextLevel: 'level7',
    // Authored from Alex's blockout (#514), the ride rebuilt from the ride kit's storyboard (#700, `gymTrack.ts`).
    track: GYM_LEVEL.track,
    walls: [...GYM_LEVEL.walls],
    // Every enemy is a gym pest: no birds indoors (#664). Climbers are bystanders (#518): the first wave brings some, to
    // teach the don't-shoot rule from the start. The waves follow the storyboard (#768): dust over the launch, more over
    // the roll (8 s), rats in the Training Area's dark cave (12 s), the lanternflies (#575) at 20 s, their swarm in groups
    // along the ride (`placeWallSwarm`): beside the car up Alaska, then on the Starr ahead of the drop, and the pack in the
    // pit from 25 s, before the dyno.
    // Shoot the V2 sign and the V8 way round (#702) brings its own rats (#720): from 17 s, once the sign is shot (it can be
    // until the car reaches it, 18.7 s), they line the branch ahead (ridden 18.9–21.5 s), and only that run meets them.
    ...paceLevel({
      waves: [
        { type: 'dustBunny', count: 14, waveLabel: 'Chalk Dust!', weight: 8, bystanders: { type: 'climber', count: 4 } },
        { type: 'dustBunny', count: 24, waveLabel: 'Dust Bunnies!', weight: 4 },
        { type: 'rat', count: 16, waveLabel: 'Rats on the Mats!', weight: 8, bystanders: { type: 'climber', count: 3 } },
        { type: 'lanternfly', count: 14, waveLabel: 'Lanternflies!', weight: 5 },
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
    maxScore: 102 * 15, // 1530: no boss, a finale wave ends the run
    message: 'You cleared Neon Metropolis!',
    nextLevel: null,
    // The first v2 ride (#323; the full storyboard is #871): the car waits in a station on the curve's crest for the
    // countdown, GO launches it over the fins and it drops straight into the street canyons; gravity rides the rest,
    // the beat keeping a run to about half the lap. level1's curve family, extent varC × 13 × scalar = 1040.
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
    // Hover drones patrol the street canyons in Vs and rings; no boss yet (the helicopter is #322's), a finale wave ends the run.
    ...paceLevel({
      waves: [
        { type: 'hoverDrone', count: 20, waveLabel: 'Drones Incoming!', weight: 2 },
        { type: 'hoverDrone', count: 20, waveLabel: 'Patrol Wing!', formation: 'v', weight: 2 },
        { type: 'hoverDrone', count: 22, waveLabel: 'Surveillance Ring!', formation: 'ring', weight: 2 },
        { type: 'hoverDrone', count: 20, waveLabel: 'Swarm Protocol!', formation: 'v', weight: 3 },
      ],
      finale: { type: 'hoverDrone', count: 20, waveLabel: 'Final Wave!', formation: 'ring' },
    }),
    starThresholds: [0.25, 0.55, 0.85],
    environment: {},
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
