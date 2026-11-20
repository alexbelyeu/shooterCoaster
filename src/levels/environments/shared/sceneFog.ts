import type { AtmosphereConfig } from '../atmosphere'

export interface FogRange {
  near: number
  far: number
}

/** One effect's pull on the scene fog: its near and far as multiples of the biome's (1 leaves the fog alone). */
export type FogModifier = FogRange

/** What each effect publishes for the fog's owner (`BiomeEnvironment`) to combine once a frame. */
export interface FogModifiers {
  dark: FogModifier
  eruption: FogModifier
  weather: FogModifier
}

export function createFogModifiers(): FogModifiers {
  return { dark: { near: 1, far: 1 }, eruption: { near: 1, far: 1 }, weather: { near: 1, far: 1 } }
}

export function resetFogModifiers(mods: FogModifiers): void {
  mods.dark.near = mods.dark.far = 1
  mods.eruption.near = mods.eruption.far = 1
  mods.weather.near = mods.weather.far = 1
}

/** The fog never starts past this share of its far, so a far closing in pulls the near along. */
const NEAR_SHARE_OF_FAR = 0.5

/** The biome's fog with every effect's modifier multiplied in, written into `out`: called every frame. */
export function combineFog(base: Pick<AtmosphereConfig, 'fogNear' | 'fogFar'>, mods: FogModifiers, out: FogRange): FogRange {
  const far = base.fogFar * mods.dark.far * mods.eruption.far * mods.weather.far
  const near = base.fogNear * mods.dark.near * mods.eruption.near * mods.weather.near
  out.far = far
  out.near = Math.min(near, far * NEAR_SHARE_OF_FAR)
  return out
}
