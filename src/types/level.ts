import type { PickupWeaponId } from '@/combat/weapons/weaponTypes'

/** Every biome id, the one list (#509): anything per biome is a `Record<BiomeType, …>`, so a missing one fails `tsc -b`. */
export const BIOME_TYPES = ['themePark', 'desert', 'ocean', 'arctic', 'volcanic', 'gym', 'city', 'jungle'] as const
export type BiomeType = (typeof BIOME_TYPES)[number]
export type BossType = 'goldenBlimp' | 'kraken' | 'giantScorpion' | 'yeti' | 'magmaTitan' | 'medusa' | 'helicopter'
export type EnemyType = 'balloon' | 'crow' | 'scorpion' | 'shark' | 'jellyfish' | 'flyingFish' | 'snowman' | 'snowmanScout' | 'snowmanBrute' | 'emberWisp' | 'lavaGolem' | 'fireImp' | 'infernalDrake' | 'climber' | 'rat' | 'dustBunny' | 'lanternfly' | 'hoverDrone' | 'billboardBot' | 'toucan'

/**
 * A wall (#453), climbable unless it is a `perch`: from `origin`, its bottom-left corner, along unit `right` and `up`; it
 * faces `right × up`.
 */
export interface WallSurface {
  id: string
  origin: { x: number; y: number; z: number }
  right: { x: number; y: number; z: number }
  up: { x: number; y: number; z: number }
  width: number
  height: number
  /** Only fliers land on it (a swarm, `placeWallSwarm`): a roof's underside, say. Nobody climbs it (#948). */
  perch?: boolean
}

/** What every track has, whatever its curve. */
interface TrackBase {
  /** The trig curves' size; for every curve, the structure's scale (`trackDimensions.ts`). */
  scalar: number
  color1: number
  color2: number
  /** Running-rail radius at trackScale 1 (default 0.35); multiplied by trackScale. See src/track/trackDimensions.ts */
  railRadius?: number
  /** Arc-length spacing between cross ties at trackScale 1 (default 10); multiplied by trackScale. */
  tieSpacing?: number
  /** Arc-length spacing between support towers at trackScale 1 (default 50); multiplied by trackScale. */
  towerSpacing?: number
  /** Rings the rails are built from along the whole track (default 1000). */
  segments?: number
  /** The track's own colours also glow at this strength (default 0): `color2` spine and ties read ahead in a dark level. */
  glow?: number
  /** Set-pieces (#332): stretches where the track runs through a lit tube (`src/track/setPieces.ts`). */
  tunnels?: readonly TunnelSpec[]
  /** Dark sections (#752): stretches ridden in the dark, the level's light and fog dimmed (`src/track/darkSection.hot.ts`). */
  darkSections?: readonly DarkSectionSpec[]
  /** Special ride mechanics (#699, `src/track/mechanics.ts`): they set a v2 ride's zones and stops; only a junction runs on either ride. */
  mechanics?: readonly RideMechanic[]
}

/** Today's speed rule (`ridePhysics.ts`): the car rolls by its slope between these speeds. */
interface RuleRide {
  ride?: undefined
  rideV2?: undefined
  rollerSpeed: number
  minRollerSpeed: number
}

/** The v2 ride (#696): gravity, speed zones and beats solved to land on their seconds (`rideV2.ts`, set by `rideV2`). */
interface V2Ride {
  ride: 'v2'
  rideV2?: RideV2Spec
}

/** How a track is ridden: today's rule, or the v2 ride, which needs none of the rule's speeds (#757). */
type TrackRide = RuleRide | V2Ride

/** A closed trig loop (`TrigCurve`), shaped by `varA` / `varB` / `varC`. */
export type TrigTrackParams = TrackBase & TrackRide & TrigCurveFields

interface TrigCurveFields {
  curve: 'curve1'
  varA: number
  varB: number
  varC: number
}

/** An authored spline (`SplineCurve`, #514). */
export type SplineTrackParams = TrackBase & TrackRide & SplineCurveFields

interface SplineCurveFields {
  curve: 'spline'
  /**
   * The points in world units, in ride order; the loop closes from the last to the first. A point's `up`
   * rolls the track there (banks, inversions; `src/track/elements/` builds them, #698).
   */
  controlPoints: readonly { x: number; y: number; z: number; up?: { x: number; y: number; z: number } }[]
}

/** A level's track: build its curve with `createTrackCurve`, never a curve factory picked by hand. */
export type TrackParams = TrigTrackParams | SplineTrackParams

/**
 * A special ride mechanic (#699, `src/track/mechanics.ts`) from `from` to `to`, shares of the lap's arc length (not across the seam):
 * - station: the car stands at `from` (0) for the countdown; GO launches it over fins toward `speed` by `to`.
 * - dropTrack: the car stops at `from` for `seconds`, then its piece of track free-falls with it to the track below at `to`.
 * - jumpGap: no rails from `from` to `to`, a ballistic flight built for `speed`, which a booster from `boostFrom` sets.
 * - backwards: turntables at `from` and `to` (a stop of `seconds`, then a launch to `speed`); the car faces back between.
 * - junction (#702): a harder way round from the fork at `from` to the merge at `to` through `points` (world units, in ride
 *   order), on a spline track. A switch sign before the fork sets the run's route: shoot it to take this way. One per
 *   track, its sign after the lap's start; the branch gets no towers or scenery clearance (`docs/RIDE-KIT.md`).
 */
