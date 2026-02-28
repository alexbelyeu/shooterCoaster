import type { Color } from 'three'

export type CurveType = 'curve1' | 'curve2'
export type BiomeType = 'themePark' | 'desert' | 'ocean' | 'arctic'
export type EnemyType = 'balloon' | 'crow' | 'scorpion' | 'shark' | 'jellyfish' | 'flyingFish' | 'snowman' | 'snowmanScout' | 'snowmanBrute'

export interface TrackParams {
  varA: number
  varB: number
  varC: number
  scalar: number
  rollerSpeed: number
  minRollerSpeed: number
  curve: CurveType
  color1: number
  color2: number
}

export interface EnemyWave {
  type: EnemyType
  count: number
  spawnDelay?: number
  waveLabel?: string
}

export interface LevelConfig {
  id: string
  name: string
  description: string
  order: number
  biome: BiomeType
  maxScore: number
  timerSeconds: number
  message: string
  nextLevel: string | null
  track: TrackParams
  enemies: EnemyWave[]
  starThresholds: [number, number, number] // 1-star, 2-star, 3-star percentages
  environment: {
    groundColor: number
    skybox: string
    fog?: { color: number; near: number; far: number }
    hasWater?: boolean
    hasTrees?: boolean
    treeCount?: number
  }
}
