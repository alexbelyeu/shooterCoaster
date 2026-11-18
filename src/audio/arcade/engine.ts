/** Arcade SFX: baked one-shots, each a fresh buffer source on a fixed, priority-stolen voice pool (decision 2026-10-31-217). */
import type { BiomeType } from '@/types/level'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createRng, hashString } from '@/utils/rng'
import { comboTierIndex } from '@/combat/comboTiers'
import { arcadeChannel, arcadeUiChannel, audioContext, audioNow as clock, isAudioReady } from '../AudioEngine'
import { scrimPlayer } from '../musicEngine'
import { dropSound } from '../soundGuard'
import { barSection, compile } from '../scrim/score'
import { makeIR, upmixPanner } from '../scrim/synth'
import { SCORES, scoreIdFor } from '../scores'
import {
  ARCADE_SOUNDS, AUTO_FIRE_DB, BIOME_REVERB, FIREWORK_BIOMES, STEAL_FADE_S, VOICE_BUDGET, WHISTLE_LENGTHS_S, SCORE_KEYS,
  WIND, bossHitRate, fireworkWhistleS, hitRate, killRate, nextBeat, panGain, pickVoice, windGain, windHz, windUpdateDue,
  type ArcadeSoundId, type VoiceState, type WindRamp,
} from '../sfxDesign'
import type { Placement, SfxEngine, UiSound, VoiceStats } from '../sfx'
import { bakeBank, type Bank } from './bake'
import type { BakeSpec } from './recipes'

interface Voice extends VoiceState {
  gain: GainNode
  lp: BiquadFilterNode
  pan: StereoPannerNode
  send: GainNode
  src: AudioBufferSourceNode | null
}

interface Graph {
  ctx: BaseAudioContext
  channel: AudioNode
  biome: BiomeType
  out: GainNode
  /** The countdown and UI blips, past the pause gate (`arcadeUiChannel`). */
  uiOut: GainNode
  verb: ConvolverNode
  verbTone: BiquadFilterNode
  verbReturn: GainNode
  voices: Voice[]
  /** Outside the budget, on `uiOut`: the resume Ready / GO plays while the run is still paused. */
  uiVoices: Voice[]
  /** The FRENZY lift's own voice: a loop, never stolen. */
  lift: Voice
  /** The ride wind: looped noise → band-pass → gain, silent until `wind` opens it. */
  windSrc: AudioBufferSourceNode
  windBand: BiquadFilterNode
  windAmp: GainNode
}

const LIFT_FADE_S = 0.12
/** A bake before audio unlocks (a menu's prepare): buffer sources resample it to the context's rate. */
const BAKE_RATE = 48000
const BEAT_LEAD_S = 0.02

let graph: Graph | null = null
let bank: Bank | null = null
let bankKey: string | null = null
let bankSpec: BakeSpec | null = null
/** `score:biome` of the last `prepare`. */
let wanted: string | null = null
let baking: { key: string; promise: Promise<void> } | null = null
let liftOn = false

const stats: VoiceStats = { budget: VOICE_BUDGET, live: 0, peak: 0, played: 0, stolen: 0, rejected: 0, ui: 0 }
/** Every graph's long-lived nodes until disconnected, a fading one's included. */
let graphNodes = 0

/** A budget voice's source stops counting as live: ended, stolen or disposed (`stats.live`, #246). */
function release(src: AudioScheduledSourceNode | null) {
  if (!src?.onended) return
  src.onended = null
  stats.live--
}

function onSourceEnded(this: AudioScheduledSourceNode) {
  release(this)
}

function createVoice(ctx: BaseAudioContext, out: AudioNode, verbIn: AudioNode): Voice {
  const gain = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 0.5
  const pan = upmixPanner(ctx)
  const send = ctx.createGain()
  send.gain.value = 0
  gain.connect(lp).connect(pan).connect(out)
  lp.connect(send).connect(verbIn)
  return { gain, lp, pan, send, src: null, prio: 0, startedAt: 0, endsAt: 0 }
}

const UI_VOICES = 2
const VOICE_NODES = 4
const BUS_NODES = 5
const WIND_NODES = 3
const nodesOf = (g: Graph) => BUS_NODES + WIND_NODES + VOICE_NODES * (g.voices.length + g.uiVoices.length + 1)

