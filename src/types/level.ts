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

/**
 * How a wave arrives (`entities/spawning/spawnPlacement.ts`). `scatter` (the default)
 * spreads it over the level; the others build groups ahead of the rider at activation
 * that fly, rise or swirl into their slots.
 */
export type Formation = 'scatter' | 'v' | 'line' | 'school' | 'spiral' | 'ring'

/** A formation's anchor relative to the rider's track position at activation (world units). */
export interface FormationOrigin {
  /** Arc distance ahead along the track. */
  ahead: number
  /** Sideways off the track (+ = right of travel); later groups alternate sides. */
  side: number
  /** Height above the track. */
  up: number
}

export interface EnemyWave {
  type: EnemyType
  count: number
  spawnDelay?: number
  waveLabel?: string
  isEruption?: boolean
  formation?: Formation
  /** Overrides the formation's default anchor. */
  formationOrigin?: FormationOrigin
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
  /** Per-level bullet look; unset fields fall back to BulletPool's defaults (red, size 10). */
  combat?: {
    bulletColor?: string
    bulletSize?: number
  }
  environment: {
    hasWater?: boolean
    hasTrees?: boolean
    treeCount?: number
  }
}
