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
      { type: 'balloon', count: 50, spawnDelay: 0, waveLabel: 'Pop em!' },
      { type: 'balloon', count: 50, spawnDelay: 20, waveLabel: 'More Balloons!' },
      { type: 'balloon', count: 50, spawnDelay: 45, waveLabel: 'Final Wave!' },
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
      { type: 'crow', count: 25, spawnDelay: 15, waveLabel: 'A Murder of Crows!' },
      { type: 'crow', count: 25, spawnDelay: 35, waveLabel: 'More Crows!' },
    ],
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
    maxScore: 20 * 18 + 25 * 25 + 30 * 12, // 360 + 625 + 360 = 1345
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
      { type: 'flyingFish', count: 30, spawnDelay: 35, waveLabel: 'Flying Fish!' },
    ],
    starThresholds: [0.25, 0.55, 0.85],
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
    maxScore: 25 * 15 + 20 * 30 + 8 * 50, // 375 + 600 + 400 = 1375
    timerSeconds: 75,
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
    enemies: [
      { type: 'snowmanScout', count: 25, spawnDelay: 0, waveLabel: 'Scout Party' },
      { type: 'snowman', count: 20, spawnDelay: 20, waveLabel: 'Snowmen Incoming!' },
      { type: 'snowmanBrute', count: 8, spawnDelay: 45, waveLabel: 'Brutes!' },
    ],
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
