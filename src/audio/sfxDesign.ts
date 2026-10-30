/** Sound design data for SFXManager; no Tone import so it stays unit-testable. */
import type { BiomeType } from '@/types/level'
import { comboTierIndex } from '@/combat/comboTiers'

export interface KillLayers {
  thump: boolean
  ring: boolean
  swell: boolean
}

const KILL_LAYERS: readonly KillLayers[] = [
  { thump: false, ring: false, swell: false },
  { thump: true, ring: false, swell: false },
  { thump: true, ring: true, swell: false },
  { thump: true, ring: true, swell: true },
]

/** The combo tier (`combat/comboTiers.ts`): 0 = pop (1×), 1 = + thump (2×), 2 = + ring (3×), 3 = + swell (5×). */
export function killTier(combo: number): number {
  return comboTierIndex(combo)
}

/** Shared objects: don't mutate. */
export function killLayers(combo: number): KillLayers {
  return KILL_LAYERS[killTier(combo)]
}

export interface FireVariant {
  startHz: number
  endHz: number
  sweepS: number
}

export const FIRE_VARIANTS: readonly FireVariant[] = [
  { startHz: 1150, endHz: 260, sweepS: 0.1 },
  { startHz: 980, endHz: 220, sweepS: 0.085 },
  { startHz: 1320, endHz: 300, sweepS: 0.115 },
]

/** Held-trigger auto-fire sits 6 dB lower. */
export function fireVelocity(auto: boolean): number {
  return auto ? 0.5 : 1
}

export interface StingerDesign {
  chords: readonly [readonly string[], readonly string[]]
  oscillator: 'fatsawtooth' | 'triangle' | 'fmsine' | 'sawtooth'
  /** FM ratio / depth, 'fmsine' only. */
  harmonicity?: number
  modulationIndex?: number
  attack: number
  decay: number
  sustain: number
  release: number
  cutoffHz: number
  /** dB */
  volume: number
  /** Sub-thump note under each chord. */
  drum: readonly [string, string] | null
  /** 0–1; 0 creates no Distortion node. */
  drive: number
}

/** Combo-break down-tick: a soft falling triangle blip. */
export const COMBO_BREAK = { startHz: 660, endHz: 300, sweepS: 0.18, volume: -20 } as const

export const STINGER_CHORD_GAP_S = 0.14

/** Chords follow MusicManager's per-biome keys (C major, A minor, Eb major, D sus, D minor). */
export const STINGERS: Record<BiomeType, StingerDesign> = {
  // Carnival brass: detuned saws, a V → I fanfare.
  themePark: {
    chords: [['G3', 'B3', 'D4'], ['C4', 'E4', 'G4']],
    oscillator: 'fatsawtooth',
    attack: 0.02, decay: 0.25, sustain: 0.3, release: 0.25,
    cutoffHz: 2200, volume: -24, drum: null, drive: 0,
  },
  // Low drum: muted triangles over membrane hits, E → Am.
  desert: {
    chords: [['E2', 'G#2', 'B2'], ['A2', 'C3', 'E3']],
    oscillator: 'triangle',
    attack: 0.005, decay: 0.35, sustain: 0, release: 0.2,
    cutoffHz: 900, volume: -18, drum: ['E1', 'A1'], drive: 0,
  },
  // Bell: FM sines with a long ring, Bb → Eb.
  ocean: {
    chords: [['Bb3', 'D4', 'F4'], ['Eb4', 'G4', 'Bb4']],
    oscillator: 'fmsine', harmonicity: 3.01, modulationIndex: 4,
    attack: 0.002, decay: 1.1, sustain: 0, release: 0.6,
    cutoffHz: 6000, volume: -22, drum: null, drive: 0,
  },
  // Glass: high, bright FM with an inharmonic ratio, open fifths.
  arctic: {
    chords: [['A4', 'D5', 'E5'], ['D5', 'A5', 'E6']],
    oscillator: 'fmsine', harmonicity: 7.1, modulationIndex: 2,
    attack: 0.001, decay: 0.8, sustain: 0, release: 0.5,
    cutoffHz: 9000, volume: -26, drum: null, drive: 0,
  },
  // Distorted saws with a drum, A → Dm.
  volcanic: {
    chords: [['A2', 'C#3', 'E3'], ['D3', 'F3', 'A3']],
    oscillator: 'sawtooth',
    attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.25,
    cutoffHz: 1800, volume: -26, drum: ['A1', 'D2'], drive: 0.6,
  },
}

export const STINGER_VOICES = 3

export const STAR_CHIME_NOTES = ['E5', 'G5', 'C6'] as const

/** Boss cues: arrival chords on the biome's stinger voices + thump, a hit thud, a defeat boom under a major chord. */
export const BOSS_SFX = {
  arrival: {
    chords: [['C3', 'Eb3', 'G3'], ['Ab2', 'C3', 'Eb3'], ['G2', 'B2', 'D3']],
    drum: ['C1', 'Ab0', 'G0'],
    gapS: 0.24,
  },
  hit: { baseHz: 44, topHz: 70, volume: -12 },
  defeat: { boomS: 1.6, boomCutoffHz: 700, boomVolume: -10, chord: ['C4', 'E4', 'G4'], chordDelayS: 0.18 },
} as const

/** Thud pitch for a hit that left the boss at `hpFraction` (0–1). */
export function bossHitHz(hpFraction: number): number {
  const f = Math.min(Math.max(hpFraction, 0), 1)
  return BOSS_SFX.hit.topHz + (BOSS_SFX.hit.baseHz - BOSS_SFX.hit.topHz) * f
}

/** Biomes whose kit has the combo-streak firework voices (#182). */
export const FIREWORK_BIOMES: readonly BiomeType[] = ['themePark']

/** Firework (#182): pink noise through a rising narrow band-pass for the whistle; a low-passed white crack on the kill thump for the pop. */
export const FIREWORK_SFX = {
  whistle: { startHz: 900, endHz: 3400, q: 14, volume: -22, minS: 0.4, maxS: 3 },
  pop: { crackS: 0.45, cutoffHz: 3200, volume: -16, drum: 'G1', drumVelocity: 0.7 },
} as const

/** Whistle length for a flight of `flightS` game seconds at `timeScale` (slow-mo stretches it). */
export function fireworkWhistleS(flightS: number, timeScale: number): number {
  const { minS, maxS } = FIREWORK_SFX.whistle
  const s = timeScale > 0 ? flightS / timeScale : maxS
  return Math.min(Math.max(s, minS), maxS)
}
