import type { LevelConfig } from '@/types/level'
import { paceLevel } from './pacing'
import { GYM_TRACK } from './environments/biomes/gym/gymTrack'

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
    track: {
      varA: 3,
      varB: 17,
      varC: 4,
      scalar: 20,
      rollerSpeed: 0.00001,
      minRollerSpeed: 0.00008,
      curve: 'curve1',
      color1: 0xffffff,
      color2: 0xffff00,
    },
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
        { type: 'crow', count: 39, waveLabel: 'A Murder of Crows!', formation: 'v' },
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
    },
  },
  {
    id: 'level4',
    name: 'Antarctica',
    description: 'The living snowmen',
    order: 4,
    biome: 'arctic',
    maxScore: 44 * 15 + 40 * 30 + 16 * 50 + 2 * 60 + 400, // 2660 + the Yeti's fists and reward (bossSpecs.ts; snowballs are bonus kills) = 3180
    message: "You've made it! Congrats!",
    nextLevel: 'level5',
    track: {
      varA: 3,
      varB: 36,
      varC: 4,
      scalar: 35,
      rollerSpeed: 0.000006,
      minRollerSpeed: 0.00006,
      curve: 'curve2',
      color1: 0x909090,
      color2: 0xffffff,
    },
    ...paceLevel({
      waves: [
        { type: 'snowmanScout', count: 44, waveLabel: 'Scout Party', formation: 'line' },
        { type: 'snowman', count: 40, waveLabel: 'Snowmen Incoming!' },
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
    maxScore: 28 * 15 + 24 * 12 + 50 * 18, // 1608: no boss yet (the Medusa, #521), so the pit's rats are the finale
    message: 'You sent the Climbing Gym!',
    nextLevel: null,
    // Authored from Alex's blockout (#514): up the Tree, round the Flame, through the Arch, the dive into the Starr pit.
    track: GYM_TRACK,
    // Crows stand in for the rafters' air enemy until the lanternflies (#516) replace them; no climbers yet (bystanders, #518).
    ...paceLevel({
      waves: [
        { type: 'crow', count: 14, waveLabel: 'In the Rafters!', formation: 'v', weight: 2 },
        { type: 'dustBunny', count: 24, waveLabel: 'Dust Bunnies!', weight: 2 },
        { type: 'rat', count: 16, waveLabel: 'Rats on the Mats!', weight: 2 },
        { type: 'crow', count: 14, waveLabel: 'Round the Flame!', formation: 'spiral', weight: 2 },
        { type: 'rat', count: 18, waveLabel: 'The Pack!', weight: 3 },
      ],
      finale: { type: 'rat', count: 16, waveLabel: 'Into the Pit!' },
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