/** Rebuilt when the context or channel changes (an offline render) or the installed bank's biome does: the room comes with the bank (#246). */
function ensureGraph(): Graph {
  const ctx = audioContext()
  const biome = bankSpec?.biome ?? 'themePark'
  if (graph && graph.ctx === ctx && graph.channel === arcadeChannel && graph.biome === biome) return graph
  disposeGraph()
  const room = BIOME_REVERB[biome]
  const out = ctx.createGain()
  out.connect(arcadeChannel)
  const uiOut = ctx.createGain()
  uiOut.connect(arcadeUiChannel)
  const verb = ctx.createConvolver()
  verb.buffer = makeIR(ctx, room.seconds, room.decayPow)
  const verbTone = ctx.createBiquadFilter()
  verbTone.type = 'lowpass'
  verbTone.frequency.value = room.toneHz
  const verbReturn = ctx.createGain()
  verbReturn.gain.value = room.level
  verb.connect(verbTone).connect(verbReturn).connect(out)
  const voices: Voice[] = []
  for (let i = 0; i < VOICE_BUDGET; i++) voices.push(createVoice(ctx, out, verb))
  const uiVoices: Voice[] = []
  for (let i = 0; i < UI_VOICES; i++) uiVoices.push(createVoice(ctx, uiOut, verb))
  graph = {
    ctx, channel: arcadeChannel, biome, out, uiOut, verb, verbTone, verbReturn, voices, uiVoices,
    lift: createVoice(ctx, out, verb), ...createWind(ctx, out),
  }
  graphNodes += nodesOf(graph)
  return graph
}

const WIND_LOOP_S = 2

function createWind(ctx: BaseAudioContext, out: AudioNode) {
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * WIND_LOOP_S), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  const rng = createRng(hashString('wind'))
  for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1
  const windAmp = ctx.createGain()
  windAmp.gain.value = 0
  const windBand = ctx.createBiquadFilter()
  windBand.type = 'bandpass'
  windBand.frequency.value = WIND.minHz
  windBand.Q.value = WIND.q
  const windSrc = ctx.createBufferSource()
  windSrc.buffer = buffer
  windSrc.loop = true
  windSrc.connect(windBand).connect(windAmp).connect(out)
  windSrc.start()
  windRamp.speed = 0
  windRamp.at = -Infinity
  return { windSrc, windBand, windAmp }
}

const windRamp: WindRamp = { speed: 0, at: -Infinity }

function setWind(speed: number) {
  if (!graph) return
  try {
    const t = clock()
    if (!windUpdateDue(speed, t, windRamp)) return
    graph.windBand.frequency.setTargetAtTime(windHz(speed), t, WIND.smoothS)
    graph.windAmp.gain.setTargetAtTime(windGain(speed), t, WIND.smoothS)
  } catch (e) {
    dropSound('wind', e)
  }
}

/** Fades out what still rings (a launch blip under a biome swap) instead of cutting it, then disconnects; another or a finished context's graph goes at once. */
function disposeGraph() {
  const g = graph
  if (!g) return
  graph = null
  liftOn = false
  const fade = g.ctx === audioContext() && g.ctx.state !== 'closed'
  const t = fade ? clock() : 0
  const end = t + 2 * STEAL_FADE_S
  const voices = [...g.voices, ...g.uiVoices, g.lift]
  for (const v of voices) {
    release(v.src)
    try {
      v.src?.stop(end)
    } catch {
      /* never started or already stopped */
    }
  }
  const disconnect = () => {
    for (const v of voices) for (const n of [v.src, v.gain, v.lp, v.pan, v.send]) n?.disconnect()
    for (const n of [g.windSrc, g.windBand, g.windAmp, g.verb, g.verbTone, g.verbReturn, g.out, g.uiOut]) n.disconnect()
    graphNodes -= nodesOf(g)
  }
  if (fade) {
    for (const out of [g.out, g.uiOut]) out.gain.setTargetAtTime(0, t, STEAL_FADE_S / 3)
    g.windSrc.onended = disconnect
    g.windSrc.stop(end)
  } else {
    g.windSrc.stop()
    disconnect()
  }
}

function bakeSpec(scoreId: string, levelBiome: BiomeType, level: string | null): BakeSpec {
  const id = scoreIdFor(scoreId)
  const song = compile(SCORES[id])
  const section = barSection(song)!
  const config = level ? getLevelConfig(level) : undefined
  return {
    key: SCORE_KEYS[id],
    beats: section.beats,
    beatS: section.barDur / section.beats,
    biome: levelBiome,
    boss: !!config?.boss,
    fireworks: FIREWORK_BIOMES.includes(levelBiome),
  }
}

const scoreIdOf = (level: string | null) => (level && SCORES[level] ? level : 'title')

function install(key: string, spec: BakeSpec, baked: Bank) {
  bank = baked
  bankKey = key
  bankSpec = spec
  if (isAudioReady()) ensureGraph()
}

