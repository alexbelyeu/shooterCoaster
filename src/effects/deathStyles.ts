/** Per-enemy-type death effects drawn by the pooled `ParticleExplosion`; pure, so unit-tested. */
import type { EnemyType } from '@/types/level'
import type { KillSound } from '@/audio/sfxDesign'
import type { Vec3 } from '@/entities/spawning/spawnPlacement'

/** `chunk` layers draw in the lit chunk mesh; every other shape is a stretched unlit box. */
export type ParticleShape = 'spark' | 'mote' | 'confetti' | 'feather' | 'drop' | 'chunk'

export interface DeathLayer {
  shape: ParticleShape
  count: number
  /** Each particle picks one. */
  colors: readonly string[]
  /** Colour multiplier for unlit shapes; above ~1.5 it blooms. */
  glow: number
  /** World units / s, in a random direction. */
  speed: readonly [number, number]
  /** Added upward launch speed, units / s. */
  up: number
  /** Velocity decay rate, 1 / s. */
  drag: number
  /** Units / s²; negative rises (smoke, motes). */
  gravity: number
  size: number
  /** Largest tumble rate, rad / s. */
  spin: number
  /** Fraction of the lifetime spent at full size before shrinking away. */
  hold: number
}

export interface DeathStyle {
  layers: readonly DeathLayer[]
  /** Seconds of game time. */
  lifetime: number
  /** Multiplies every layer's speed, up, gravity and size. */
  scale: number
  /** Emitted this far above the enemy's origin (ground enemies stand on it). */
  lift: number
  /** Peak intensity of the pool's one flash light. */
  flash: number
  flashColor: string
  sound: KillSound
}

/** Concurrent explosions; unlit particles and chunks per explosion. */
export const DEATH_SLOTS = 8
export const GLOW_PER_SLOT = 48
export const CHUNKS_PER_SLOT = 12

/** e2e `holdFeedback`: an explosion stops ageing at this fraction of its lifetime (spread out, still full size). */
export const HOLD_LIFE = 0.22

export const SHAPE_STRETCH: Record<ParticleShape, readonly [number, number, number]> = {
  spark: [1, 1, 1],
  mote: [1, 1, 1],
  confetti: [1, 0.65, 0.1],
  feather: [0.3, 1.4, 0.06],
  drop: [0.5, 1.3, 0.5],
  chunk: [1, 0.8, 0.9],
}

export function isChunk(layer: DeathLayer): boolean {
  return layer.shape === 'chunk'
}

/** Offset from the origin after `t` s: exponential drag on the launch velocity, plus gravity (ignoring drag). */
export function particleOffset(out: Vec3, v: Vec3, drag: number, gravity: number, t: number): Vec3 {
  const f = drag > 0 ? (1 - Math.exp(-drag * t)) / drag : t
  out.x = v.x * f
  out.y = v.y * f - 0.5 * gravity * t * t
  out.z = v.z * f
  return out
}

/** Size factor at `life` (0–1): 1 until `hold`, then linearly to 0. */
export function sizeAt(life: number, hold: number): number {
  if (life <= hold) return life < 0 ? 0 : 1
  if (life >= 1) return 0
  return 1 - (life - hold) / (1 - hold)
}

/** While e2e holds feedback, ageing stops at `HOLD_LIFE` (never rewinds). */
export function nextAge(age: number, dt: number, lifetime: number, held: boolean): number {
  if (!held) return age + dt
  const holdAt = lifetime * HOLD_LIFE
  return age >= holdAt ? age : Math.min(age + dt, holdAt)
}

const layer = (l: Partial<DeathLayer> & Pick<DeathLayer, 'shape' | 'count' | 'colors' | 'speed'>): DeathLayer => ({
  glow: 1, up: 0, drag: 2.5, gravity: 0, size: 2, spin: 0, hold: 0, ...l,
})

const FIRE = layer({ shape: 'spark', count: 30, colors: ['#ff5a2a', '#ffaa22'], glow: 3, speed: [10, 110], drag: 2.4, size: 2.4 })

