import * as Tone from 'tone'
import { nextTriggerTime } from './triggerTime'
import { dropSound } from './soundGuard'
import { sfxChannel, isAudioReady } from './AudioEngine'
import {
  BOSS_SFX,
  COMBO_BREAK,
  FIREWORK_BIOMES,
  FIREWORK_SFX,
  FIRE_VARIANTS,
  PICKUP_CHIME,
  WEAPON_FIRE_SFX,
  KILL_TIMBRES,
  type KillSound,
  STAR_CHIME_NOTES,
  STINGERS,
  STINGER_CHORD_GAP_S,
  STINGER_VOICES,
  bossHitHz,
  fireVelocity,
  fireworkWhistleS,
  killLayers,
  killPingHz,
} from './sfxDesign'
import type { BiomeType } from '@/types/level'
import type { PickupWeaponId, WeaponId } from '@/combat/weapons/weaponTypes'

/*
 * Every gameplay SFX node is built once per level into `owned` and reused; never create one in a play function.
 *
 * Volume hierarchy (individual synth dB + sfxChannel -6 dB, then the master limiter):
 *   Fire pew   : -20 (-26 when auto-firing) → background, fires 10×/sec
 *   Pickup guns: spread -24 saw, rapid -30 square tick, piercing -19 triangle laser; pickup chime on the star chime
 *   Hit tick   : -24 noise + -22 blip → crisp, ~30 ms
 *   Balloon pop: -14 snap + -18 ping → punchy but brief
 *   Kill layers: thump -14 (combo 2×), ring -26 (3×), swell -24 (5×)
 *   Combo break: -20 falling triangle, when a 2×+ chain lapses
 *   Stinger    : -18…-26 per biome, once per wave
 *   Star chime : -16 bell, up to 3 on the results screen
 *   Boss       : arrival on the stinger voices + thump; hit thud -12; defeat boom -10 (low-passed brown noise)
 *   Firework   : whistle -22 (band-passed pink sweep), pop -16 crack + thump (theme park only)
 *   Wind       : gain 0–0.12 → ambient bed, never dominates
 */

interface Kit {
  fire: Tone.Synth
  weaponFire: Record<PickupWeaponId, Tone.Synth>
  popPing: Tone.Synth
  popSnap: Tone.NoiseSynth
  tickNoise: Tone.NoiseSynth
  tickBlip: Tone.Synth
  thump: Tone.MembraneSynth
  ring: Tone.Synth
  swell: Tone.NoiseSynth
  comboBreak: Tone.Synth
  stinger: Tone.Synth[]
  chime: Tone.Synth
  bossThud: Tone.MembraneSynth
  bossBoom: Tone.NoiseSynth
  firework: FireworkVoices | null
}

interface FireworkVoices {
  whistle: Tone.NoiseSynth
  whistleBand: Tone.Filter
  crack: Tone.NoiseSynth
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

  const weaponFire = {} as Record<PickupWeaponId, Tone.Synth>
  for (const [id, d] of Object.entries(WEAPON_FIRE_SFX) as [PickupWeaponId, (typeof WEAPON_FIRE_SFX)[PickupWeaponId]][]) {
    weaponFire[id] = own(new Tone.Synth({
      oscillator: { type: d.oscillator },
      envelope: { attack: 0.003, decay: d.sweepS, sustain: 0, release: 0.05 },
      volume: d.volume,
    })).connect(sfxChannel)
  }

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

  const comboBreak = own(new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.004, decay: COMBO_BREAK.sweepS, sustain: 0, release: 0.08 },
    volume: COMBO_BREAK.volume,
  })).connect(sfxChannel)

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

  const bossThud = own(new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    volume: BOSS_SFX.hit.volume,
  })).connect(sfxChannel)

  const boomFilter = own(new Tone.Filter({ type: 'lowpass', frequency: BOSS_SFX.defeat.boomCutoffHz })).connect(sfxChannel)
  const bossBoom = own(new Tone.NoiseSynth({
    noise: { type: 'brown' },
    envelope: { attack: 0.005, decay: BOSS_SFX.defeat.boomS, sustain: 0, release: 0.2 },
    volume: BOSS_SFX.defeat.boomVolume,
  })).connect(boomFilter)

  const firework = FIREWORK_BIOMES.includes(biome) ? createFireworkVoices() : null

  return { fire, weaponFire, popPing, popSnap, tickNoise, tickBlip, thump, ring, swell, comboBreak, stinger, chime, bossThud, bossBoom, firework }
}

