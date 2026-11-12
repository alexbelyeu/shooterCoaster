/** Sound design data for the arcade SFX (`audio/arcade/`); no Web Audio, so it stays unit-testable. */
import type { BiomeType } from '@/types/level'
import { comboTierIndex } from '@/combat/comboTiers'
import type { PickupWeaponId } from '@/combat/weapons/weaponTypes'

/** The combo tier (`combat/comboTiers.ts`): 0 = the body (1×), 1 = + thump (2×), 2 = + ring (3×), 3 = + payout (5×). */
export function killTier(combo: number): number {
  return comboTierIndex(combo)
}

/** What a kill sounds like, by death style (`effects/deathStyles.ts`): a bright pop, wing flutter, a low crunch, a wash, a hiss, a chalk puff. */
export const KILL_SOUNDS = ['pop', 'flutter', 'crunch', 'splash', 'hiss', 'chalk'] as const
export type KillSound = (typeof KILL_SOUNDS)[number]

/** Ride wind: band-passed white noise that opens and brightens with speed (gain 0–0.12, an ambient bed). */
export const WIND = {
  q: 0.5,
  minHz: 200,
  spanHz: 1800,
  maxGain: 0.12,
  /** setTargetAtTime constant: ~95% of the way in 0.1 s. */
  smoothS: 0.1 / 3,
  /** Re-aim only after the speed moves this much, at most this often: one automation event per frame would pile up. */
  minStep: 0.02,
  minIntervalS: 0.1,
} as const

export const windHz = (speed: number) => WIND.minHz + speed * WIND.spanHz
export const windGain = (speed: number) => speed * WIND.maxGain

/** The last speed the wind was aimed at, and when (audio-clock seconds). */
export interface WindRamp {
  speed: number
  at: number
}

/** Whether to re-aim the wind now; records it in `last` when so. A stop (speed 0) skips the step and the interval: it may be the last call. */
export function windUpdateDue(speed: number, now: number, last: WindRamp): boolean {
  const moved = Math.abs(speed - last.speed)
  if (moved === 0) return false
  if (speed !== 0 && (moved < WIND.minStep || now - last.at < WIND.minIntervalS)) return false
  last.speed = speed
  last.at = now
  return true
}

/** Biomes whose sounds have the combo-streak fireworks (#182). */
export const FIREWORK_BIOMES: readonly BiomeType[] = ['themePark']

/** Firework whistle (#182): noise through a rising narrow band-pass, as long as the rocket's flight. */
export const FIREWORK_SFX = {
  whistle: { startHz: 900, endHz: 3400, q: 14, minS: 0.4, maxS: 3 },
} as const

/** Whistle length for a flight of `flightS` game seconds at `timeScale` (slow-mo stretches it). */
export function fireworkWhistleS(flightS: number, timeScale: number): number {
  const { minS, maxS } = FIREWORK_SFX.whistle
  const s = timeScale > 0 ? flightS / timeScale : maxS
  return Math.min(Math.max(s, minS), maxS)
}

/** Tonic as a MIDI note in octave 4 (C4 = 60). */
export interface MusicKey {
  tonic: number
  minor: boolean
}

const LEVEL4_KEY: MusicKey = { tonic: 62, minor: true } // D minor

/** The keys `audio/scores/*.scrim` are written in, pinned by `scores.test.ts`. */
export const SCORE_KEYS: Record<string, MusicKey> = {
  title: { tonic: 69, minor: true }, // A minor
  level1: { tonic: 65, minor: false }, // F major
  level2: { tonic: 65, minor: true }, // F minor
  level3: { tonic: 67, minor: false }, // G major
  level4: LEVEL4_KEY,
  level5: { tonic: 60, minor: true }, // C minor
  level6: LEVEL4_KEY, // plays level4's score until its own theme (#456)
  results: { tonic: 60, minor: false }, // C major
  // Theme options waiting on Alex's pick (`?theme=`, scores/themes/) get a row each: `'<slot>.<name>': key`
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]

/** Scale degree 0 is the tonic, 7 the octave above; negative goes down. */
export function keyNote(key: MusicKey, degree: number, octave = 0): number {
  const scale = key.minor ? MINOR : MAJOR
  const oct = Math.floor(degree / 7)
  return key.tonic + scale[degree - oct * 7] + 12 * (oct + octave)
}

export type ArcadeSoundId =
  | 'fire'
  | `fire.${PickupWeaponId}`
  | 'pickup'
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
  | 'uiWhoosh'
  | 'countReady'
  | 'countGo'

export interface ArcadeSound {
  /** Voice priority: a full pool steals the lowest priority (then the oldest); never a higher one. */
  prio: number
  /** Peak level, dB (every bake is normalised to 0 dBFS). */
  db: number
  /** Send to the level's convolver, 0–1. Guns stay dry: their tail has to be gone in 150 ms. */
  send: number
}

export const PRIO = { fire: 1, hit: 2, kill: 3, cue: 4, ui: 5, event: 6 } as const