/** The pre-#29 fireball, in gold. */
export const BOSS_PART_DEATH_STYLE: DeathStyle = {
  layers: [
    { ...FIRE, colors: ['#ffd700', '#ffb020'] },
    layer({ shape: 'spark', count: 15, colors: ['#ffffff'], glow: 4, speed: [60, 180], up: 90, drag: 1.2, gravity: 200, size: 0.6 }),
  ],
  lifetime: 1.5, scale: 1, lift: 0, flash: 8, flashColor: '#ffaa44', sound: 'pop',
}

const BALLOON_CONFETTI = ['#ff3b6b', '#ffd23f', '#3bc9ff', '#7dff6a', '#c86bff']

const SNOW_CRUMBLE = (ice: string): readonly DeathLayer[] => [
  layer({ shape: 'chunk', count: 9, colors: ['#f4f8ff', '#e2ecf8', ice], speed: [25, 70], up: 30, drag: 0.8, gravity: 140, size: 5.5, spin: 6, hold: 0.7 }),
  layer({ shape: 'mote', count: 28, colors: ['#ffffff', '#dbe9ff'], glow: 1.3, speed: [10, 60], drag: 2.2, gravity: -6, size: 3, hold: 0.2 }),
]

export const DEATH_STYLES: Record<EnemyType, DeathStyle> = {
  balloon: {
    layers: [
      layer({ shape: 'confetti', count: 40, colors: BALLOON_CONFETTI, glow: 1.6, speed: [30, 90], up: 20, drag: 3, gravity: 18, size: 5, spin: 9, hold: 0.6 }),
      layer({ shape: 'spark', count: 8, colors: ['#ffffff'], glow: 4, speed: [80, 140], drag: 4, size: 1.6 }),
    ],
    lifetime: 1.8, scale: 1, lift: 0, flash: 3, flashColor: '#ffffff', sound: 'pop',
  },
  crow: {
    layers: [
      layer({ shape: 'feather', count: 30, colors: ['#15151c', '#272a3a', '#3c3446'], glow: 1, speed: [25, 80], up: 10, drag: 3.2, gravity: 14, size: 7, spin: 7, hold: 0.65 }),
      layer({ shape: 'mote', count: 8, colors: ['#8a8590'], glow: 1, speed: [10, 40], drag: 3, gravity: -4, size: 2.5, hold: 0.1 }),
    ],
    lifetime: 2, scale: 1, lift: 0, flash: 0, flashColor: '#ffffff', sound: 'flutter',
  },
  scorpion: {
    layers: [
      layer({ shape: 'chunk', count: 10, colors: ['#3a2416', '#7a4a22', '#c08a3a'], speed: [30, 80], up: 45, drag: 0.6, gravity: 160, size: 5, spin: 10, hold: 0.7 }),
      layer({ shape: 'mote', count: 26, colors: ['#e2c58f', '#c9a46a'], glow: 1.2, speed: [10, 55], up: 10, drag: 2.5, gravity: -3, size: 4, hold: 0.15 }),
    ],
    lifetime: 1.6, scale: 1, lift: 4, flash: 2, flashColor: '#ffc070', sound: 'crunch',
  },
  shark: {
    layers: [
      layer({ shape: 'drop', count: 36, colors: ['#ffffff', '#bff4ff', '#6fd8f0'], glow: 1.8, speed: [15, 60], up: 85, drag: 0.5, gravity: 150, size: 4, hold: 0.6 }),
      layer({ shape: 'mote', count: 12, colors: ['#e8fbff'], glow: 1.4, speed: [20, 50], drag: 3, size: 6, hold: 0.3 }),
    ],
    lifetime: 1.6, scale: 1, lift: 0, flash: 0, flashColor: '#ffffff', sound: 'splash',
  },
  jellyfish: {
    layers: [
      layer({ shape: 'mote', count: 42, colors: ['#ff7ae0', '#b47cff', '#7af0ff'], glow: 3, speed: [8, 45], drag: 1.6, gravity: -14, size: 3.2, hold: 0.35 }),
    ],
    lifetime: 2.2, scale: 1, lift: 0, flash: 4, flashColor: '#d58cff', sound: 'hiss',
  },
  flyingFish: {
    layers: [
      layer({ shape: 'drop', count: 24, colors: ['#ffffff', '#bff4ff'], glow: 1.8, speed: [15, 50], up: 60, drag: 0.5, gravity: 140, size: 3.5, hold: 0.6 }),
      layer({ shape: 'confetti', count: 12, colors: ['#d8e6f0', '#8fb6d0'], glow: 1.5, speed: [30, 70], drag: 2.5, gravity: 40, size: 3.5, spin: 12, hold: 0.5 }),
    ],
    lifetime: 1.4, scale: 1, lift: 0, flash: 0, flashColor: '#ffffff', sound: 'splash',
  },
  snowman: { layers: SNOW_CRUMBLE('#cfe0f4'), lifetime: 1.8, scale: 2, lift: 40, flash: 0, flashColor: '#ffffff', sound: 'crunch' },
  snowmanScout: { layers: SNOW_CRUMBLE('#8fd6ff'), lifetime: 1.6, scale: 1.5, lift: 28, flash: 0, flashColor: '#ffffff', sound: 'crunch' },
  snowmanBrute: { layers: SNOW_CRUMBLE('#a8b8cc'), lifetime: 2, scale: 2.6, lift: 55, flash: 0, flashColor: '#ffffff', sound: 'crunch' },
  emberWisp: {
    layers: [
      layer({ shape: 'spark', count: 44, colors: ['#ffd24a', '#ff8a1e', '#ff4a10'], glow: 4, speed: [40, 150], up: 30, drag: 2, gravity: 60, size: 2.4, hold: 0.1 }),
    ],
    lifetime: 1.2, scale: 1, lift: 0, flash: 6, flashColor: '#ff9a30', sound: 'hiss',
  },
  fireImp: {
    layers: [
      layer({ shape: 'spark', count: 36, colors: ['#ff3a1a', '#ff7a1a', '#ffd04a'], glow: 3.5, speed: [30, 130], up: 20, drag: 2.2, gravity: 40, size: 2.6, hold: 0.1 }),
      layer({ shape: 'mote', count: 10, colors: ['#2a1a18', '#3e2a24'], glow: 1, speed: [10, 40], drag: 2, gravity: -20, size: 5, hold: 0.3 }),
    ],
    lifetime: 1.4, scale: 1.2, lift: 6, flash: 7, flashColor: '#ff5a20', sound: 'hiss',
  },
  lavaGolem: {
    layers: [
      layer({ shape: 'chunk', count: 5, colors: ['#1c1412', '#2e1c16', '#4a2414'], speed: [30, 70], up: 40, drag: 0.4, gravity: 130, size: 9, spin: 4, hold: 0.75 }),
      layer({ shape: 'spark', count: 38, colors: ['#ff6a10', '#ffb030', '#ff3a08'], glow: 3.5, speed: [30, 120], up: 50, drag: 1.4, gravity: 120, size: 2.6, hold: 0.2 }),
    ],
    lifetime: 1.8, scale: 2.4, lift: 100, flash: 8, flashColor: '#ff6a20', sound: 'crunch',
  },
  infernalDrake: {
    layers: [
      layer({ ...FIRE, count: 26, colors: ['#ff3a10', '#ff9a20'] }),
      layer({ shape: 'chunk', count: 4, colors: ['#3a0e0a', '#5a1a10'], speed: [15, 45], drag: 0.3, gravity: 120, size: 6, spin: 5, hold: 0.8 }),
      layer({ shape: 'mote', count: 18, colors: ['#262222', '#3a3434'], glow: 1, speed: [10, 40], drag: 1.2, gravity: -22, size: 5, hold: 0.4 }),
    ],
    lifetime: 2.2, scale: 2.5, lift: 0, flash: 9, flashColor: '#ff6a20', sound: 'hiss',
  },
}

/** Particles a style puts in each of the pool's two meshes. */
export function styleCounts(style: DeathStyle): { glow: number; chunks: number } {
  let glow = 0
  let chunks = 0
  for (const l of style.layers) {
    if (isChunk(l)) chunks += l.count
    else glow += l.count
  }
  return { glow, chunks }
}
