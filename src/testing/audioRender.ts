/** `npm run audio:render`'s renders of the game's own music and SFX code, and of any score through the score engine. */
import { renderOffline, type OfflineRenderScope } from '@/audio/offlineRender'
import { setMusicDucked } from '@/audio/AudioEngine'
import { musicLoop, setMusicIntensity, startMusic, stopMusic } from '@/audio/MusicManager'
import { TITLE_LOOP, startTitleMusic, stopTitleMusic } from '@/audio/TitleMusicManager'
import { sfxEngine, silentSfx, type Placement, type SfxEngine } from '@/audio/sfx'
import { FIREWORK_BIOMES, type KillSound } from '@/audio/sfxDesign'
import { COMBO_TIERS, FRENZY, TOP_TIER } from '@/combat/comboTiers'
import { getLevelConfig } from '@/levels/LevelRegistry'
import type { BiomeType } from '@/types/level'
import type { MusicEngine } from '@/audio/musicEngine'
import { compile } from '@/audio/scrim/score'
import { renderOffline as renderScoreOffline, type Voicing } from '@/audio/scrim/synth'
import { loopSeams } from '@/audio/scrim/scheduler'
import { SCORES } from '@/audio/scores'
import { createRng } from '@/utils/rng'

export type AudioRenderRequest =
  /** `track`: 'title', a level id, or (score engine) 'results'. */
  | { kind: 'music'; track: string; intensity?: number; seconds?: number; engine?: MusicEngine }
  /** `engine: 'scrim'`: the arcade SFX (`audio/arcade/`), plus the sounds only it has. */
  | { kind: 'sfxSheet'; level?: string; engine?: MusicEngine }
  /** `stem: 'music'`: the same mix without SFX or wind, to measure the kills against. */
  | { kind: 'mix'; level: string; seconds?: number; engine?: MusicEngine; stem?: 'music' }
  /**
   * Score text through the ported engine alone (`synth.renderOffline`, no game chain): parity with the original page.
   * `chain: 'game'` plays it through the game's music chain instead, exactly like `music` with `engine: 'scrim'`.
   */
  | { kind: 'score'; text: string; seconds?: number; voicing?: Voicing; chain?: 'game' }

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

/** `renderOffline`'s look-ahead: where the transport starts. */
const TRANSPORT_START_S = 0.1
/** Where `LevelAudio` starts a run. */
const DEFAULT_INTENSITY = 0.45
/** A held trigger's cadence in the mix renders. */
const AUTOFIRE_S = 0.1

function biomeOf(level: string): BiomeType {
  const biome = getLevelConfig(level)?.biome
  if (!biome) throw new Error(`unknown level ${level}`)
  return biome
}

function seamsIn(seconds: number, loopS: number): number[] {
  const seams: number[] = []
  for (let t = TRANSPORT_START_S + loopS; t < seconds - 0.5; t += loopS) seams.push(t)
  return seams
}

type ScrimPlayer = typeof import('@/audio/scrim/player')
/** Loaded by `renderAudio` before a plan that needs it. */
let scrim: ScrimPlayer | null = null
/** The render in progress's SFX engine. */
let sfx: SfxEngine

function stopAll() {
  stopTitleMusic()
  stopMusic()
  sfx.dispose()
  setMusicDucked(false, true)
  if (scrim) {
    scrim.disposeScores()
    scrim.driveScoresManually(false)
  }
}

/** Score-engine music from render time 0, ticked every 50 ms of render time (well inside its 0.3 s look-ahead). */
function scrimScript(p: ScrimPlayer, id: string, seconds: number) {
  return ({ at }: OfflineRenderScope) => {
    p.driveScoresManually(true)
    p.playScore(id)
    for (let t = 0.05; t < seconds; t += 0.05) at(t, p.tickScores)
  }
}

function scrimMusicPlan(p: ScrimPlayer, track: string, seconds = 30): Plan {
  const start = p.SCORE_START_DELAY_S
  const { seams, introS, barS } = loopSeams(compile(SCORES[track]), seconds - 0.5 - start)
  return {
    seconds,
    events: [{ t: start, name: `${track} score` }, { t: start + introS, name: 'loop starts' }],
    seams: seams.map((s) => start + s),
    bar: barS ? { startS: start + introS, barS } : null,
    script: scrimScript(p, track, seconds),
  }
}

