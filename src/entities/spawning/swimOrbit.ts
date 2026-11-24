import type { EnemyType } from '@/types/level'
import type { TrackIndex } from '@/levels/environments/shared/trackClearance'
import type { HeightFunction } from '@/utils/terrainNoise'
import type { Rng } from '@/utils/rng'
import { WATER_DEPTH } from './enemyPlacement'
import type { KeepOff } from './spawnPlacement'

/**
 * A circle a swimmer laps through its spawn point (#356, #922): its centre is `radius` from the spawn point,
 * the way `phase` (radians in world x / z) points back from it. Chosen once at placement, clear of the world.
 */
export interface SwimOrbit {
  radius: number
  phase: number
}

export interface OrbitBand {
  radiusMin: number
  radiusMax: number
  /** The last resort of a spawn point hemmed in by the rails, the stacks or the shore: a tight turn on the spot. */
  tight: number
  /** 2D clearance of every point of the circle from the rails and their towers (the Kraken's, `krakenMotion.ts` `SPOTS`). */
  clearance: number
}

/** The enemies that lap a circle, and its size: the shark is ~55 long, its circle small enough to stay beside the track it was placed by (#316). */
export const ORBITS: Partial<Record<EnemyType, OrbitBand>> = {
  shark: { radiusMin: 25, radiusMax: 60, tight: 12, clearance: 45 },
}

/** What a circle keeps clear of: the rails (`buildTrackIndex`), what stands out of the sea (`BiomeDefinition.keepOff`) and the shore. */
export interface OrbitWorld {
  index: TrackIndex
  keepOff: readonly KeepOff[]
  groundFn: HeightFunction
}

/** Points sampled round a circle; random circles drawn, then a sweep of every heading at three radii across the band and the tight one. */
const SAMPLES = 24
const TRIES = 16
const HEADINGS = 24

/** The point `a` radians round the circle from its start (`a` = 0 is the spawn point). */
export function orbitPoint(spawn: { x: number; z: number }, { radius, phase }: SwimOrbit, a: number): { x: number; z: number } {
  return {
    x: spawn.x + radius * (Math.cos(phase + a) - Math.cos(phase)),
    z: spawn.z + radius * (Math.sin(phase + a) - Math.sin(phase)),
  }
}

/** How many of the circle's sampled points are near the rails, inside a keep-off circle or over the shallows and shore. */
export function orbitBlocked(spawn: { x: number; z: number }, orbit: SwimOrbit, band: OrbitBand, world: OrbitWorld): number {
  let blocked = 0
  for (let k = 0; k < SAMPLES; k++) {
    const { x, z } = orbitPoint(spawn, orbit, (k / SAMPLES) * Math.PI * 2)
    if (
      world.groundFn(x, z) >= WATER_DEPTH
      || world.index.near(x, z, band.clearance)
      || world.keepOff.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)
    ) blocked++
  }
  return blocked
}

/**
 * A random circle clear all round; failing that, the first clear one of a sweep (the smallest first, from a random
 * heading); else the least blocked of them all (the smaller on a tie), as when the spawn point itself is hemmed in.
 */
export function placeOrbit(spawn: { x: number; z: number }, band: OrbitBand, world: OrbitWorld, rng: Rng): SwimOrbit {
  let best: SwimOrbit | null = null
  let bestBlocked = Infinity
  const consider = (orbit: SwimOrbit): boolean => {
    const blocked = orbitBlocked(spawn, orbit, band, world)
    if (blocked < bestBlocked || (blocked === bestBlocked && orbit.radius < best!.radius)) {
      best = orbit
      bestBlocked = blocked
    }
    return blocked === 0
  }
  for (let k = 0; k < TRIES; k++) {
    if (consider({ radius: rng.range(band.radiusMin, band.radiusMax), phase: rng() * Math.PI * 2 })) return best!
  }
  const from = rng() * Math.PI * 2
  for (const radius of [band.radiusMin, (band.radiusMin + band.radiusMax) / 2, band.radiusMax, band.tight]) {
    for (let h = 0; h < HEADINGS; h++) {
      if (consider({ radius, phase: from + (h / HEADINGS) * Math.PI * 2 })) return best!
    }
  }
  return best!
}