export type RideMechanic =
  | { kind: 'station'; from: number; to: number; speed: number }
  | { kind: 'dropTrack'; from: number; to: number; seconds: number }
  | { kind: 'jumpGap'; from: number; to: number; speed: number; boostFrom: number }
  | { kind: 'backwards'; from: number; to: number; seconds: number; speed: number }
  | { kind: 'junction'; from: number; to: number; points: readonly { x: number; y: number; z: number }[] }

/** A stop (#699): the car halts at share `at` of the lap's arc length for `seconds` (not warped by the beats' solver). */
export interface RideHold {
  at: number
  seconds: number
}

/**
 * A stretch of track that drives the car (#696), from `from` to `to` as shares of the lap's arc length (0..1; `to` < `from`
 * wraps over the seam). Speeds are world units per second, `accel` world units per second².
 */
export interface SpeedZone {
  /** launch: pushes up to `speed` (default `accel`: `speed` / 2, so ~2 s from rest); lift: never slower than `speed`, a chain;
   * brake: slows down to `speed` (default `accel`: the ride's gravity). */
  kind: 'launch' | 'lift' | 'brake'
  from: number
  to: number
  speed: number
  accel?: number
  /** brake only: coast until it must brake at `accel` to be down to `speed` at `to` (a stop's approach, #699). */
  stop?: boolean
}

/** A storyboard beat (#696): the car reaches share `at` of the lap's arc length (past 1: a later lap) `second` seconds after GO. */
export interface RideBeat {
  at: number
  second: number
}

/** The v2 ride (#696): defaults in `rideV2.ts` `RIDE_V2_DEFAULTS`. */
export interface RideV2Spec {
  zones?: readonly SpeedZone[]
  /** Stops in the ride (a drop track's top, a turntable); `mechanics` add their own. */
  holds?: readonly RideHold[]
  /** In ride order; the solver speeds up or slows down the ride between beats so each lands within `BEAT_TOLERANCE_SECONDS`. */
  beats?: readonly RideBeat[]
  /** World units per second². */
  gravity?: number
  /** Air and rolling drag: the speed lost per second is `drag` × speed². */
  drag?: number
  /** The car never rolls slower than this (world units per second), so a crest can't stall it. */
  crawl?: number
}

/** A tunnel from track fraction `from`, `length` world units of arc long; it may not cross the track's seam (t = 1). */
export interface TunnelSpec {
  from: number
  length: number
  /** A glass tube (level 3's, under the sea, #865): see-through between its ribs, no dark ride inside. */
  glass?: boolean
}

/**
 * A dark section (#752): from track parameter `from` to `to` (the ride's t, as `rideProgress` reports it), the light easing
 * down over `ramp` of t after `from` and back up over the `ramp` before `to`; it may not cross the track's seam. While
 * dark, a shot's muzzle flash lights what is ahead of and below the rider's view within `flashReach` world units. `look` is how it is dark
 * (`DarkSections.tsx` `LOOKS`): `blacklight` (the default, the gym's cave) or `ice` (level 4's ice cave, a blue glow). `reach`, when a set-piece
 * is built over it (level 4's vault, #911), is how far from the centreline (XZ) that reaches: `trackClearance.ts` keeps props out, as a tunnel's.
 */
export interface DarkSectionSpec {
  from: number
  to: number
  ramp: number
  flashReach: number
  look?: DarkLook
  reach?: number
  /** A floor it is ridden over (level 2's passage through the Pyramid, #937), `below` the rails and `halfWidth` either side of
   *  them: a `darkFloor` wave's walkers stand on it (`spawning/darkFloor.ts`). */
  floor?: { below: number; halfWidth: number }
}

export type DarkLook = 'blacklight' | 'ice'

/**
 * How a wave arrives; anything but `scatter` (the default) is laid out ahead of the rider by `spawnPlacement.ts`. A `column`
 * is single file down the rails' own line, held there: the one shape that fits a tunnel or a hole the rider sees straight
 * through (#937: level 5's lava tube and the volcano's exit hole), so it keeps the track's clearance, not the air's.
 */
export type Formation = 'scatter' | 'v' | 'line' | 'school' | 'spiral' | 'ring' | 'column'

/** Relative to the rider's track position at activation, in world units. */
export interface FormationOrigin {
  /** Arc distance ahead along the track. */
  ahead: number
  /** + = right of travel; later groups alternate sides. */
  side: number
  /** Height above the track. */
  up: number
}

export type WeatherKind = 'sandstorm' | 'blizzard'