function createFireworkVoices(): FireworkVoices {
  const { whistle: w, pop } = FIREWORK_SFX
  const whistleBand = own(new Tone.Filter({ type: 'bandpass', frequency: w.startHz, Q: w.q })).connect(sfxChannel)
  const whistle = own(new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.05, decay: 0.01, sustain: 1, release: 0.06 },
    volume: w.volume,
  })).connect(whistleBand)
  const crackFilter = own(new Tone.Filter({ type: 'lowpass', frequency: pop.cutoffHz })).connect(sfxChannel)
  const crack = own(new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: pop.crackS, sustain: 0, release: 0.05 },
    volume: pop.volume,
  })).connect(crackFilter)
  return { whistle, whistleBand, crack }
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
export function playFireSound(auto = false, weapon: WeaponId = 'blaster'): void {
  try {
    const k = ensureKit()
    if (!k) return
    let synth = k.fire
    let v = FIRE_VARIANTS[fireVariant]
    if (weapon === 'blaster') fireVariant = (fireVariant + 1) % FIRE_VARIANTS.length
    else {
      synth = k.weaponFire[weapon]
      v = WEAPON_FIRE_SFX[weapon]
    }
    const jitter = 0.94 + Math.random() * 0.12
    const now = nextTriggerTime(synth, Tone.now(), Tone.getContext().currentTime)
    synth.triggerAttack(v.startHz * jitter, now, fireVelocity(auto))
    synth.frequency.exponentialRampTo(v.endHz * jitter, v.sweepS, now)
    synth.triggerRelease(now + v.sweepS + 0.02)
  } catch (e) {
    dropSound('fire', e)
  }
}

// Throttles run on the audio clock the sounds play on (an offline render runs its whole timeline in one JS turn).
let lastTickTime = 0
const HIT_TICK_MIN_INTERVAL = 25 // ms — several hits in one frame tick once

