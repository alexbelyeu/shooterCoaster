/** Arcade SFX (`?audio=scrim`): baked one-shots, each a fresh buffer source on a fixed, priority-stolen voice pool (decision 2026-10-31-217). */
import * as Tone from 'tone'
import type { BiomeType } from '@/types/level'
import { getLevelConfig } from '@/levels/LevelRegistry'
import { createRng, hashString } from '@/utils/rng'
import { arcadeChannel, isAudioReady } from '../AudioEngine'
import { scrimPlayer } from '../musicEngine'
import { dropSound } from '../soundGuard'
import { compile } from '../scrim/score'
import { makeIR } from '../scrim/synth'
import { SCORES } from '../scores'
import {
  ARCADE_SOUNDS, AUTO_FIRE_DB, BIOME_REVERB, FIREWORK_BIOMES, STEAL_FADE_S, VOICE_BUDGET, WHISTLE_LENGTHS_S, SCORE_KEYS,
  WIND, bossHitRate, fireworkWhistleS, hitRate, killRate, killTier, nextBeat, pickVoice, windGain, windHz, windUpdateDue,
  type ArcadeSoundId, type VoiceState, type WindRamp,
} from '../sfxDesign'
import type { Placement, SfxEngine, VoiceStats } from '../sfx'
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
  channel: Tone.Channel
  biome: BiomeType
  out: GainNode
  verb: ConvolverNode
  verbTone: BiquadFilterNode
  verbReturn: GainNode
  voices: Voice[]
  /** The FRENZY lift's own voice: a loop, never stolen. */
  lift: Voice
  /** The ride wind, as in the Tone kit: looped noise → band-pass → gain, silent until `wind` opens it. */
  windSrc: AudioBufferSourceNode
  windBand: BiquadFilterNode
  windAmp: GainNode
}

const LIFT_FADE_S = 0.12
const BEAT_LEAD_S = 0.02

let graph: Graph | null = null
let bank: Bank | null = null
let bankKey: string | null = null
let bankSpec: BakeSpec | null = null
let biome: BiomeType = 'themePark'
/** `score:biome` of the last `prepare`. */
let wanted: string | null = null
let baking: { key: string; promise: Promise<void> } | null = null
let liftOn = false

const stats: VoiceStats = { budget: VOICE_BUDGET, live: 0, peak: 0, played: 0, stolen: 0, rejected: 0 }

const rawContext = () => Tone.getContext().rawContext as unknown as BaseAudioContext
/** The live clock, or an offline render's scripted time (its context runs ahead by a look-ahead). */
const clock = () => Tone.now() - Tone.getContext().lookAhead

function createVoice(ctx: BaseAudioContext, out: AudioNode, verbIn: AudioNode): Voice {
  const gain = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 0.5
  const pan = ctx.createStereoPanner()
  const send = ctx.createGain()
  send.gain.value = 0
  gain.connect(lp).connect(pan).connect(out)
  lp.connect(send).connect(verbIn)
  return { gain, lp, pan, send, src: null, prio: 0, startedAt: 0, endsAt: 0 }
}