export interface EnemyWave {
  type: EnemyType
  count: number
  /** Level-timer seconds, whole: the stored timer the spawner reads only changes once a second. */
  spawnDelay?: number
  waveLabel?: string
  isEruption?: boolean
  /** A weather pulse that blows in with the wave (#798): the spawner emits `weather:start`, the look and its rise / hold / fade
   *  are `WEATHER_LOOKS` (`levels/environments/shared/weatherPulse.ts`). A level's waves use one kind. */
  weather?: WeatherKind
  formation?: Formation
  /** Overrides the formation's default anchor. */
  formationOrigin?: FormationOrigin
  /** Scales the formation's spacing, a trackside wave's far side or a swarm's disc (default 1): a wider spread puts fewer members in one aim-assist circle (#1059). */
  formationSpread?: number
  /**
   * Bystanders who come with the wave (#518): people, not targets, so a wall type (`ENEMY_PLACEMENT`) on the level's
   * `walls`. Shooting one costs `BYSTANDER_PENALTY` and the combo; they are never kills, `maxScore` or the kill count.
   */
  bystanders?: { type: EnemyType; count: number }
  /**
   * Only a run on this route meets the wave (#720): 'hard', a run that shot its track's junction switch. It arrives on the
   * branch (`spawnPlacement.ts` `HardRoute`) while the car rides it; on the easy route it never spawns and never joins the
   * kill count. `maxScore` counts it: the harder way is the way to three stars.
   */
  route?: 'hard'
  /**
   * The wave stands on the floor of the dark section the rider is in or comes to next (#937: scorpions in the Pyramid's
   * passage), along it ahead of the rider (`spawning/darkFloor.ts`): a ground walker, no formation, on a track with a
   * `DarkSectionSpec.floor`.
   */
  darkFloor?: boolean
  /**
   * The wave hangs over the biome's raised top (`BiomeDefinition.perch`, #945: level 6's dust round the Flame through the
   * roll across it), from just above it to its `rise` (`spawning/perch.ts`): a ground walker, no formation.
   */
  perch?: boolean
}

/** A whale breaching across the ride (Ocean, #793), where and when the level puts it; the breach's own shape is `BREACH` in `biomes/ocean/whaleBreach.ts`. */
export interface WhaleBreachSpec {
  /** Level seconds at the ride's own pace (`rideProfile`): it runs on ride distance, so slow-mo slows it with the car. */
  startSeconds: number
  /** Out along the rider's heading at mid-breach, past the drawn terrain's edge. */
  lead: number
  /** Turned off that heading (radians, toward the ride's left). */
  aim: number
}

/** A rock arch standing across the rails, the ride threading it (#865: level 3's corkscrew through a sea stack). */
export interface SeaArchSpec {
  /** Where the arch crosses the rails, in plan, and the rails' heading there (radians, `atan2(dx, dz)`). */
  x: number
  z: number
  heading: number
  /** The opening: its width at the waterline's centre and the underside of its crown, in world y. */
  span: number
  crownY: number
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
  /**
   * The ride, when the registry carries it: level 1's (the run most players start first) and small hand-written tracks.
   * Every other ride comes with its world's chunk (`World.rides`, #960), so its data is never startup JS: read a level's
   * ride with `worlds.ts` `levelRide`, which has it once that chunk is in.
   */
  ride?: LevelRide
  enemies: EnemyWave[]
  starThresholds: [number, number, number] // 1-star, 2-star, 3-star percentages
  /** Finale: the boss arrives `at` seconds of level time after the start (its tell comes before). Spec in `entities/bosses/bossSpecs.ts`. */
  boss?: { type: BossType; at: number }
  /** Bonus golden balloons (`GOLDEN_BALLOON`), out for the whole ride and outside `maxScore`; none when unset. */
  goldenBalloons?: number
  /** Weapon pickups floating over the track, 2–4 (`combat/pickups/pickupPlacement.ts`); default one of each. */
  pickups?: PickupWeaponId[]
  /** Per-level bullet look; unset fields fall back to BulletPool's defaults (red, size 10). */
  combat?: {
    bulletColor?: string
    bulletSize?: number
  }
  environment: {
    hasWater?: boolean
    hasTrees?: boolean
    treeCount?: number
    /** Opt-in: an ocean level's whale breach; none when unset. */
    whale?: WhaleBreachSpec
  }
}

/** A level's track and what is built to it: `LevelConfig.ride`, or its world's chunk's (`World.rides`, #960). */
export interface LevelRide {
  track: TrackParams
  /** Walls its wall enemies (`ENEMY_PLACEMENT` surface `'wall'`) climb; required when it has any. */
  walls?: readonly WallSurface[]
  /** A sea arch over the rails (Ocean's Features); none when unset. */
  seaArch?: SeaArchSpec
}

/** A level with its ride in hand: what a run builds (`LevelScene`), and every level as tests see it (`shippedLevels.ts`). */
export type RiddenLevel = Omit<LevelConfig, 'ride'> & LevelRide
