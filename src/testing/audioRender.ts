/** `npm run audio:render`'s renders of the game's own music and SFX code, and of any score through the score engine. */
import { renderOffline, type OfflineRenderScope } from '@/audio/offlineRender'
import { setMusicDucked } from '@/audio/AudioEngine'
import { loadArcade, silentSfx, type Placement, type SfxEngine } from '@/audio/sfx'
import { FIREWORK_BIOMES, type KillSound } from '@/audio/sfxDesign'
import { COMBO_TIERS, FRENZY, TOP_TIER, comboTierIndex } from '@/combat/comboTiers'
import { intensityForTier } from '@/audio/scrim/layers'
import { getLevelConfig } from '@/levels/LevelRegistry'
import type { BiomeType } from '@/types/level'
import { compile } from '@/audio/scrim/score'
import { renderOffline as renderScoreOffline, type Voicing } from '@/audio/scrim/synth'
import { loopSeams } from '@/audio/scrim/scheduler'
import { SCORES, scoreIdFor } from '@/audio/scores'
import { createRng } from '@/utils/rng'

export type AudioRenderRequest =
  /**
    /**
     * `track`: 'title', a level id, 'results' or a theme option (`<slot>.<name>`). `layers`: the score's intensity
     * layers 0–3 held from the start, or 'ramp' (`LAYER_RAMP`: up through every layer, then a lost combo winding down).
     * `seam`: start `SEAM_LEAD_S` before the first loop seam instead of at the top.
     */
  | { kind: 'music'; track: string; layers?: number | 'ramp'; seconds?: number; seam?: boolean }
  /** Every arcade SFX (`audio/arcade/`) alone, in its own slot. */
  | { kind: 'sfxSheet'; level?: string }
  /** `stem: 'music'`: the same mix without SFX or wind, to measure the kills against. */
  | { kind: 'mix'; level: string; seconds?: number; stem?: 'music' }
  /**
   * Score text through the ported engine alone (`synth.renderOffline`, no game chain): parity with the original page.
   * `chain: 'game'` plays it through the game's music chain instead, exactly like `music`.
   */
  | { kind: 'score'; text: string; seconds?: number; voicing?: Voicing; chain?: 'game'; seam?: boolean }

export interface AudioRenderResult {
  sampleRate: number
  seconds: number
  /** Interleaved stereo float32, little-endian, base64. */
  pcm: string
  events: { t: number; name: string }[]
  seams: number[]
  bar: { startS: number; barS: number } | null
}

interface Plan {
  seconds: number
  events: { t: number; name: string }[]
  seams: number[]
  bar: AudioRenderResult['bar']
  script: (scope: OfflineRenderScope) => void
}

/** A held trigger's cadence in the mix renders. */
const AUTOFIRE_S = 0.1

function biomeOf(level: string): BiomeType {
  const biome = getLevelConfig(level)?.biome
  if (!biome) throw new Error(`unknown level ${level}`)
  return biome
}

type ScrimPlayer = typeof import('@/audio/scrim/player')
/** Loaded by `renderAudio` before a plan. */
let scrim: ScrimPlayer
/** The render in progress's SFX engine. */
let sfx: SfxEngine

function stopAll() {
  sfx.dispose()
  setMusicDucked(false, true)
  scrim.disposeScores()
  scrim.driveScoresManually(false)
}

/** A `seam` render starts this long before the first loop seam, so the seam lands in its middle. */
const SEAM_LEAD_S = 10

/** Seconds into the loop and the intensity asked for from then: off the beat on purpose, so the render shows the quantising. */
const LAYER_RAMP: [number, number][] = [[0, 0], [3.3, 1], [7.1, 2], [11.7, 3], [19.4, 0]]

/**
 * Score-engine music from song time `from` at render time 0, ticked (and asked for `intensity(t)`, like `LevelAudio`)
 * every 50 ms of render time, well inside its 0.3 s look-ahead.
 */
function scrimScript(p: ScrimPlayer, id: string, seconds: number, from = 0, intensity?: (t: number) => number) {
  return ({ at }: OfflineRenderScope) => {
    p.driveScoresManually(true)
    p.playScore(id, from)
    for (let t = 0.05; t < seconds; t += 0.05)
      at(t, () => {
        if (intensity) p.setIntensity(intensity(t))
        p.tickScores()
      })
  }
}