export function playHitTick(): void {
  const k = ensureKit()
  if (!k) return
  const nowMs = Tone.now() * 1000
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

export function playExplosionSound(comboCount: number = 0, sound: KillSound = 'pop'): void {
  const k = ensureKit()
  if (!k) return

  const nowMs = Tone.now() * 1000
  if (nowMs - lastExplosionTime < EXPLOSION_SOUND_MIN_INTERVAL) return
  lastExplosionTime = nowMs

  try {
    const toneNow = Tone.now()
    const ctxNow = Tone.getContext().currentTime
    const timbre = KILL_TIMBRES[sound]
    k.popSnap.envelope.decay = timbre.snapDecay
    k.popSnap.triggerAttackRelease(timbre.snapS + Math.random() * 0.02, nextTriggerTime(k.popSnap, toneNow, ctxNow))
    k.popPing.triggerAttackRelease(killPingHz(sound, comboCount, Math.random()), timbre.pingS, nextTriggerTime(k.popPing, toneNow, ctxNow))

    const combo = Math.min(comboCount, 10)

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

export function playComboBreak(): void {
  const k = ensureKit()
  if (!k) return
  try {
    const t = nextTriggerTime(k.comboBreak, Tone.now(), Tone.getContext().currentTime)
    k.comboBreak.triggerAttack(COMBO_BREAK.startHz, t, 0.8)
    k.comboBreak.frequency.exponentialRampTo(COMBO_BREAK.endHz, COMBO_BREAK.sweepS, t)
    k.comboBreak.triggerRelease(t + COMBO_BREAK.sweepS)
  } catch (e) {
    dropSound('combo break', e)
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

/** Boss arrival: three ominous chords on the biome's stinger voices, a drum hit under each. */
export function playBossStinger(): void {
  const k = ensureKit()
  if (!k) return
  const { chords, drum, gapS } = BOSS_SFX.arrival
  try {
    const toneNow = Tone.now()
    const ctxNow = Tone.getContext().currentTime
    for (let c = 0; c < chords.length; c++) {
      const t = toneNow + c * gapS
      const last = c === chords.length - 1
      for (let i = 0; i < chords[c].length; i++) {
        const voice = k.stinger[i]
        voice.triggerAttackRelease(chords[c][i], last ? 0.7 : gapS * 0.85, nextTriggerTime(voice, t, ctxNow), last ? 1 : 0.8)
      }
      k.thump.triggerAttackRelease(drum[c], 0.3, nextTriggerTime(k.thump, t, ctxNow), last ? 1 : 0.8)
    }
  } catch (e) {
    dropSound('boss stinger', e)
  }
}

/** One low thud per boss hit, rising as it weakens (the usual hit tick plays too, from `enemy:hit`). */
export function playBossHit(event: unknown): void {
  const k = ensureKit()
  if (!k) return
  try {
    const hp = (event as { hpFraction?: number } | undefined)?.hpFraction ?? 1
    k.bossThud.triggerAttackRelease(bossHitHz(hp), 0.15, nextTriggerTime(k.bossThud, Tone.now(), Tone.getContext().currentTime))
  } catch (e) {
    dropSound('boss hit', e)
  }
}

/** Boss down: a long low boom, the kill layers and a bright major chord on top. */
export function playBossDefeat(): void {
  const k = ensureKit()
  if (!k) return
  const { boomS, chord, chordDelayS } = BOSS_SFX.defeat
  try {
    const toneNow = Tone.now()
    const ctxNow = Tone.getContext().currentTime
    k.bossBoom.triggerAttackRelease(boomS, nextTriggerTime(k.bossBoom, toneNow, ctxNow))
    k.thump.triggerAttackRelease('C1', 0.5, nextTriggerTime(k.thump, toneNow, ctxNow))
    k.popSnap.envelope.decay = KILL_TIMBRES.pop.snapDecay
    k.popSnap.triggerAttackRelease(0.08, nextTriggerTime(k.popSnap, toneNow, ctxNow))
    k.ring.triggerAttackRelease(820, 0.5, nextTriggerTime(k.ring, toneNow, ctxNow))
    k.swell.triggerAttackRelease(SWELL_S, nextTriggerTime(k.swell, toneNow, ctxNow))
    const t = toneNow + chordDelayS
    for (let i = 0; i < chord.length; i++) {
      const voice = k.stinger[i]
      voice.triggerAttackRelease(chord[i], 0.9, nextTriggerTime(voice, t, ctxNow))
    }
  } catch (e) {
    dropSound('boss defeat', e)
  }
}

/** A rocket leaving its pad: a rising whistle over its flight (`FireworkLaunch`: game seconds at a time scale). */
export function playFireworkWhistle(event: unknown): void {
  const fw = ensureKit()?.firework
  if (!fw) return
  try {
    const { flightS = 0, timeScale = 1 } = (event as { flightS?: number; timeScale?: number } | undefined) ?? {}
    const { startHz, endHz } = FIREWORK_SFX.whistle
    const dur = fireworkWhistleS(flightS, timeScale)
    const t = nextTriggerTime(fw.whistle, Tone.now(), Tone.getContext().currentTime)
    fw.whistleBand.frequency.cancelScheduledValues(t)
    fw.whistleBand.frequency.setValueAtTime(startHz, t)
    fw.whistleBand.frequency.exponentialRampToValueAtTime(endHz, t + dur)
    fw.whistle.triggerAttackRelease(dur, t)
  } catch (e) {
    dropSound('firework whistle', e)
  }
}

/** A firework bursting: a bright crack over a low thump. */
export function playFireworkPop(): void {
  const k = ensureKit()
  const fw = k?.firework
  if (!k || !fw) return
  try {
    const { crackS, drum, drumVelocity } = FIREWORK_SFX.pop
    const toneNow = Tone.now()
    const ctxNow = Tone.getContext().currentTime
    fw.crack.triggerAttackRelease(crackS, nextTriggerTime(fw.crack, toneNow, ctxNow))
    k.thump.triggerAttackRelease(drum, 0.3, nextTriggerTime(k.thump, toneNow, ctxNow), drumVelocity)
  } catch (e) {
    dropSound('firework pop', e)
  }
}

/** Uses the level's kit, which stays mounted under the results screen. */
export function playPickupChime(): void {
  const k = ensureKit()
  if (!k) return
  try {
    const t0 = Tone.now()
    const ctxNow = Tone.getContext().currentTime
    PICKUP_CHIME.notes.forEach((note, i) => {
      k.chime.triggerAttackRelease(note, PICKUP_CHIME.noteS, nextTriggerTime(k.chime, t0 + i * PICKUP_CHIME.stepS, ctxNow))
    })
  } catch (e) {
    dropSound('pickup chime', e)
  }
}

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
  lastTickTime = lastExplosionTime = lastSwellTime = 0
}
