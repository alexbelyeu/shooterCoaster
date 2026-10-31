import type { ParticleBoost, ParticleFieldPreset } from './types'

/** Ambient air per biome (`BiomeDefinition.particles`); dense or bright fields read as noise at 1280×720, so stay inside the test's bounds. */

/** Theme Park: sparse warm pollen, with a few pink motes tumbling (flickering) through it. */
const parkPollen: ParticleFieldPreset = {
  count: 1400,
  box: [420, 220, 420],
  primary: {
    color: 0xfff0b8,
    opacity: 0.55,
    size: 0.9,
    maxPixels: 3,
    velocity: [2, -1.5, 1.5],
    sway: 8,
    flicker: 0.3,
    additive: false,
  },
  secondary: {
    color: 0xff9ccf,
    opacity: 0.65,
    size: 1.0,
    maxPixels: 3,
    velocity: [3, -2, 1],
    sway: 10,
    flicker: 0.9,
    additive: false,
  },
  secondaryShare: 0.25,
}

/** Desert: sparse, faint sand blowing sideways, with the odd sunlit grain glinting. */
const desertDust: ParticleFieldPreset = {
  count: 1400,
  box: [480, 200, 480],
  primary: {
    // A shade darker than the hazy sky, or it vanishes against it
    color: 0xa98058,
    opacity: 0.4,
    size: 1.2,
    maxPixels: 4,
    velocity: [16, 0.8, 5],
    sway: 3,
    flicker: 0,
    additive: false,
  },
  secondary: {
    color: 0xfff0c8,
    opacity: 0.5,
    size: 0.6,
    maxPixels: 2,
    velocity: [18, 1.5, 6],
    sway: 4,
    flicker: 0.6,
    additive: true,
  },
  secondaryShare: 0.15,
}

/** Ocean: small cyan motes rising off the water, a few brighter ones pulsing. */
const oceanPlankton: ParticleFieldPreset = {
  count: 1800,
  box: [440, 220, 440],
  primary: {
    color: 0x7fe6ff,
    opacity: 0.45,
    size: 0.7,
    maxPixels: 3,
    velocity: [1, 3, 0.5],
    sway: 4,
    flicker: 0.4,
    additive: true,
  },
  secondary: {
    color: 0xc8fff0,
    opacity: 0.6,
    size: 0.9,
    maxPixels: 3,
    velocity: [0.5, 4, 1],
    sway: 5,
    flicker: 0.8,
    additive: true,
  },
  secondaryShare: 0.15,
}

/** Antarctica: slow swaying flakes, with finer ones falling faster behind them. */
const arcticSnow: ParticleFieldPreset = {
  count: 2600,
  box: [480, 260, 480],
  primary: {
    color: 0xf4f8ff,
    opacity: 0.75,
    size: 1.3,
    maxPixels: 5,
    velocity: [3, -9, 1],
    sway: 6,
    flicker: 0,
    additive: false,
  },
  secondary: {
    color: 0xe2ecff,
    opacity: 0.55,
    size: 0.7,
    maxPixels: 3,
    velocity: [5, -14, 2],
    sway: 3,
    flicker: 0,
    additive: false,
  },
  secondaryShare: 0.35,
}

/** Volcano: grey ash drifting down, tiny orange embers rising through it; an eruption adds a burst of embers. */
const volcanicAsh: ParticleFieldPreset = {
  count: 3000,
  box: [520, 280, 520],
  primary: {
    color: 0x9a918a,
    opacity: 0.6,
    size: 1.0,
    maxPixels: 4,
    velocity: [4, -7, 2],
    sway: 5,
    flicker: 0,
    additive: false,
  },
  secondary: {
    color: 0xff6a1a,
    opacity: 0.9,
    size: 0.8,
    maxPixels: 4,
    velocity: [1, 12, 0],
    sway: 7,
    flicker: 1,
    additive: true,
  },
  secondaryShare: 0.2,
  boost: { event: 'eruption:start', count: 600, riseS: 0.25, holdS: 3, fadeS: 1 },
}

export const PARTICLE_PRESETS = { parkPollen, desertDust, oceanPlankton, arcticSnow, volcanicAsh } as const

/** Points to draw: always-on and boost-only. Touch screens get half (as `renderBudget.ts` cuts their pixels). */
export function particleCounts(preset: ParticleFieldPreset, coarsePointer: boolean): { base: number; boost: number } {
  const scale = coarsePointer ? 0.5 : 1
  return {
    base: Math.round(preset.count * scale),
    boost: Math.round((preset.boost?.count ?? 0) * scale),
  }
}

/** 0..1 strength of a boost `elapsed` seconds after its event: linear rise over `riseS`, full until `riseS + holdS`, then a linear fade over `fadeS`. */
export function boostStrength(boost: ParticleBoost, elapsed: number): number {
  const rise = Math.min(1, Math.max(0, elapsed / boost.riseS))
  const fade = Math.min(1, Math.max(0, (elapsed - boost.riseS - boost.holdS) / boost.fadeS))
  return rise * (1 - fade)
}