function musicPlan(p: ScrimPlayer, track: string, seconds = 30, seam = false, layers?: number | 'ramp'): Plan {
  if (seam && layers === 'ramp') throw new Error('--layers ramp starts at the top: not with --seam')
  const start = p.SCORE_START_DELAY_S
  const song = compile(SCORES[scoreIdFor(track)])
  const from = seam ? Math.max(0, song.intro.dur + song.loop.dur - SEAM_LEAD_S) : 0
  const { seams, introS, barS } = loopSeams(song, from + seconds - 0.5 - start)
  // Render time of song time s: start + s - from. A seam render's bar grid starts at its first bar line after `start`.
  const at = (s: number) => start + s - from
  const loopAt = at(introS)
  const firstBar = barS ? loopAt + Math.max(0, Math.ceil((from - introS) / barS)) * barS : 0
  const events = from
    ? [{ t: start, name: `${track} score from ${from.toFixed(2)} s` }]
    : [{ t: start, name: `${track} score` }, { t: loopAt, name: 'loop starts' }]
  let intensity: ((t: number) => number) | undefined
  if (layers === 'ramp') {
    for (const [s, i] of LAYER_RAMP) if (s > 0) events.push({ t: loopAt + s, name: `intensity ${i} asked` })
    intensity = (t) => {
      let i = 0
      for (const [s, n] of LAYER_RAMP) if (t >= loopAt + s) i = n
      return i
    }
  } else if (layers !== undefined) {
    events.push({ t: start, name: `intensity ${layers}` })
    intensity = () => layers
  }
  return {
    seconds,
    events,
    seams: seams.filter((s) => s > from).map(at),
    bar: barS ? { startS: firstBar, barS } : null,
    script: scrimScript(p, track, seconds, from, intensity),
  }
}

interface SheetEntry {
  name: string
  slotS: number
  play: () => void
  /** Plays again every AUTOFIRE_S. */
  repeat?: number
  /** Stops a held sound this long after it starts. */
  holdS?: number
  stop?: () => void
}

function sfxSheetPlan(level = 'level1'): Plan {
  const biome = biomeOf(level)
  const s = sfx
  const kill = (sound: KillSound): SheetEntry => ({ name: `kill 1x (${sound})`, slotS: 0.45, play: () => s.kill(1, sound, null) })
  // Each sound alone in its own slot.
  const sheet: SheetEntry[] = [
    { name: 'fire (single shot)', slotS: 0.35, play: () => s.fire(false) },
    { name: 'fire (auto, held trigger)', slotS: 0.35, play: () => s.fire(true) },
    { name: 'autofire burst (6 shots, 100 ms apart)', slotS: 0.8, play: () => s.fire(true), repeat: 6 },
    { name: 'fire (spread pickup)', slotS: 0.35, play: () => s.fire(false, 'spread') },
    { name: 'rapid pickup burst (8 shots, 100 ms apart)', slotS: 0.9, play: () => s.fire(true, 'rapid'), repeat: 8 },
    { name: 'fire (piercing pickup)', slotS: 0.4, play: () => s.fire(false, 'piercing') },
    { name: 'pickup chime', slotS: 1.0, play: () => s.pickup() },
    { name: 'hit tick', slotS: 0.3, play: () => s.hit(0, null) },
    { name: 'kill 1x', slotS: 0.5, play: () => s.kill(COMBO_TIERS[0].minCount, 'pop', null) },
    { name: 'kill 2x (+ thump)', slotS: 0.7, play: () => s.kill(COMBO_TIERS[1].minCount, 'pop', null) },
    { name: 'kill 3x (+ ring)', slotS: 0.8, play: () => s.kill(COMBO_TIERS[2].minCount, 'pop', null) },
    { name: 'kill 5x (+ payout)', slotS: 1.1, play: () => s.kill(COMBO_TIERS[TOP_TIER].minCount, 'pop', null) },
    { name: 'combo break', slotS: 0.65, play: () => s.comboBreak() },
    { name: 'wave tell', slotS: 1.5, play: () => s.waveIncoming() },
    { name: 'boss arrival', slotS: 2.0, play: () => s.bossArrival() },
    { name: 'boss hit (full hp)', slotS: 0.45, play: () => s.bossHit(1) },
    { name: 'boss hit (low hp)', slotS: 0.45, play: () => s.bossHit(0.2) },
    { name: 'boss defeat', slotS: 2.2, play: () => s.bossDefeat() },
    ...(FIREWORK_BIOMES.includes(biome)
      ? [
          { name: 'firework whistle', slotS: 1.6, play: () => s.fireworkWhistle(1.2, 1) },
          { name: 'firework pop', slotS: 0.8, play: () => s.fireworkPop() },
        ]
      : []),
    { name: 'star chime 1', slotS: 0.7, play: () => s.starChime(0) },
    { name: 'star chime 2', slotS: 0.7, play: () => s.starChime(1) },
    { name: 'star chime 3', slotS: 1.5, play: () => s.starChime(2) },
    kill('flutter'),
    kill('crunch'),
    kill('splash'),
    kill('hiss'),
    { name: 'golden balloon', slotS: 1.0, play: () => s.bossPart(1, 'balloon-0', null) },
    { name: 'FRENZY sting', slotS: 1.6, play: () => s.frenzy() },
    { name: 'FRENZY lift (held 1.5 s)', slotS: 1.9, play: () => s.frenzyLift(true), holdS: 1.5, stop: () => s.frenzyLift(false) },
    { name: 'ui select', slotS: 0.25, play: () => s.ui('select') },
    { name: 'ui back', slotS: 0.3, play: () => s.ui('back') },
    { name: 'ui launch', slotS: 0.6, play: () => s.ui('launch') },
    { name: 'title PLAY whoosh', slotS: 0.6, play: () => s.ui('whoosh') },
    { name: 'countdown Ready', slotS: 0.4, play: () => s.countdown(false) },
    { name: 'countdown GO', slotS: 0.8, play: () => s.countdown(true) },
  ]
  const events: Plan['events'] = []
  let t = 0.3
  for (const e of sheet) {
    events.push({ t, name: e.name })
    t = Math.round((t + e.slotS) * 1000) / 1000
  }
  return {
    seconds: Math.ceil(t * 10) / 10,
    events,
    seams: [],
    bar: null,
    script: ({ at }) => {
      void s.prepare(level, biome)
      sheet.forEach((e, i) => {
        for (let k = 0; k < (e.repeat ?? 1); k++) at(events[i].t + k * AUTOFIRE_S, e.play)
        if (e.stop) at(events[i].t + (e.holdS ?? 0), e.stop)
      })
    },
  }
}