/** Offline renders (`npm run audio:render -- --launch`): bakes a level's bank now, to land at a scripted moment of the render. */
export async function prebake(level: string, levelBiome: BiomeType): Promise<() => void> {
  const key = `${scoreIdOf(level)}:${levelBiome}`
  const spec = bakeSpec(scoreIdOf(level), levelBiome, level)
  const baked = await bakeBank(spec, BAKE_RATE, hashString(key))
  return () => {
    wanted = key
    install(key, spec, baked)
  }
}

/** A bake installs only if it is still the one `wanted`: a menu's and a level's prepare can overlap. */
function prepare(level: string | null, levelBiome: BiomeType): Promise<void> {
  const key = `${scoreIdOf(level)}:${levelBiome}`
  wanted = key
  if (bank && bankKey === key) {
    if (isAudioReady()) ensureGraph()
    return Promise.resolve()
  }
  if (baking?.key === key) return baking.promise
  const spec = bakeSpec(scoreIdOf(level), levelBiome, level)
  const promise = bakeBank(spec, isAudioReady() ? audioContext().sampleRate : BAKE_RATE, hashString(key))
    .then((baked) => {
      if (wanted === key) install(key, spec, baked)
    })
    .finally(() => {
      if (baking?.key === key) baking = null
    })
  baking = { key, promise }
  return promise
}

const NO_PLACE: Placement = { pan: 0, cutoffHz: 20000 }
const UI_ROUTED = new Set<ArcadeSoundId>(['countReady', 'countGo', 'uiSelect', 'uiBack', 'uiLaunch', 'uiWhoosh'])

/** Null before audio unlocks or the bank is baked, or when every voice plays something more important. */
function play(id: ArcadeSoundId, at = 0, variant = 0, rate = 1, db = 0, place: Placement | null = null, loopOffset = -1): Voice | null {
  const buffer = bank?.get(id)?.[variant]
  if (!buffer || !isAudioReady()) return null
  try {
    const g = ensureGraph()
    const now = clock()
    const def = ARCADE_SOUNDS[id]
    const loop = loopOffset >= 0
    const ui = UI_ROUTED.has(id)
    let t = Math.max(at, now)
    let v: Voice
    if (loop) v = g.lift
    else {
      const pool = ui ? g.uiVoices : g.voices
      const i = pickVoice(pool, def.prio, t)
      if (i < 0) {
        if (!ui) stats.rejected++
        return null
      }
      v = pool[i]
    }
    release(v.src)
    if (v.src && v.endsAt > t) {
      if (!loop && !ui) stats.stolen++
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setTargetAtTime(0, t, STEAL_FADE_S / 3)
      t += STEAL_FADE_S
      v.src.stop(t)
    }
    const p = place ?? NO_PLACE
    v.gain.gain.setValueAtTime(Math.pow(10, (def.db + db) / 20) * (place ? panGain(p.pan) : 1), t)
    v.lp.frequency.setValueAtTime(p.cutoffHz, t)
    v.pan.pan.setValueAtTime(p.pan, t)
    v.send.gain.setValueAtTime(def.send, t)
    const src = g.ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    src.connect(v.gain)
    if (loop) {
      src.loop = true
      src.start(t, loopOffset % buffer.duration)
    } else src.start(t)
    v.src = src
    v.prio = def.prio
    v.startedAt = t
    v.endsAt = loop ? Infinity : t + buffer.duration / rate
    if (ui) stats.ui++
    else if (!loop) {
      src.onended = onSourceEnded
      stats.played++
      stats.peak = Math.max(stats.peak, ++stats.live)
    }
    return v
  } catch (e) {
    dropSound(id, e)
    return null
  }
}

const beat = { t: 0, beatInBar: 0 }

/** Null with no score playing: the cue plays at once. */
function onBeat(): typeof beat | null {
  const grid = scrimPlayer()?.musicGrid()
  if (!grid) return null
  return nextBeat(clock(), grid.origin, grid.beatS, grid.beats, BEAT_LEAD_S, beat)
}

function playOnBeat(id: ArcadeSoundId) {
  play(id, onBeat()?.t ?? 0)
}