export const ARCADE_SOUNDS: Record<ArcadeSoundId, ArcadeSound> = {
  fire: { prio: PRIO.fire, db: -13, send: 0 },
  'fire.spread': { prio: PRIO.fire, db: -12, send: 0 },
  'fire.rapid': { prio: PRIO.fire, db: -17, send: 0 },
  'fire.piercing': { prio: PRIO.fire, db: -12, send: 0 },
  pickup: { prio: PRIO.event, db: -9, send: 0.3 },
  hit: { prio: PRIO.hit, db: -15, send: 0.05 },
  'kill.pop': { prio: PRIO.kill, db: -3, send: 0.12 },
  'kill.flutter': { prio: PRIO.kill, db: -3, send: 0.12 },
  'kill.crunch': { prio: PRIO.kill, db: -3, send: 0.1 },
  'kill.splash': { prio: PRIO.kill, db: -3, send: 0.15 },
  'kill.hiss': { prio: PRIO.kill, db: -4, send: 0.12 },
  'kill.chalk': { prio: PRIO.kill, db: -4, send: 0.12 },
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
  uiWhoosh: { prio: PRIO.ui, db: -16, send: 0.2 },
  countReady: { prio: PRIO.ui, db: -14, send: 0.15 },
  countGo: { prio: PRIO.ui, db: -11, send: 0.2 },
}

/** Voices playing at once; the e2e `audioBurst(64, 32)` must never take more. */
export const VOICE_BUDGET = 24
export const STEAL_FADE_S = 0.004
export const AUTO_FIRE_DB = -4

export interface VoiceState {
  prio: number
  startedAt: number
  /** Audio time the voice is silent; Infinity for a loop. */
  endsAt: number
}

/** A free voice, else the lowest-priority (then oldest) one at or below `prio`; -1 drops the sound. */
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

export function killRate(combo: number): number {
  return 1 + Math.min(Math.max(combo, 0), 12) * 0.025
}

export function hitRate(combo: number): number {
  return Math.pow(2, (2 * killTier(combo)) / 12)
}

export function bossHitRate(hpFraction: number): number {
  return Math.pow(2, (7 * (1 - Math.min(Math.max(hpFraction, 0), 1))) / 12)
}

export const SPATIAL = { panWidth: 0.75, nearM: 30, farM: 220, nearHz: 18000, farHz: 2400 } as const

/** Camera-space (x, z), z < 0 ahead: the screen edge pans `panWidth`, behind the camera pans fully to its side. */
export function spatial(x: number, z: number, tanHalfHFov: number, out: { pan: number; cutoffHz: number }) {
  const ahead = -z
  const side = ahead > 0.5 ? x / (ahead * tanHalfHFov) : Math.sign(x) * 1.5
  out.pan = Math.max(-1, Math.min(1, side)) * SPATIAL.panWidth
  const dist = Math.hypot(x, z)
  const f = Math.min(Math.max((dist - SPATIAL.nearM) / (SPATIAL.farM - SPATIAL.nearM), 0), 1)
  out.cutoffHz = SPATIAL.nearHz * Math.pow(SPATIAL.farHz / SPATIAL.nearHz, f)
  return out
}

/** Keeps a placed sound's louder channel at its level wherever it pans: equal power leaves a kill at the crosshair 3 dB down. */
export function panGain(pan: number): number {
  const a = ((Math.min(Math.max(pan, -1), 1) + 1) * Math.PI) / 4
  return 1 / Math.max(Math.cos(a), Math.sin(a))
}

/** The first beat at or after `now + leadS`, and its place in the bar. */
export function nextBeat(now: number, origin: number, beatS: number, beats: number, leadS: number, out: { t: number; beatInBar: number }) {
  const k = Math.max(0, Math.ceil((now + leadS - origin) / beatS - 1e-6))
  out.t = origin + k * beatS
  out.beatInBar = k % beats
  return out
}

/** `makeIR` length / decay curve, a low-pass on the return. */
export const BIOME_REVERB: Record<BiomeType, { seconds: number; decayPow: number; toneHz: number; level: number }> = {
  themePark: { seconds: 1.4, decayPow: 3.2, toneHz: 7000, level: 0.8 },
  desert: { seconds: 1.8, decayPow: 4.5, toneHz: 4500, level: 0.7 },
  ocean: { seconds: 2.4, decayPow: 3, toneHz: 6000, level: 0.9 },
  arctic: { seconds: 3, decayPow: 2.6, toneHz: 9000, level: 0.9 },
  volcanic: { seconds: 2, decayPow: 3.4, toneHz: 2600, level: 0.85 },
  gym: { seconds: 2.6, decayPow: 2.8, toneHz: 5000, level: 0.9 }, // a big hard-walled hall
}

/** Whistle bakes (s); a launch plays the nearest, rate-matched to its flight. */
export const WHISTLE_LENGTHS_S = [0.6, 1.2, 2.4] as const
