import * as Tone from 'tone'
import { nextTriggerTime } from './triggerTime'
import { dropSound } from './soundGuard'
import { sfxChannel, isAudioReady } from './AudioEngine'
import {
  FIRE_VARIANTS,
  STAR_CHIME_NOTES,
  STINGERS,
  STINGER_CHORD_GAP_S,
  STINGER_VOICES,
  fireVelocity,
  killLayers,
} from './sfxDesign'
import type { BiomeType } from '@/types/level'

/*
 * Every gameplay SFX node is built once per level into `owned` and reused; never create one in a play function.
 *
 * Volume hierarchy (individual synth dB + sfxChannel -6 dB, then the master limiter):
 *   Fire pew   : -20 (-26 when auto-firing) → background, fires 10×/sec
 *   Hit tick   : -24 noise + -22 blip → crisp, ~30 ms
 *   Balloon pop: -14 snap + -18 ping → punchy but brief
 *   Kill layers: thump -14 (combo 3+), ring -26 (6+), swell -24 (10+)
 *   Stinger    : -18…-26 per biome, once per wave
 *   Star chime : -16 bell, up to 3 on the results screen
 *   Wind       : gain 0–0.12 → ambient bed, never dominates
 */

interface Kit {
  fire: Tone.Synth
  popPing: Tone.Synth
  popSnap: Tone.NoiseSynth
  tickNoise: Tone.NoiseSynth
  tickBlip: Tone.Synth
  thump: Tone.MembraneSynth
  ring: Tone.Synth
  swell: Tone.NoiseSynth
  stinger: Tone.Synth[]
  chime: Tone.Synth
}

const owned: Tone.ToneAudioNode[] = []
let kit: Kit | null = null
let kitBiome: BiomeType = 'themePark'

const SWELL_S = 0.35

function own<T extends Tone.ToneAudioNode>(node: T): T {
  owned.push(node)
  return node
}

function createKit(biome: BiomeType): Kit {
  const fire = own(new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.06 },
    volume: -20,
  })).connect(sfxChannel)

  const popPing = own(new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
    volume: -18,
  })).connect(sfxChannel)

  const popSnap = own(new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
    volume: -14,
  })).connect(sfxChannel)

  const tickNoise = own(new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
    volume: -24,
  })).connect(sfxChannel)
  const tickBlip = own(new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    volume: -22,
  })).connect(sfxChannel)

  // Also the stinger drum.
  const thump = own(new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
    volume: -14,
  })).connect(sfxChannel)

  // Inharmonic FM ratio → metallic ring.
  const ring = own(new Tone.Synth({
    oscillator: { type: 'fmsine', harmonicity: 3.7, modulationIndex: 14 },
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 },
    volume: -26,
  })).connect(sfxChannel)

  // Reverse-cymbal swell: high-passed pink noise that fades in, then cuts.
  const swellFilter = own(new Tone.Filter({ type: 'highpass', frequency: 3000 })).connect(sfxChannel)
  const swell = own(new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: SWELL_S, decay: 0.04, sustain: 0, release: 0.04 },
    volume: -24,
  })).connect(swellFilter)

  const d = STINGERS[biome]
  let stingerOut: Tone.ToneAudioNode = sfxChannel
  if (d.drive > 0) stingerOut = own(new Tone.Distortion(d.drive)).connect(sfxChannel)
  const stingerBus = own(new Tone.Filter({ type: 'lowpass', frequency: d.cutoffHz })).connect(stingerOut)
  const oscillator =
    d.oscillator === 'fmsine'
      ? { type: 'fmsine' as const, harmonicity: d.harmonicity ?? 1, modulationIndex: d.modulationIndex ?? 2 }
      : { type: d.oscillator }
  const stinger: Tone.Synth[] = []
  for (let i = 0; i < STINGER_VOICES; i++) {
    stinger.push(own(new Tone.Synth({
      oscillator: oscillator as Tone.SynthOptions['oscillator'],
      envelope: { attack: d.attack, decay: d.decay, sustain: d.sustain, release: d.release },
      volume: d.volume,
    })).connect(stingerBus))
  }

  const chime = own(new Tone.Synth({
    oscillator: { type: 'fmsine', harmonicity: 2, modulationIndex: 3 },
    envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.4 },
    volume: -16,
  })).connect(sfxChannel)

  return { fire, popPing, popSnap, tickNoise, tickBlip, thump, ring, swell, stinger, chime }
}

function ensureKit(): Kit | null {
  if (!isAudioReady()) return null
  if (!kit) kit = createKit(kitBiome)
  return kit
}

/** Set the level's biome (stinger timbre) and pre-create the SFX nodes. Call on level start. */
export function prepareLevelSFX(biome: BiomeType): void {
  if (kit && biome !== kitBiome) disposeSFX()
  kitBiome = biome
  ensureKit()
}

/** e2e: must not grow while shooting / killing. */
export function sfxNodeCount(): number {
  return owned.length
}

let fireVariant = 0

/** One shot. `auto` = held-trigger auto-fire, played 6 dB quieter to avoid fatigue. */
export function playFireSound(auto = false): void {
  try {
    const k = ensureKit()
    if (!k) return
    const v = FIRE_VARIANTS[fireVariant]
    fireVariant = (fireVariant + 1) % FIRE_VARIANTS.length
    const jitter = 0.94 + Math.random() * 0.12
    const now = nextTriggerTime(k.fire, Tone.now(), Tone.getContext().currentTime)
    k.fire.triggerAttack(v.startHz * jitter, now, fireVelocity(auto))
    k.fire.frequency.exponentialRampTo(v.endHz * jitter, v.sweepS, now)
    k.fire.triggerRelease(now + v.sweepS + 0.02)
  } catch (e) {
    dropSound('fire', e)
  }
}

