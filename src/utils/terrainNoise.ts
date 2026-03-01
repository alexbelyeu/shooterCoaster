/**
 * Simplex noise-based terrain height generation with per-biome configs.
 * Self-contained 2D simplex noise — no external dependencies.
 */

import type { BiomeType } from '@/types/level'

// --- 2D Simplex Noise (based on Stefan Gustavson's implementation) ---

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

const grad3: [number, number][] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
]

// Deterministic permutation table (seeded)
const perm = new Uint8Array(512)
const permMod12 = new Uint8Array(512)

function seedNoise(seed: number) {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  // Fisher-Yates shuffle with seed
  let s = seed
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647
    const j = s % (i + 1)
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    permMod12[i] = perm[i] % 12
  }
}

seedNoise(42)

function simplex2(x: number, y: number): number {
  const s = (x + y) * F2
  const i = Math.floor(x + s)
  const j = Math.floor(y + s)
  const t = (i + j) * G2
  const X0 = i - t
  const Y0 = j - t
  const x0 = x - X0
  const y0 = y - Y0

  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1

  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2

  const ii = i & 255
  const jj = j & 255

  let n0 = 0, n1 = 0, n2 = 0

  let t0 = 0.5 - x0 * x0 - y0 * y0
  if (t0 >= 0) {
    t0 *= t0
    const gi0 = permMod12[ii + perm[jj]]
    n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0)
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1
  if (t1 >= 0) {
    t1 *= t1
    const gi1 = permMod12[ii + i1 + perm[jj + j1]]
    n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1)
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2
  if (t2 >= 0) {
    t2 *= t2
    const gi2 = permMod12[ii + 1 + perm[jj + 1]]
    n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2)
  }

  // Returns value in [-1, 1]
  return 70 * (n0 + n1 + n2)
}

// --- Terrain Config ---

export interface TerrainConfig {
  /** Noise frequency (lower = larger features) */
  frequency: number
  /** Maximum amplitude in world units */
  amplitude: number
  /** Number of octaves for fractal detail */
  octaves: number
  /** How much each octave's amplitude decreases (0-1) */
  persistence: number
  /** Lacunarity: how much each octave's frequency increases */
  lacunarity: number
  /** Exponent applied to final height (>1 = sharper peaks, <1 = flatter) */
  exponent: number
  /** Use ridge noise (1 - abs(noise)) for sharp peaks */
  ridgeMode: boolean
  /** Y offset applied to the entire terrain (e.g. -40 for underwater) */
  baseY: number
  /** Radius of flat center valley (track area) */
  flatRadius: number
  /** Transition width from flat to full-height terrain */
  transitionWidth: number
}

export const BIOME_TERRAIN_CONFIGS: Record<BiomeType, TerrainConfig> = {
  themePark: {
    frequency: 0.0008,
    amplitude: 500,
    octaves: 5,
    persistence: 0.45,
    lacunarity: 2.2,
    exponent: 1.4,
    ridgeMode: false,
    baseY: 0,
    flatRadius: 600,
    transitionWidth: 800,
  },
  desert: {
    frequency: 0.001,
    amplitude: 200,
    octaves: 3,
    persistence: 0.4,
    lacunarity: 2.0,
    exponent: 1.2,
    ridgeMode: true,
    baseY: 0,
    flatRadius: 600,
    transitionWidth: 600,
  },
  ocean: {
    frequency: 0.0007,
    amplitude: 300,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.3,
    exponent: 1.8,
    ridgeMode: false,
    baseY: -40,
    flatRadius: 600,
    transitionWidth: 700,
  },
  arctic: {
    frequency: 0.0006,
    amplitude: 600,
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.1,
    exponent: 1.3,
    ridgeMode: true,
    baseY: 0,
    flatRadius: 600,
    transitionWidth: 900,
  },
  volcanic: {
    frequency: 0.0006,
    amplitude: 250,
    octaves: 5,
    persistence: 0.5,
    lacunarity: 2.2,
    exponent: 1.3,
    ridgeMode: true,
    baseY: 0,
    flatRadius: 600,
    transitionWidth: 900,
  },
}

/** Desert gets an extra macro-scale mesa layer */
function mesaNoise(x: number, z: number): number {
  const n = simplex2(x * 0.0003, z * 0.0003)
  // Step function: flat tops when noise > threshold
  const mesa = Math.max(0, n - 0.2) * 2.5
  return Math.min(mesa, 1) * 150
}

export type HeightFunction = (x: number, z: number) => number

/** Pre-sampled track point for terrain suppression */
interface TrackSample {
  x: number
  y: number
  z: number
}

