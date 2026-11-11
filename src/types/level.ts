import type { PickupWeaponId } from '@/combat/weapons/weaponTypes'

export type CurveType = 'curve1' | 'curve2'
export type BiomeType = 'themePark' | 'desert' | 'ocean' | 'arctic' | 'volcanic' | 'gym'
export type BossType = 'goldenBlimp' | 'kraken' | 'giantScorpion' | 'yeti'
export type EnemyType = 'balloon' | 'crow' | 'scorpion' | 'shark' | 'jellyfish' | 'flyingFish' | 'snowman' | 'snowmanScout' | 'snowmanBrute' | 'emberWisp' | 'lavaGolem' | 'fireImp' | 'infernalDrake' | 'climber'

/** A climbable wall (#453): from `origin`, its bottom-left corner, along unit `right` and `up`; it faces `right × up`. */
export interface WallSurface {
  id: string
  origin: { x: number; y: number; z: number }
  right: { x: number; y: number; z: number }
  up: { x: number; y: number; z: number }
  width: number
  height: number
}

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
  /** The track's own colours also glow at this strength (default 0): `color2` spine and ties read ahead in a dark level. */
  glow?: number
}

/** How a wave arrives; anything but `scatter` (the default) is laid out ahead of the rider by `spawnPlacement.ts`. */
export type Formation = 'scatter' | 'v' | 'line' | 'school' | 'spiral' | 'ring'

/** Relative to the rider's track position at activation, in world units. */
export interface FormationOrigin {
  /** Arc distance ahead along the track. */
  ahead: number
  /** + = right of travel; later groups alternate sides. */
  side: number
  /** Height above the track. */
  up: number
}

export interface EnemyWave {
  type: EnemyType
  count: number
  /** Level-timer seconds, whole: the stored timer the spawner reads only changes once a second. */
  spawnDelay?: number
  waveLabel?: string
  isEruption?: boolean
  formation?: Formation
  /** Overrides the formation's default anchor. */
  formationOrigin?: FormationOrigin
  /** Wall enemies: the lowest start, as a fraction of the wall's height (default 0, the foot); a wave starting higher tops out sooner. */
  wallStart?: number
}

export interface LevelConfig {
  id: string
  name: string
  description: string
  order: number
  biome: BiomeType
  maxScore: number
  message: string
  nextLevel: string | null
  track: TrackParams
  enemies: EnemyWave[]
  starThresholds: [number, number, number] // 1-star, 2-star, 3-star percentages
  /** Finale: the boss arrives `at` seconds of level time after the start (its tell comes before). Spec in `entities/bosses/bossSpecs.ts`. */
  boss?: { type: BossType; at: number }
  /** Weapon pickups floating over the track, 2–4 (`combat/pickups/pickupPlacement.ts`); default one of each. */
  pickups?: PickupWeaponId[]
  /** Walls its wall enemies (`ENEMY_PLACEMENT` surface `'wall'`) climb; required when it has any. */
  walls?: WallSurface[]
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
