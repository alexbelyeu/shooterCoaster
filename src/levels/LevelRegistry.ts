import type { LevelConfig } from '@/types/level'

const LEVELS: LevelConfig[] = [
  {
    id: 'level1',
    name: 'Theme Park',
    description: 'Fun at the fair',
    order: 1,
    biome: 'themePark',
    maxScore: 13 * 150,
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
      { type: 'balloon', count: 150, spawnDelay: 0 },
    ],
    starThresholds: [0.3, 0.6, 0.9],
    environment: {
      groundColor: 0x3a7d3a,
      skybox: 'skyboxsun25degtest',
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
    maxScore: (60 * 15) / 2,
    timerSeconds: 40,
    message: 'Ready for this one?',
    nextLevel: 'level3',
    track: {
      varA: 5,
      varB: 27,
      varC: 2,
      scalar: 60,
      rollerSpeed: 0.000005,
      minRollerSpeed: 0.00009,
      curve: 'curve1',
      color1: 0x51411a,
      color2: 0x812a2a,
    },
    enemies: [{ type: 'crow', count: 60 }],
    starThresholds: [0.25, 0.55, 0.85],
    environment: {
      groundColor: 0x473500,
      skybox: 'devilpunch',
    },
  },
  {
    id: 'level3',
    name: 'Ocean',
    description: 'Aim for the snout!',
    order: 3,
    biome: 'ocean',
    maxScore: (25 * 40) * 0.75,
    timerSeconds: 40,
    message: 'Have you ever been alone in the middle of nowhere... And surrounded by enemies?',
    nextLevel: 'level4',
    track: {
      varA: 3,
      varB: 36,
      varC: 4,
      scalar: 20,
      rollerSpeed: 0.000013,
      minRollerSpeed: 0.00013,
      curve: 'curve1',
      color1: 0x416fa0,
      color2: 0x31ffd5,
    },
    enemies: [{ type: 'shark', count: 40 }],
    starThresholds: [0.25, 0.5, 0.8],
    environment: {
      groundColor: 0x294c48,
      skybox: 'emerald',
      hasWater: true,
    },
  },
  {
    id: 'level4',
    name: 'Antarctica',
    description: 'The living snowmen',
    order: 4,
    biome: 'arctic',
    maxScore: (30 * 40) / 1.5,
    timerSeconds: 65,
    message: "You've made it! Congrats!",
    nextLevel: null,
    track: {
      varA: 3,
      varB: 36,
      varC: 4,
      scalar: 70,
      rollerSpeed: 0.000006,
      minRollerSpeed: 0.00006,
      curve: 'curve2',
      color1: 0x909090,
      color2: 0xffffff,
    },
    enemies: [{ type: 'snowman', count: 40 }],
    starThresholds: [0.2, 0.5, 0.8],
    environment: {
      groundColor: 0xffffff,
      skybox: 'iceflow',
    },
  },
]

export function getLevelConfig(id: string): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function getAllLevels(): LevelConfig[] {
  return [...LEVELS].sort((a, b) => a.order - b.order)
}