/** Rebuilt when Tone's context or channel changes (an offline render) or the biome does. */
function ensureGraph(): Graph {
  const ctx = rawContext()
  if (graph && graph.ctx === ctx && graph.channel === arcadeChannel && graph.biome === biome) return graph
  disposeGraph()
  const room = BIOME_REVERB[biome]
  const out = ctx.createGain()
  Tone.connect(out, arcadeChannel)
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
  graph = { ctx, channel: arcadeChannel, biome, out, verb, verbTone, verbReturn, voices, lift: createVoice(ctx, out, verb), ...createWind(ctx, out) }
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

function disposeGraph() {
  if (!graph) return
  for (const v of [...graph.voices, graph.lift]) {
    try {
      v.src?.stop()
    } catch {
      /* never started or already stopped */
    }
    for (const n of [v.src, v.gain, v.lp, v.pan, v.send]) n?.disconnect()
  }
  graph.windSrc.stop()
  for (const n of [graph.windSrc, graph.windBand, graph.windAmp, graph.verb, graph.verbTone, graph.verbReturn, graph.out]) n.disconnect()
  graph = null
  liftOn = false
}

const VOICE_NODES = 4
const BUS_NODES = 4
const WIND_NODES = 3

function bakeSpec(scoreId: string, levelBiome: BiomeType, level: string | null): BakeSpec {
  const song = compile(SCORES[scoreId])
  const section = song.loop.sections[0] ?? song.intro.sections[0]
  const config = level ? getLevelConfig(level) : undefined
  return {
    key: SCORE_KEYS[scoreId],
    beats: section.beats,
    beatS: section.barDur / section.beats,
    biome: levelBiome,
    boss: !!config?.boss,
    fireworks: FIREWORK_BIOMES.includes(levelBiome),
  }
}

const scoreIdOf = (level: string | null) => (level && SCORES[level] ? level : 'title')

/** A bake installs only if it is still the one `wanted`: a menu's and a level's prepare can overlap. */
function prepare(level: string | null, levelBiome: BiomeType): Promise<void> {
  const key = `${scoreIdOf(level)}:${levelBiome}`
  wanted = key
  biome = levelBiome
  if (bank && bankKey === key) {
    if (isAudioReady()) ensureGraph()
    return Promise.resolve()
  }
  if (baking?.key === key) return baking.promise
  const spec = bakeSpec(scoreIdOf(level), levelBiome, level)
  const promise = bakeBank(spec, rawContext().sampleRate, hashString(key))
    .then((baked) => {
      if (wanted !== key) return
      bank = baked
      bankKey = key
      bankSpec = spec
      if (isAudioReady()) ensureGraph()
    })
    .finally(() => {
      if (baking?.key === key) baking = null
    })
  baking = { key, promise }
  return promise
}

const NO_PLACE: Placement = { pan: 0, cutoffHz: 20000 }

/** Null before audio unlocks or the bank is baked, or when every voice plays something more important. */
function play(id: ArcadeSoundId, at = 0, variant = 0, rate = 1, db = 0, place: Placement | null = null, loopOffset = -1): Voice | null {
  const buffer = bank?.get(id)?.[variant]
  if (!buffer || !isAudioReady()) return null
  try {
    const g = ensureGraph()
    const now = clock()
    const def = ARCADE_SOUNDS[id]
    const loop = loopOffset >= 0
    let t = Math.max(at, now)
    let v: Voice
    if (loop) v = g.lift
    else {
      const i = pickVoice(g.voices, def.prio, t)
      if (i < 0) {
        stats.rejected++
        return null
      }
      v = g.voices[i]
    }
    if (v.src && v.endsAt > t) {
      if (!loop) stats.stolen++
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setTargetAtTime(0, t, STEAL_FADE_S / 3)
      t += STEAL_FADE_S
      v.src.stop(t)
    }
    const p = place ?? NO_PLACE
    v.gain.gain.setValueAtTime(Math.pow(10, (def.db + db) / 20), t)
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
    stats.played++
    stats.peak = Math.max(stats.peak, liveVoices(t))
    return v
  } catch (e) {
    dropSound(id, e)
    return null
  }
}

function liveVoices(now: number): number {
  let live = 0
  if (graph) for (const v of graph.voices) if (v.endsAt > now) live++
  return live
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
  const tier = killTier(combo)
  if (tier >= 1) play('kill.thump', 0, 0, 1, 0, at)
  if (tier >= 2) play('kill.ring', 0, 0, 1, 0, at)
  if (tier >= 3) play('kill.payout', 0, 0, 1, 0, at)
}

let fireVariant = 0

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
  frenzy: () => playOnBeat('frenzy'),
  frenzyLift: setLift,
  waveIncoming: () => playOnBeat('waveTell'),
  waveAnnounce: () => {},
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
  ui: (sound) => void play(sound === 'select' ? 'uiSelect' : sound === 'back' ? 'uiBack' : 'uiLaunch'),
  countdown: (go) => void play(go ? 'countGo' : 'countReady'),
  wind: setWind,
  nodeCount: () => (graph ? BUS_NODES + WIND_NODES + VOICE_NODES * (graph.voices.length + 1) : 0),
  killsPlayed: () => killsPlayed,
  voices() {
    stats.live = liveVoices(clock())
    return stats
  },
  dispose(level) {
    setLift(false)
    // A menu may already have asked for its own sounds: leave those alone.
    if (level !== undefined && !wanted?.startsWith(`${scoreIdOf(level)}:`)) return
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
  stats.peak = stats.played = stats.stolen = stats.rejected = 0
}