function musicPlan(track: string, intensity = DEFAULT_INTENSITY, seconds = 30, engine: MusicEngine = 'tone'): Plan {
  if (engine === 'scrim' && scrim) return scrimMusicPlan(scrim, track, seconds)
  const title = track === 'title'
  const biome = title ? null : biomeOf(track)
  const loop = biome ? musicLoop(biome) : TITLE_LOOP
  return {
    seconds,
    events: [{ t: TRANSPORT_START_S, name: `${track} music` }],
    seams: seamsIn(seconds, loop.barS * loop.bars),
    bar: { startS: TRANSPORT_START_S, barS: loop.barS },
    script: () => {
      if (!biome) return startTitleMusic()
      startMusic(biome)
      setMusicIntensity(intensity)
    },
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

/** The arcade engine's extra sounds, each alone. */
function arcadeSheet(s: SfxEngine): SheetEntry[] {
  const kill = (sound: KillSound): SheetEntry => ({ name: `kill 1x (${sound})`, slotS: 0.45, play: () => s.kill(1, sound, null) })
  return [
    kill('flutter'),
    kill('crunch'),
    kill('splash'),
    kill('hiss'),
    { name: 'golden balloon', slotS: 1.1, play: () => s.bossPart(1, 'balloon-0', null) },
    { name: 'FRENZY sting', slotS: 1.6, play: () => s.frenzy() },
    { name: 'FRENZY lift (held 1.5 s)', slotS: 2.1, play: () => s.frenzyLift(true), holdS: 1.5, stop: () => s.frenzyLift(false) },
    { name: 'ui select', slotS: 0.25, play: () => s.ui('select') },
    { name: 'ui back', slotS: 0.3, play: () => s.ui('back') },
    { name: 'ui launch', slotS: 0.7, play: () => s.ui('launch') },
    { name: 'countdown Ready', slotS: 0.4, play: () => s.countdown(false) },
    { name: 'countdown GO', slotS: 0.9, play: () => s.countdown(true) },
  ]
}

function sfxSheetPlan(level = 'level1', engine: MusicEngine = 'tone'): Plan {
  const biome = biomeOf(level)
  const s = sfx
  const arcade = engine === 'scrim'
  // Each sound alone in its own slot.
  const sheet: SheetEntry[] = [
    { name: 'fire (single shot)', slotS: 0.6, play: () => s.fire(false) },
    { name: 'fire (auto, held trigger)', slotS: 0.6, play: () => s.fire(true) },
    { name: 'autofire burst (6 shots, 100 ms apart)', slotS: 1.2, play: () => s.fire(true), repeat: 6 },
    { name: 'fire (spread pickup)', slotS: 0.6, play: () => s.fire(false, 'spread') },
    { name: 'rapid pickup burst (8 shots, 100 ms apart)', slotS: 1.0, play: () => s.fire(true, 'rapid'), repeat: 8 },
    { name: 'fire (piercing pickup)', slotS: 0.6, play: () => s.fire(false, 'piercing') },
    { name: 'pickup chime', slotS: 1.2, play: () => s.pickup() },
    { name: 'hit tick', slotS: 0.6, play: () => s.hit(0, null) },
    { name: 'kill 1x', slotS: 0.6, play: () => s.kill(COMBO_TIERS[0].minCount, 'pop', null) },
    { name: 'kill 2x (+ thump)', slotS: 0.7, play: () => s.kill(COMBO_TIERS[1].minCount, 'pop', null) },
    { name: 'kill 3x (+ ring)', slotS: 0.8, play: () => s.kill(COMBO_TIERS[2].minCount, 'pop', null) },
    {
      name: arcade ? 'kill 5x (+ payout)' : 'kill 5x (+ swell)',
      slotS: arcade ? 1.1 : 1.0,
      play: () => s.kill(COMBO_TIERS[TOP_TIER].minCount, 'pop', null),
    },
    { name: 'combo break', slotS: 0.8, play: () => s.comboBreak() },
    arcade
      ? { name: 'wave tell', slotS: 1.5, play: () => s.waveIncoming() }
      : { name: 'wave stinger', slotS: 1.4, play: () => s.waveAnnounce() },
    { name: 'boss arrival', slotS: 2.0, play: () => s.bossArrival() },
    { name: 'boss hit (full hp)', slotS: 0.6, play: () => s.bossHit(1) },
    { name: 'boss hit (low hp)', slotS: 0.6, play: () => s.bossHit(0.2) },
    { name: 'boss defeat', slotS: 2.4, play: () => s.bossDefeat() },
    ...(FIREWORK_BIOMES.includes(biome)
      ? [
          { name: 'firework whistle', slotS: 1.6, play: () => s.fireworkWhistle(1.2, 1) },
          { name: 'firework pop', slotS: 1.0, play: () => s.fireworkPop() },
        ]
      : []),
    { name: 'star chime 1', slotS: 1.0, play: () => s.starChime(0) },
    { name: 'star chime 2', slotS: 1.0, play: () => s.starChime(1) },
    { name: 'star chime 3', slotS: 1.5, play: () => s.starChime(2) },
    ...(arcade ? arcadeSheet(s) : []),
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

/** Kills around the stereo field, near and far (the Tone kit ignores placement). */
function killPlacement(n: number, out: Placement): Placement {
  out.pan = 0.6 * Math.sin(n * 2.1)
  out.cutoffHz = n % 3 === 2 ? 5000 : 18000
  return out
}

function mixPlan(level: string, seconds = 20, engine: MusicEngine = 'tone', musicOnly = false): Plan {
  const biome = biomeOf(level)
  const events: Plan['events'] = [{ t: TRANSPORT_START_S, name: `${level} music + wind` }]
  const p = engine === 'scrim' ? scrim : null
  const s = musicOnly ? silentSfx : sfx
  const place: Placement = { pan: 0, cutoffHz: 20000 }
  return {
    seconds,
    events,
    seams: [],
    bar: null,
    script: (scope) => {
      const { at } = scope
      if (p) scrimScript(p, level, seconds)(scope)
      else startMusic(biome)
      setMusicIntensity(DEFAULT_INTENSITY)
      void s.prepare(level, biome)
      for (let t = 0.2; t < seconds; t += 0.5) {
        const speed = 0.7 + 0.2 * Math.sin(t * 0.8)
        at(t, () => s.wind(speed))
      }
      events.push({ t: 1, name: 'autofire starts (held trigger)' })
      for (let t = 1; t < seconds - 0.5; t += AUTOFIRE_S) at(t, () => s.fire(true))
      const wave = 4
      events.push({ t: wave, name: engine === 'scrim' ? 'wave tell' : 'wave stinger' })
      at(wave, () => {
        s.waveIncoming()
        s.waveAnnounce()
      })
      // As LevelAudio: combo lifts the intensity, the 5× tier's slow-mo ducks the music and holds the FRENZY lift.
      let combo = 0
      for (let t = 1.6; t < seconds - 0.5; t += KILL_EVERY_S) {
        const n = ++combo
        at(t, () => s.hit(n - 1, null))
        events.push({ t: Math.round((t + 0.08) * 1000) / 1000, name: `kill ${n}` })
        at(t + 0.08, () => {
          s.kill(n, 'pop', killPlacement(n, place))
          setMusicIntensity(DEFAULT_INTENSITY + Math.min(n / 5, 1) * 0.3)
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
  music: (r) => musicPlan(r.track, r.intensity, r.seconds, r.engine),
  sfxSheet: (r) => sfxSheetPlan(r.level, r.engine),
  mix: (r) => mixPlan(r.level, r.seconds, r.engine, r.stem === 'music'),
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
  sfx = await sfxEngine('scrim')
  const id = `render-${++renderedScores}`
  SCORES[id] = req.text
  try {
    const plan = scrimMusicPlan(scrim, id, req.seconds ?? 20)
    const buffer = await renderOffline({ seconds: plan.seconds, seed, engine: 'scrim' }, plan.script, stopAll)
    return { sampleRate: buffer.sampleRate, seconds: plan.seconds, pcm: toBase64(buffer), events: plan.events, seams: plan.seams, bar: plan.bar }
  } finally {
    delete SCORES[id]
  }
}

export async function renderAudio(req: AudioRenderRequest, seed = 1): Promise<AudioRenderResult> {
  if (req.kind === 'score') return req.chain === 'game' ? renderScoreInGame(req, seed) : renderScore(req, seed)
  const engine = ('engine' in req && req.engine) || 'tone'
  if (engine === 'scrim') scrim = await import('@/audio/scrim/player')
  sfx = await sfxEngine(engine)
  // The arcade bake is async, so it runs before the render; the Tone kit builds inside it.
  if (engine === 'scrim' && req.kind !== 'music') await sfx.prepare(req.level ?? 'level1', biomeOf(req.level ?? 'level1'))
  const plan = (RENDERS[req.kind] as (r: GamePlanRequest) => Plan)(req)
  const buffer = await renderOffline({ seconds: plan.seconds, seed, engine }, plan.script, stopAll)
  return { sampleRate: buffer.sampleRate, seconds: plan.seconds, pcm: toBase64(buffer), events: plan.events, seams: plan.seams, bar: plan.bar }
}