/** Hard clamp radius — terrain is always forced below track here */
const TRACK_HARD_RADIUS = 40
/** Soft blend radius — terrain transitions from suppressed to natural */
const TRACK_SOFT_RADIUS = 120
/** Extra clearance below the track */
const TRACK_CLEARANCE = 15

/**
 * Pre-sample a track curve to build a lookup table for terrain suppression.
 * Uses a simple interface so we don't import Three.js types here.
 */
export function sampleTrackPath(
  getPointAt: (t: number) => { x: number; y: number; z: number },
  sampleCount = 500,
): TrackSample[] {
  const samples: TrackSample[] = []
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleCount
    const p = getPointAt(t)
    samples.push({ x: p.x, y: p.y, z: p.z })
  }
  return samples
}

/**
 * Creates a height function for the given biome terrain config.
 * If trackSamples is provided, terrain is suppressed near the track path
 * so the coaster never goes underground.
 */
export function createHeightFunction(
  biome: BiomeType,
  trackSamples?: TrackSample[],
): HeightFunction {
  const config = BIOME_TERRAIN_CONFIGS[biome]

  return (x: number, z: number): number => {
    const dist = Math.sqrt(x * x + z * z)

    // Distance-based amplitude envelope: flat center, rising to full at edges
    let envelope: number
    if (dist < config.flatRadius) {
      envelope = 0
    } else if (dist < config.flatRadius + config.transitionWidth) {
      const t = (dist - config.flatRadius) / config.transitionWidth
      // Smooth ease-in curve
      envelope = t * t * (3 - 2 * t)
    } else {
      envelope = 1
    }

    // Multi-octave fractal noise
    let value = 0
    let amp = 1
    let freq = config.frequency
    let maxAmp = 0

    for (let o = 0; o < config.octaves; o++) {
      let n = simplex2(x * freq, z * freq)

      if (config.ridgeMode) {
        // Ridge noise: sharp peaks
        n = 1 - Math.abs(n)
        n = n * n // Sharpen ridges
      } else {
        // Regular noise: remap from [-1,1] to [0,1]
        n = (n + 1) * 0.5
      }

      value += n * amp
      maxAmp += amp
      amp *= config.persistence
      freq *= config.lacunarity
    }

    // Normalize to [0, 1]
    value /= maxAmp

    // Apply exponent for peak sharpness
    value = Math.pow(value, config.exponent)

    // Apply envelope and amplitude
    let height = value * config.amplitude * envelope + config.baseY

    // Desert mesa overlay
    if (biome === 'desert') {
      height += mesaNoise(x, z) * envelope
    }

    // Ensure flat center stays at base level
    if (envelope === 0) {
      height = config.baseY
    }

    // --- Track corridor suppression ---
    // Find the lowest track Y among all nearby samples, then suppress terrain below it.
    // Two zones: hard clamp (inner) and smooth blend (outer).
    if (trackSamples) {
      const softR2 = TRACK_SOFT_RADIUS * TRACK_SOFT_RADIUS
      let minDist2D = Infinity
      let lowestTrackY = Infinity

      for (let i = 0; i < trackSamples.length; i++) {
        const s = trackSamples[i]
        const dx = x - s.x
        const dz = z - s.z
        const d2 = dx * dx + dz * dz
        if (d2 < softR2) {
          // Track the closest point AND the lowest track Y within range
          if (d2 < minDist2D) {
            minDist2D = d2
          }
          if (s.y < lowestTrackY) {
            lowestTrackY = s.y
          }
        }
      }

      if (minDist2D < softR2) {
        const dist2D = Math.sqrt(minDist2D)
        const maxAllowed = lowestTrackY - TRACK_CLEARANCE

        if (height > maxAllowed) {
          if (dist2D < TRACK_HARD_RADIUS) {
            // Hard zone: always clamp
            height = maxAllowed
          } else {
            // Soft zone: smooth blend from clamped to natural
            const blend = (dist2D - TRACK_HARD_RADIUS) / (TRACK_SOFT_RADIUS - TRACK_HARD_RADIUS)
            const smoothBlend = blend * blend * (3 - 2 * blend)
            height = maxAllowed + (height - maxAllowed) * smoothBlend
          }
        }
      }
    }

    return height
  }
}

/**
 * Compute terrain slope at a point (for slope-based coloring and tree rejection).
 * Returns slope angle in radians (0 = flat, PI/2 = vertical).
 */
export function getTerrainSlope(
  heightFn: HeightFunction,
  x: number,
  z: number,
  delta = 5,
): number {
  const h = heightFn(x, z)
  const hx = heightFn(x + delta, z)
  const hz = heightFn(x, z + delta)
  const dx = (hx - h) / delta
  const dz = (hz - h) / delta
  return Math.atan(Math.sqrt(dx * dx + dz * dz))
}
