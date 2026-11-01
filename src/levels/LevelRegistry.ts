import type { LevelConfig } from '@/types/level'

const LEVELS: LevelConfig[] = [
  {
    id: 'level1',
    name: 'Theme Park',
    description: 'Fun at the fair',
    order: 1,
    biome: 'themePark',
    maxScore: 13 * 150 + 5 * 65 + 400, // 1950 + the Golden Blimp's 5 golden balloons and reward (bossSpecs.ts) = 2675
    timerSeconds: 75,
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
    enemies: [
      { type: 'balloon', count: 50, spawnDelay: 0, waveLabel: 'Pop em!' },
      { type: 'balloon', count: 50, spawnDelay: 20, waveLabel: 'More Balloons!' },
      { type: 'balloon', count: 50, spawnDelay: 45, waveLabel: 'Final Wave!', formation: 'ring' },
    ],
    boss: { type: 'goldenBlimp', at: 55 },
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
    maxScore: 30 * 20 + 50 * 15, // 600 + 750 = 1350
    timerSeconds: 60,
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
    enemies: [
      { type: 'scorpion', count: 30, spawnDelay: 0, waveLabel: 'Incoming!' },
      { type: 'crow', count: 25, spawnDelay: 15, waveLabel: 'A Murder of Crows!', formation: 'v' },
      { type: 'crow', count: 25, spawnDelay: 35, waveLabel: 'More Crows!', formation: 'v' },
    ],
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
    maxScore: 20 * 18 + 25 * 25 + 30 * 12 + 5 * 60 + 400, // 1345 + the Kraken's 5 sucker pads and reward (bossSpecs.ts) = 2045
    timerSeconds: 65,
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
    enemies: [
      { type: 'jellyfish', count: 20, spawnDelay: 0, waveLabel: 'Into the Deep!' },
      { type: 'shark', count: 25, spawnDelay: 15, waveLabel: 'Sharks!' },
      { type: 'flyingFish', count: 30, spawnDelay: 35, waveLabel: 'Flying Fish!', formation: 'school' },
    ],
    boss: { type: 'kraken', at: 40 },
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
    maxScore: 25 * 15 + 20 * 30 + 8 * 50, // 375 + 600 + 400 = 1375
    timerSeconds: 75,
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
    enemies: [
      { type: 'snowmanScout', count: 25, spawnDelay: 0, waveLabel: 'Scout Party', formation: 'line' },
      { type: 'snowman', count: 20, spawnDelay: 20, waveLabel: 'Snowmen Incoming!' },
      { type: 'snowmanBrute', count: 8, spawnDelay: 45, waveLabel: 'Brutes!' },
    ],
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
    maxScore: 2585,
    timerSeconds: 120,
    message: 'You conquered the Inferno!',
    nextLevel: null,
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
    enemies: [
      { type: 'emberWisp', count: 35, spawnDelay: 0, waveLabel: 'Embers Rise!', formation: 'spiral' },
      { type: 'fireImp', count: 25, spawnDelay: 15, waveLabel: 'Imps Attack!' },
      { type: 'lavaGolem', count: 15, spawnDelay: 30, waveLabel: 'Golems Awaken!' },
      { type: 'emberWisp', count: 40, spawnDelay: 50, waveLabel: 'Swarm!', isEruption: true, formation: 'spiral' },
      { type: 'infernalDrake', count: 6, spawnDelay: 70, waveLabel: 'Drakes Descend!' },
      { type: 'lavaGolem', count: 10, spawnDelay: 85, waveLabel: 'Final Eruption!', isEruption: true },
    ],
    starThresholds: [0.25, 0.55, 0.85],
    environment: {
      hasTrees: true,
      treeCount: 60,
    },
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