function setLift(on: boolean) {
  if (on === liftOn) return
  if (on && !bank?.get('frenzyLift')) return
  liftOn = on
  try {
    if (on) {
      // Starts on a beat, at that beat's place in the one-bar loop, so it stays on the score's bar.
      const b = onBeat()
      const v = play('frenzyLift', b?.t ?? 0, 0, 1, 0, null, b && bankSpec ? b.beatInBar * bankSpec.beatS : 0)
      if (!v) return
      const level = v.gain.gain
      const t = v.startedAt
      level.setValueAtTime(0, t)
      level.setTargetAtTime(Math.pow(10, ARCADE_SOUNDS.frenzyLift.db / 20), t, LIFT_FADE_S)
    } else if (graph?.lift.src) {
      const { lift } = graph
      const t = clock()
      lift.gain.gain.cancelScheduledValues(t)
      lift.gain.gain.setTargetAtTime(0, t, LIFT_FADE_S)
      lift.src!.stop(t + LIFT_FADE_S * 8)
      lift.src = null
      lift.endsAt = 0
    }
  } catch (e) {
    dropSound('frenzy lift', e)
  }
}

let killsPlayed = 0

function playKill(body: ArcadeSoundId, combo: number, at: Placement | null) {
  if (play(body, 0, 0, killRate(combo), 0, at)) killsPlayed++
  // The combo tier: 0 = the body (1×), 1 = + thump (2×), 2 = + ring (3×), 3 = + payout (5×).
  const tier = comboTierIndex(combo)
  if (tier >= 1) play('kill.thump', 0, 0, 1, 0, at)
  if (tier >= 2) play('kill.ring', 0, 0, 1, 0, at)
  if (tier >= 3) play('kill.payout', 0, 0, 1, 0, at)
}

let fireVariant = 0

const UI_SOUNDS: Record<UiSound, ArcadeSoundId> = { select: 'uiSelect', back: 'uiBack', launch: 'uiLaunch', whoosh: 'uiWhoosh' }

export const arcadeSfx: SfxEngine = {
  prepare,
  fire(auto, weapon = 'blaster') {
    const db = auto ? AUTO_FIRE_DB : 0
    if (weapon !== 'blaster') {
      play(`fire.${weapon}`, 0, 0, 0.96 + Math.random() * 0.08, db, null)
      return
    }
    fireVariant = (fireVariant + 1) % 2
    play('fire', 0, fireVariant, 0.96 + Math.random() * 0.08, db, null)
  },
  pickup: () => void play('pickup'),
  hit: (combo, at) => void play('hit', 0, 0, hitRate(combo) * (0.97 + Math.random() * 0.06), 0, at),
  kill: (combo, sound, at) => playKill(`kill.${sound}`, combo, at),
  bossPart: (combo, partId, at) => {
    if (partId.startsWith('balloon')) play('goldenBalloon', 0, 0, 1, 0, at)
    else playKill('kill.crunch', combo, at)
  },
  comboBreak: () => void play('comboBreak'),
  penalty: (at) => void play('penalty', 0, 0, 1, 0, at),
  frenzy: () => playOnBeat('frenzy'),
  frenzyLift: setLift,
  waveIncoming: () => playOnBeat('waveTell'),
  bossArrival: () => playOnBeat('bossArrival'),
  bossHit: (hpFraction) => void play('bossHit', 0, 0, bossHitRate(hpFraction)),
  bossDefeat: () => void play('bossDefeat'),
  fireworkWhistle(flightS, timeScale) {
    const s = fireworkWhistleS(flightS, timeScale)
    let v = 0
    for (let i = 1; i < WHISTLE_LENGTHS_S.length; i++) if (Math.abs(WHISTLE_LENGTHS_S[i] - s) < Math.abs(WHISTLE_LENGTHS_S[v] - s)) v = i
    play('fireworkWhistle', 0, v, WHISTLE_LENGTHS_S[v] / s)
  },
  fireworkPop: () => void play('fireworkPop'),
  starChime: (index) => void play(index <= 0 ? 'star1' : index === 1 ? 'star2' : 'star3'),
  ui: (sound) => void play(UI_SOUNDS[sound]),
  countdown: (go) => void play(go ? 'countGo' : 'countReady'),
  wind: setWind,
  nodeCount: () => graphNodes,
  killsPlayed: () => killsPlayed,
  voices: () => stats,
  dispose(level) {
    setLift(false)
    // A menu may already have asked for its own sounds: leave those alone, but silence the ride wind.
    if (level !== undefined && !wanted?.startsWith(`${scoreIdOf(level)}:`)) {
      setWind(0)
      return
    }
    wanted = null
    disposeGraph()
    bank = null
    bankKey = null
    bankSpec = null
    baking = null
  },
}

/** e2e, before a burst. */
export function resetVoiceStats(): void {
  stats.peak = stats.live
  stats.played = stats.stolen = stats.rejected = 0
}
