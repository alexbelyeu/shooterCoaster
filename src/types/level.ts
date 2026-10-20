import type { Color } from 'three'

export type CurveType = 'curve1' | 'curve2'
export type BiomeType = 'themePark' | 'desert' | 'ocean' | 'arctic' | 'volcanic'
export type EnemyType = 'balloon' | 'crow' | 'scorpion' | 'shark' | 'jellyfish' | 'flyingFish' | 'snowman' | 'snowmanScout' | 'snowmanBrute' | 'emberWisp' | 'lavaGolem' | 'fireImp' | 'infernalDrake'

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
  /** Running-rail radius at trackScale 1 (default 0.35); multiplied by trackScale. See src/track/trackDimensions.ts */
  railRadius?: number
  /** Arc-length spacing between cross ties at trackScale 1 (default 10); multiplied by trackScale. */
  tieSpacing?: number
}

export interface EnemyWave {
  type: EnemyType
  count: number
  spawnDelay?: number
  waveLabel?: string
  isEruption?: boolean
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
    hasWater?: boolean
    hasTrees?: boolean
    treeCount?: number
  }
}