let lastTickTime = 0
const HIT_TICK_MIN_INTERVAL = 25 // ms — several hits in one frame tick once

export function playHitTick(): void {
  const k = ensureKit()
  if (!k) return
  const nowMs = performance.now()
  if (nowMs - lastTickTime < HIT_TICK_MIN_INTERVAL) return
  lastTickTime = nowMs

  try {
    const toneNow = Tone.now()
    const ctxNow = Tone.getContext().currentTime
    k.tickNoise.triggerAttackRelease(0.015, nextTriggerTime(k.tickNoise, toneNow, ctxNow))
    k.tickBlip.triggerAttackRelease(3200 + Math.random() * 700, 0.02, nextTriggerTime(k.tickBlip, toneNow, ctxNow))
  } catch (e) {
    dropSound('hit tick', e)
  }
}

let lastExplosionTime = 0
const EXPLOSION_SOUND_MIN_INTERVAL = 30 // ms — throttle rapid pops
let lastSwellTime = 0
const SWELL_MIN_INTERVAL = 600 // ms — let one swell finish before the next

export function playExplosionSound(comboCount: number = 0): void {
  const k = ensureKit()
  if (!k) return

  const nowMs = performance.now()
  if (nowMs - lastExplosionTime < EXPLOSION_SOUND_MIN_INTERVAL) return
  lastExplosionTime = nowMs

  try {
    const toneNow = Tone.now()
    const ctxNow = Tone.getContext().currentTime
    k.popSnap.triggerAttackRelease(0.05 + Math.random() * 0.02, nextTriggerTime(k.popSnap, toneNow, ctxNow))

    const combo = Math.min(comboCount, 10)
    const pingFreq = 1400 + combo * 80 + Math.random() * 300
    k.popPing.triggerAttackRelease(pingFreq, 0.04, nextTriggerTime(k.popPing, toneNow, ctxNow))

    const layers = killLayers(comboCount)
    if (layers.thump) {
      k.thump.triggerAttackRelease(48 + combo * 2, 0.2, nextTriggerTime(k.thump, toneNow, ctxNow))
    }
    if (layers.ring) {
      k.ring.triggerAttackRelease(900 + combo * 30 + Math.random() * 80, 0.25, nextTriggerTime(k.ring, toneNow, ctxNow))
    }
    if (layers.swell && nowMs - lastSwellTime >= SWELL_MIN_INTERVAL) {
      lastSwellTime = nowMs
      k.swell.triggerAttackRelease(SWELL_S, nextTriggerTime(k.swell, toneNow, ctxNow))
    }
  } catch (e) {
    dropSound('kill', e)
  }
}

export function playWaveStinger(): void {
  const k = ensureKit()
  if (!k) return
  const d = STINGERS[kitBiome]
  try {
    const toneNow = Tone.now()
    const ctxNow = Tone.getContext().currentTime
    for (let c = 0; c < 2; c++) {
      const chord = d.chords[c]
      const t = toneNow + c * STINGER_CHORD_GAP_S
      const dur = c === 0 ? STINGER_CHORD_GAP_S * 0.85 : 0.45
      const velocity = c === 0 ? 0.75 : 1
      for (let i = 0; i < chord.length; i++) {
        const voice = k.stinger[i]
        voice.triggerAttackRelease(chord[i], dur, nextTriggerTime(voice, t, ctxNow), velocity)
      }
      if (d.drum) k.thump.triggerAttackRelease(d.drum[c], 0.3, nextTriggerTime(k.thump, t, ctxNow), velocity)
    }
  } catch (e) {
    dropSound('wave stinger', e)
  }
}

/** Uses the level's kit, which stays mounted under the results screen. */
export function playStarChime(starIndex: number): void {
  const k = ensureKit()
  if (!k) return
  try {
    const t = nextTriggerTime(k.chime, Tone.now(), Tone.getContext().currentTime)
    k.chime.triggerAttackRelease(STAR_CHIME_NOTES[starIndex] ?? STAR_CHIME_NOTES[2], 0.5, t)
  } catch (e) {
    dropSound('star chime', e)
  }
}

let windNoise: Tone.Noise | null = null
let windFilter: Tone.Filter | null = null
let windGain: Tone.Gain | null = null

/** Start continuous wind whoosh noise — call once on level start */
export function startWindWhoosh(): void {
  if (!isAudioReady() || windNoise) return

  windFilter = new Tone.Filter({
    frequency: 400,
    type: 'bandpass',
    Q: 0.5,
  })

  windGain = new Tone.Gain(0).connect(sfxChannel)
  windFilter.connect(windGain)

  windNoise = new Tone.Noise('white')
  windNoise.connect(windFilter)
  try {
    windNoise.start()
  } catch (e) {
    dropSound('wind', e)
  }
}

/** Update wind intensity based on velocity (0-1 normalized) */
export function updateWindWhoosh(velocityNormalized: number): void {
  if (!windFilter || !windGain) return
  try {
    const freq = 200 + velocityNormalized * 1800
    windFilter.frequency.rampTo(freq, 0.1)
    windGain.gain.rampTo(velocityNormalized * 0.12, 0.1)
  } catch (e) {
    dropSound('wind', e)
  }
}

export function stopWindWhoosh(): void {
  if (windNoise) {
    windNoise.stop()
    windNoise.dispose()
    windNoise = null
  }
  if (windFilter) {
    windFilter.dispose()
    windFilter = null
  }
  if (windGain) {
    windGain.dispose()
    windGain = null
  }
}

export function disposeSFX(): void {
  for (let i = owned.length - 1; i >= 0; i--) owned[i].dispose()
  owned.length = 0
  kit = null
  lastSwellTime = 0
}