const KILL_EVERY_S = 0.75

/** Kills around the stereo field, near and far. */
function killPlacement(n: number, out: Placement): Placement {
  out.pan = 0.6 * Math.sin(n * 2.1)
  out.cutoffHz = n % 3 === 2 ? 5000 : 18000
  return out
}

function mixPlan(level: string, seconds = 20, musicOnly = false): Plan {
  const biome = biomeOf(level)
  const p = scrim
  const events: Plan['events'] = [{ t: p.SCORE_START_DELAY_S, name: `${level} music + wind` }]
  const s = musicOnly ? silentSfx : sfx
  const place: Placement = { pan: 0, cutoffHz: 20000 }
  return {
    seconds,
    events,
    seams: [],
    bar: null,
    script: (scope) => {
      const { at } = scope
      // As LevelAudio: the combo lifts the intensity.
      let kills = 0
      scrimScript(p, level, seconds, 0, () => intensityForTier(comboTierIndex(kills)))(scope)
      void s.prepare(level, biome)
      for (let t = 0.2; t < seconds; t += 0.5) {
        const speed = 0.7 + 0.2 * Math.sin(t * 0.8)
        at(t, () => s.wind(speed))
      }
      events.push({ t: 1, name: 'autofire starts (held trigger)' })
      for (let t = 1; t < seconds - 0.5; t += AUTOFIRE_S) at(t, () => s.fire(true))
      const wave = 4
      events.push({ t: wave, name: 'wave tell' })
      at(wave, () => s.waveIncoming())
      // The 5× tier's slow-mo ducks the music and holds the FRENZY lift.
      let combo = 0
      for (let t = 1.6; t < seconds - 0.5; t += KILL_EVERY_S) {
        const n = ++combo
        at(t, () => s.hit(n - 1, null))
        events.push({ t: Math.round((t + 0.08) * 1000) / 1000, name: `kill ${n}` })
        at(t + 0.08, () => {
          kills = n
          s.kill(n, 'pop', killPlacement(n, place))
        })
        at(t + KILL_EVERY_S / 2, () => s.hit(n, null))
        if (n === COMBO_TIERS[TOP_TIER].minCount) {
          events.push({ t, name: `FRENZY (kill ${n}): music ducked for ${FRENZY.durationS} s` })
          at(t + 0.08, () => {
            s.frenzy()
            s.frenzyLift(true)
            setMusicDucked(true)
          })
          at(t + 0.08 + FRENZY.durationS, () => setMusicDucked(false))
        }
      }
      events.push({ t: 1.6, name: `kills every ${KILL_EVERY_S} s, combo climbing` })
      events.sort((a, b) => a.t - b.t)
    },
  }
}

