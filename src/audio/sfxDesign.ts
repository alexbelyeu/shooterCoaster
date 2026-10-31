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

export type KillSound = 'pop' | 'flutter' | 'crunch' | 'splash' | 'hiss'

export interface KillTimbre {
  /** White-noise snap length and envelope decay, s. */
  snapS: number
  snapDecay: number
  /** Sine ping base pitch and length. */
  pingHz: number
  pingS: number
}

/** Same two voices, reshaped: a short bright pop, a soft brushy flutter, a tight low crunch, a long wash, a thin hiss. */
export const KILL_TIMBRES: Record<KillSound, KillTimbre> = {
  pop: { snapS: 0.05, snapDecay: 0.06, pingHz: 1400, pingS: 0.04 },
  flutter: { snapS: 0.09, snapDecay: 0.12, pingHz: 760, pingS: 0.03 },
  crunch: { snapS: 0.035, snapDecay: 0.035, pingHz: 230, pingS: 0.08 },
  splash: { snapS: 0.16, snapDecay: 0.22, pingHz: 520, pingS: 0.06 },
  hiss: { snapS: 0.22, snapDecay: 0.26, pingHz: 2600, pingS: 0.025 },
}

/** `jitter` 0–1 of random spread; the combo counts up to 10. */
export function killPingHz(sound: KillSound, combo: number, jitter: number): number {
  const { pingHz } = KILL_TIMBRES[sound]
  const c = Math.min(Math.max(combo, 0), 10)
  return pingHz * (1 + c * 0.057 + jitter * 0.21)
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

/* ------------------------------------------------------------------------------------------------
 * Arcade SFX (`?audio=scrim`, `audio/arcade/`): one-shots baked into AudioBuffers per level, played
 * through a fixed pool of voices. The recipes are in `arcade/recipes.ts`; the numbers live here.
 * --------------------------------------------------------------------------------------------- */

/** A score's key: tonic as a MIDI note in octave 4 (C4 = 60) and its third. Pinned to the scores by `scores.test.ts`. */
export interface MusicKey {
  tonic: number
  minor: boolean
}

/** The keys `audio/scores/*.scrim` are written in: musical SFX (wave tell, FRENZY, payouts, countdown) play in them. */
export const SCORE_KEYS: Record<string, MusicKey> = {
  title: { tonic: 67, minor: false }, // G major
  level1: { tonic: 65, minor: false }, // F major
  level2: { tonic: 69, minor: true }, // A harmonic minor
  level3: { tonic: 62, minor: false }, // D major
  level4: { tonic: 61, minor: true }, // C# minor
  level5: { tonic: 62, minor: true }, // D minor
  results: { tonic: 60, minor: false }, // C major
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]

/** MIDI note of scale degree `degree` (0 = tonic, 7 = the octave above, negative goes down) of `key`, shifted `octave` octaves. */
export function keyNote(key: MusicKey, degree: number, octave = 0): number {
  const scale = key.minor ? MINOR : MAJOR
  const oct = Math.floor(degree / 7)
  return key.tonic + scale[degree - oct * 7] + 12 * (oct + octave)
}

export type ArcadeSoundId =
  | 'fire'
  | 'hit'
  | `kill.${KillSound}`
  | 'kill.thump'
  | 'kill.ring'
  | 'kill.payout'
  | 'comboBreak'
  | 'frenzy'
  | 'frenzyLift'
  | 'waveTell'
  | 'goldenBalloon'
  | 'bossArrival'
  | 'bossHit'
  | 'bossDefeat'
  | 'fireworkWhistle'
  | 'fireworkPop'
  | 'star1'
  | 'star2'
  | 'star3'
  | 'uiSelect'
  | 'uiBack'
  | 'uiLaunch'
  | 'countReady'
  | 'countGo'

export interface ArcadeSound {
  /** Voice priority: a full pool steals the lowest priority (then the oldest); never a higher one. */
  prio: number
  /** Peak level, dB: every bake is normalised to 0 dBFS peak, then played at this gain. */
  db: number
  /** Send to the level's convolver, 0–1. Guns stay dry: their tail has to be gone in 150 ms. */
  send: number
}

export const PRIO = { fire: 1, hit: 2, kill: 3, cue: 4, ui: 5, event: 6 } as const

export const ARCADE_SOUNDS: Record<ArcadeSoundId, ArcadeSound> = {
  fire: { prio: PRIO.fire, db: -13, send: 0 },
  hit: { prio: PRIO.hit, db: -15, send: 0.05 },
  'kill.pop': { prio: PRIO.kill, db: -2, send: 0.12 },
  'kill.flutter': { prio: PRIO.kill, db: -2, send: 0.12 },
  'kill.crunch': { prio: PRIO.kill, db: -2, send: 0.1 },
  'kill.splash': { prio: PRIO.kill, db: -2, send: 0.15 },
  'kill.hiss': { prio: PRIO.kill, db: -3, send: 0.12 },
  'kill.thump': { prio: PRIO.kill, db: -6, send: 0.05 },
  'kill.ring': { prio: PRIO.kill, db: -16, send: 0.2 },
  'kill.payout': { prio: PRIO.kill, db: -15, send: 0.2 },
  comboBreak: { prio: PRIO.cue, db: -13, send: 0.2 },
  frenzy: { prio: PRIO.event, db: -5, send: 0.3 },
  frenzyLift: { prio: PRIO.event, db: -21, send: 0.1 },
  waveTell: { prio: PRIO.event, db: -8, send: 0.25 },
  goldenBalloon: { prio: PRIO.event, db: -6, send: 0.3 },
  bossArrival: { prio: PRIO.event, db: -6, send: 0.35 },
  bossHit: { prio: PRIO.cue, db: -8, send: 0.1 },
  bossDefeat: { prio: PRIO.event, db: -4, send: 0.35 },
  fireworkWhistle: { prio: PRIO.hit, db: -22, send: 0.3 },
  fireworkPop: { prio: PRIO.cue, db: -12, send: 0.35 },
  star1: { prio: PRIO.event, db: -12, send: 0.35 },
  star2: { prio: PRIO.event, db: -11, send: 0.35 },
  star3: { prio: PRIO.event, db: -10, send: 0.35 },
  uiSelect: { prio: PRIO.ui, db: -18, send: 0.1 },
  uiBack: { prio: PRIO.ui, db: -18, send: 0.1 },
  uiLaunch: { prio: PRIO.ui, db: -13, send: 0.2 },
  countReady: { prio: PRIO.ui, db: -14, send: 0.15 },
  countGo: { prio: PRIO.ui, db: -11, send: 0.2 },
}

/** Voices playing at once; the e2e `audioBurst(64, 32)` must never take more. */
export const VOICE_BUDGET = 24
/** A stolen voice fades out over this long before the new sound starts on it. */
export const STEAL_FADE_S = 0.004
/** Held-trigger auto-fire sits this far under a single shot. */
export const AUTO_FIRE_DB = -4

export interface VoiceState {
  prio: number
  startedAt: number
  /** Audio time the voice is silent; Infinity for a loop. */
  endsAt: number
}

/** The voice a sound of `prio` gets at `now`: a free one, else the lowest priority (then oldest) one at or below `prio`; -1 drops the sound. */
export function pickVoice(voices: readonly VoiceState[], prio: number, now: number): number {
  let best = -1
  for (let i = 0; i < voices.length; i++) {
    const v = voices[i]
    if (v.endsAt <= now) return i
    if (v.prio > prio) continue
    if (best < 0 || v.prio < voices[best].prio || (v.prio === voices[best].prio && v.startedAt < voices[best].startedAt)) best = i
  }
  return best
}

/** Kill body pitch climbs with the chain (playback rate). */
export function killRate(combo: number): number {
  return 1 + Math.min(Math.max(combo, 0), 12) * 0.025
}

/** Hit tick pitch: up a step per combo tier. */
export function hitRate(combo: number): number {
  return Math.pow(2, (2 * killTier(combo)) / 12)
}

/** Boss hit thud rises as it weakens (playback rate for hp 0–1). */
export function bossHitRate(hpFraction: number): number {
  return Math.pow(2, (7 * (1 - Math.min(Math.max(hpFraction, 0), 1))) / 12)
}

/** Positional pan / low-pass: enemies this close are full bandwidth, this far are dull. */
export const SPATIAL = { panWidth: 0.75, nearM: 30, farM: 220, nearHz: 18000, farHz: 2400 } as const

/**
 * Pan and low-pass cutoff of a sound at camera-space (x, z) (z < 0 is in front), `tanHalfHFov` the camera's horizontal
 * half-angle tangent: the screen edge pans `panWidth`, behind the camera pans fully to its side.
 */
export function spatial(x: number, z: number, tanHalfHFov: number, out: { pan: number; cutoffHz: number }) {
  const ahead = -z
  const side = ahead > 0.5 ? x / (ahead * tanHalfHFov) : Math.sign(x) * 1.5
  out.pan = Math.max(-1, Math.min(1, side)) * SPATIAL.panWidth
  const dist = Math.hypot(x, z)
  const f = Math.min(Math.max((dist - SPATIAL.nearM) / (SPATIAL.farM - SPATIAL.nearM), 0), 1)
  out.cutoffHz = SPATIAL.nearHz * Math.pow(SPATIAL.farHz / SPATIAL.nearHz, f)
  return out
}

/** The first beat at or after `now + leadS` on a grid of `beatS` from `origin`, and its index in a bar of `beats`. */
export function nextBeat(now: number, origin: number, beatS: number, beats: number, leadS: number, out: { t: number; beatInBar: number }) {
  const k = Math.max(0, Math.ceil((now + leadS - origin) / beatS - 1e-6))
  out.t = origin + k * beatS
  out.beatInBar = k % beats
  return out
}

/** Per-biome room for the SFX send (`makeIR` length / decay curve, then a low-pass on the return). */
export const BIOME_REVERB: Record<BiomeType, { seconds: number; decayPow: number; toneHz: number; level: number }> = {
  themePark: { seconds: 1.4, decayPow: 3.2, toneHz: 7000, level: 0.8 },
  desert: { seconds: 1.8, decayPow: 4.5, toneHz: 4500, level: 0.7 },
  ocean: { seconds: 2.4, decayPow: 3, toneHz: 6000, level: 0.9 },
  arctic: { seconds: 3, decayPow: 2.6, toneHz: 9000, level: 0.9 },
  volcanic: { seconds: 2, decayPow: 3.4, toneHz: 2600, level: 0.85 },
}

/** Whistle bakes (s); a launch plays the nearest, rate-matched to its flight. */
export const WHISTLE_LENGTHS_S = [0.6, 1.2, 2.4] as const