type GamePlanRequest = Exclude<AudioRenderRequest, { kind: 'score' }>

const RENDERS: { [K in GamePlanRequest['kind']]: (req: Extract<GamePlanRequest, { kind: K }>) => Plan } = {
  music: (r) => musicPlan(scrim, r.track, r.seconds, r.seam, r.layers),
  sfxSheet: (r) => sfxSheetPlan(r.level),
  mix: (r) => mixPlan(r.level, r.seconds, r.stem === 'music'),
}

function toBase64(buffer: AudioBuffer): string {
  const l = buffer.getChannelData(0)
  const r = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : l
  const pcm = new Float32Array(l.length * 2)
  for (let i = 0; i < l.length; i++) {
    pcm[2 * i] = l[i]
    pcm[2 * i + 1] = r[i]
  }
  const bytes = new Uint8Array(pcm.buffer)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** The port on its own, seeded like the original page's render in `scripts/audio/render.mjs` (same PRNG, same call order). */
async function renderScore(req: Extract<AudioRenderRequest, { kind: 'score' }>, seed: number): Promise<AudioRenderResult> {
  const song = compile(req.text)
  if (song.errors.length) throw new Error(`score errors:\n${song.errors.map((e) => `line ${e.line}: ${e.msg}`).join('\n')}`)
  const seconds = req.seconds ?? 20
  const random = Math.random
  Math.random = createRng(seed)
  let buffer: AudioBuffer
  try {
    buffer = await renderScoreOffline(song, seconds, 44100, { voicing: req.voicing })
  } finally {
    Math.random = random
  }
  const start = 0.05 // the original's render offset
  const { seams, introS, barS } = loopSeams(song, seconds - 0.5 - start)
  return {
    sampleRate: buffer.sampleRate, seconds, pcm: toBase64(buffer),
    events: [{ t: start, name: song.title }], seams: seams.map((s) => start + s), bar: barS ? { startS: start + introS, barS } : null,
  }
}

/** Registers the text as a score for the length of one render, so the player can play it like a game score. */
let renderedScores = 0
async function renderScoreInGame(req: Extract<AudioRenderRequest, { kind: 'score' }>, seed: number): Promise<AudioRenderResult> {
  const song = compile(req.text)
  if (song.errors.length) throw new Error(`score errors:\n${song.errors.map((e) => `line ${e.line}: ${e.msg}`).join('\n')}`)
  scrim = await import('@/audio/scrim/player')
  sfx = (await loadArcade()).arcadeSfx
  const id = `render-${++renderedScores}`
  SCORES[id] = req.text
  try {
    const plan = musicPlan(scrim, id, req.seconds ?? 20, req.seam)
    const buffer = await renderOffline({ seconds: plan.seconds, seed }, plan.script, stopAll)
    return { sampleRate: buffer.sampleRate, seconds: plan.seconds, pcm: toBase64(buffer), events: plan.events, seams: plan.seams, bar: plan.bar }
  } finally {
    delete SCORES[id]
  }
}

export async function renderAudio(req: AudioRenderRequest, seed = 1): Promise<AudioRenderResult> {
  if (req.kind === 'score') return req.chain === 'game' ? renderScoreInGame(req, seed) : renderScore(req, seed)
  scrim = await import('@/audio/scrim/player')
  sfx = (await loadArcade()).arcadeSfx
  // The arcade bake is async, so it runs before the render.
  if (req.kind !== 'music') await sfx.prepare(req.level ?? 'level1', biomeOf(req.level ?? 'level1'))
  const plan = (RENDERS[req.kind] as (r: GamePlanRequest) => Plan)(req)
  const buffer = await renderOffline({ seconds: plan.seconds, seed }, plan.script, stopAll)
  return { sampleRate: buffer.sampleRate, seconds: plan.seconds, pcm: toBase64(buffer), events: plan.events, seams: plan.seams, bar: plan.bar }
}
