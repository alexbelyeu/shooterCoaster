/** `npm run audio:render`'s renders of the game's own music and SFX code, and of any score through the score engine. */
import { renderOffline, type OfflineRenderScope } from '@/audio/offlineRender'
import { setMusicDucked, setPauseMix } from '@/audio/AudioEngine'
import { loadArcade, silentSfx, type Placement, type SfxEngine } from '@/audio/sfx'
import { FIREWORK_BIOMES, KILL_SOUNDS, spatial, type KillSound } from '@/audio/sfxDesign'
import { COMBO_TIERS, FRENZY, TOP_TIER, frenzyTimeScale } from '@/combat/comboTiers'
import { WEAPONS } from '@/combat/weapons/weaponTypes'
import { applyCombatMix, type CombatMixTargets } from '@/audio/combatMix'
import { getLevelConfig } from '@/levels/LevelRegistry'
import type { BiomeType } from '@/types/level'
import { barSection, compile, type CompiledSong } from '@/audio/scrim/score'
import { renderOffline as renderScoreOffline, type Voicing } from '@/audio/scrim/synth'
import { loopSeams } from '@/audio/scrim/scheduler'
import { createRng } from '@/utils/rng'

export type AudioRenderRequest =
  /**
    /**
     * `track`: 'title', a level id, a results cut ('results-win' / 'results-lose') or a theme option (`<slot>.<name>`). `layers`: the score's intensity
     * layers 0–3 held from the start, or 'ramp' (`LAYER_RAMP`: up through every layer, then a lost combo winding down).
     * `seam`: start `SEAM_LEAD_S` before the first loop seam instead of at the top.
     */
  | { kind: 'music'; track: string; layers?: number | 'ramp'; seconds?: number; seam?: boolean }
  /** Every arcade SFX (`audio/arcade/`) alone, in its own slot; `kills`: the kill sounds, which the main sheet leaves out. */
  | { kind: 'sfxSheet'; level?: string; kills?: boolean }
  /**
   * `stem: 'music'`: the same mix without SFX or wind, to measure the kills against. `boss`: the boss arrives at
   * `BOSS_MIX.arriveS` and falls `BOSS_MIX.defeatBeforeEndS` before the end, as `LevelAudio` plays them (#598); the
   * section switches are the render's seams.
   */
  | { kind: 'mix'; level: string; seconds?: number; stem?: 'music'; boss?: boolean }
  /**
   * Score text through the ported engine alone (`synth.renderOffline`, no game chain): parity with the original page.
   * `chain: 'game'` plays it through the game's music chain instead, exactly like `music`.
   */
  | { kind: 'score'; text: string; seconds?: number; voicing?: Voicing; chain?: 'game'; seam?: boolean }
  /** The ride's own sounds (#697): GO's launch whoosh, a crawl, a chain lift, then the drop's wind and rumble up to top speed. */
  | { kind: 'ride'; level: string }
  /** Level select's launch blip for `level`, its bank and room landing under the blip's ring (#246), then the countdown and a kill. */
  | { kind: 'launch'; level: string }
  /**
   * A paused run resuming (#650): the resume Ready / GO under the pause gate, which opens at GO as the run plays again.
   * `unpaused`: the same sounds with no pause, the reference a resume should match (nothing of the countdown's swells in).
   */
  | { kind: 'resume'; level: string; unpaused?: boolean }

export interface AudioRenderResult {
  sampleRate: number
  seconds: number
  /** Interleaved stereo float32, little-endian, base64. */
  pcm: string
  events: { t: number; name: string }[]
  seams: number[]
  bar: { startS: number; barS: number } | null
  /** Moments to check for a click (`clickDb`). */
  clicks?: number[]
}

interface Plan {
  seconds: number
  events: { t: number; name: string }[]
  seams: number[]
  bar: AudioRenderResult['bar']
  clicks?: number[]
  script: (scope: OfflineRenderScope) => void
}

/** A held trigger's cadence: the blaster's, as `useShooting` auto-fires it. */
const AUTOFIRE_S = WEAPONS.blaster.fireIntervalMs / 1000

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
  const song = p.songFor(track)
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

/** The kill sound the combo-tier slots play. */
const COMBO_SOUND: KillSound = 'pop'

/**
 * Every kill: the combo tiers, then each other kill sound in `KILL_SOUNDS` once, so a new one is in the sheet without
 * an edit here. Its own sheet (`kills`) keeps both under the 30 s render cap as kill sounds are added (#525).
 */
function killSheet(): SheetEntry[] {
  return [
    { name: 'kill 1x', slotS: 0.5, play: () => sfx.kill(COMBO_TIERS[0].minCount, COMBO_SOUND, null) },
    { name: 'kill 2x (+ thump)', slotS: 0.7, play: () => sfx.kill(COMBO_TIERS[1].minCount, COMBO_SOUND, null) },
    { name: 'kill 3x (+ ring)', slotS: 0.8, play: () => sfx.kill(COMBO_TIERS[2].minCount, COMBO_SOUND, null) },
    { name: 'kill 5x (+ payout)', slotS: 1.1, play: () => sfx.kill(COMBO_TIERS[TOP_TIER].minCount, COMBO_SOUND, null) },
    ...KILL_SOUNDS.filter((sound) => sound !== COMBO_SOUND).map((sound) => ({
      name: `kill 1x (${sound})`,
      slotS: 0.45,
      play: () => sfx.kill(1, sound, null),
    })),
  ]
}

function sfxSheetPlan(level = 'level1', kills = false): Plan {
  const biome = biomeOf(level)
  const s = sfx
  // Each sound alone in its own slot.
  const sheet: SheetEntry[] = kills ? killSheet() : [
    { name: 'fire (single shot)', slotS: 0.35, play: () => s.fire(false) },
    { name: 'fire (auto, held trigger)', slotS: 0.35, play: () => s.fire(true) },
    { name: 'autofire burst (6 shots, 100 ms apart)', slotS: 0.8, play: () => s.fire(true), repeat: 6 },
    { name: 'fire (spread pickup)', slotS: 0.35, play: () => s.fire(false, 'spread') },
    { name: 'rapid pickup burst (8 shots, 100 ms apart)', slotS: 0.9, play: () => s.fire(true, 'rapid'), repeat: 8 },
    { name: 'fire (piercing pickup)', slotS: 0.4, play: () => s.fire(false, 'piercing') },
    { name: 'pickup chime', slotS: 1.0, play: () => s.pickup() },
    { name: 'hit tick', slotS: 0.3, play: () => s.hit(0, null) },
    { name: 'combo break', slotS: 0.65, play: () => s.comboBreak() },
    { name: 'bystander penalty', slotS: 0.6, play: () => s.penalty(null) },
    { name: 'wave tell', slotS: 1.5, play: () => s.waveIncoming() },
    { name: 'boss arrival', slotS: 2.0, play: () => s.bossArrival(null) },
    { name: 'boss hit (full hp)', slotS: 0.45, play: () => s.bossHit(1, null) },
    { name: 'boss hit (low hp)', slotS: 0.45, play: () => s.bossHit(0.2, null) },
    { name: 'boss defeat', slotS: 2.2, play: () => s.bossDefeat(null) },
    ...(FIREWORK_BIOMES.includes(biome)
      ? [
          { name: 'firework whistle', slotS: 1.6, play: () => s.fireworkWhistle(1.2, 1) },
          { name: 'firework pop', slotS: 0.8, play: () => s.fireworkPop() },
        ]
      : []),
    { name: 'photo shutter', slotS: 0.6, play: () => s.shutter() },
    { name: 'star chime 1', slotS: 0.7, play: () => s.starChime(0) },
    { name: 'star chime 2', slotS: 0.7, play: () => s.starChime(1) },
    { name: 'star chime 3', slotS: 1.5, play: () => s.starChime(2) },
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
/** A 60 Hz frame, as often as `LevelAudio` applies the combat mix. */
const FRAME_S = 1 / 60

/** tan(half the horizontal field of view): a 60° vertical one at 16:9. */
const TAN_HALF_HFOV = Math.tan(Math.PI / 6) * (16 / 9)

/** A placement `ahead` metres in front of the camera, at `screenX` of the half-width (-1 the left edge, 1 the right). */
function placeAhead(screenX: number, ahead: number, out: Placement): Placement {
  return spatial(screenX * ahead * TAN_HALF_HFOV, -ahead, TAN_HALF_HFOV, out)
}

/** Kills around the stereo field, near and (every third) far. */
function killPlacement(n: number, out: Placement): Placement {
  return placeAhead(0.8 * Math.sin(n * 2.1), n % 3 === 2 ? 150 : 25, out)
}

/** A `boss` mix: when the boss arrives and how long before the end it falls (the sting and the loop after it), and where it is. */
const BOSS_MIX = { arriveS: 6, defeatBeforeEndS: 9, arrive: { screenX: 0.4, ahead: 120 }, defeat: { screenX: -0.25, ahead: 70 } }

function mixPlan(level: string, seconds = 20, musicOnly = false, boss = false): Plan {
  const biome = biomeOf(level)
  const p = scrim
  const events: Plan['events'] = [{ t: p.SCORE_START_DELAY_S, name: `${level} music + wind` }]
  const s = musicOnly ? silentSfx : sfx
  const place: Placement = { pan: 0, cutoffHz: 20000, wet: 1 }
  const bossAt: Placement = { pan: 0, cutoffHz: 20000, wet: 1 }
  const seams: number[] = []
  const song = p.songFor(level)
  const barS = barSection(song)!.barDur
  /** Asks for `section` at render time `t`, as `LevelAudio` does on the boss event, and records where it lands. */
  const switchAt = ({ at }: OfflineRenderScope, t: number, section: 'boss' | 'sting', cue: () => void, name: string) => {
    events.push({ t, name })
    at(t, () => {
      cue()
      p.playSection(level, section)
      const { tracks } = p.scrimState()
      const landsAt = tracks[tracks.length - 1]?.switchAt
      if (landsAt == null) return
      seams.push(landsAt)
      if (section === 'sting') seams.push(landsAt + song.sting.dur)
    })
  }
  return {
    seconds,
    events,
    seams,
    bar: boss ? { startS: p.SCORE_START_DELAY_S, barS } : null,
    script: (scope) => {
      if (boss) {
        switchAt(scope, BOSS_MIX.arriveS, 'boss', () => s.bossArrival(placeAhead(BOSS_MIX.arrive.screenX, BOSS_MIX.arrive.ahead, bossAt)), 'boss:spawn: boss arrival + the boss section on the next bar')
        switchAt(scope, seconds - BOSS_MIX.defeatBeforeEndS, 'sting', () => s.bossDefeat(placeAhead(BOSS_MIX.defeat.screenX, BOSS_MIX.defeat.ahead, bossAt)), 'boss:defeated: boss defeat + the sting on the next bar, then the loop')
      }
      const { at } = scope
      let kills = 0
      /** Render time the FRENZY slow-mo starts. */
      let frenzyAt = Infinity
      const mix: CombatMixTargets = { duck: (on) => setMusicDucked(on), frenzyLift: (on) => s.frenzyLift(on), intensity: (n) => p.setIntensity(n) }
      scrimScript(p, level, seconds)(scope)
      // LevelAudio's frames: the combo and the slow-mo drive the music by the game's own rule.
      for (let t = FRAME_S; t < seconds; t += FRAME_S) at(t, () => applyCombatMix(mix, kills, frenzyTimeScale(t - frenzyAt), true))
      void s.prepare(level, biome)
      for (let t = 0.2; t < seconds; t += 0.5) {
        // A share of top speed, around a level's median (CoasterCamera).
        const speed = 0.45 + 0.15 * Math.sin(t * 0.8)
        at(t, () => s.wind(speed))
      }
      events.push({ t: 1, name: 'autofire starts (held trigger)' })
      for (let t = 1; t < seconds - 0.5; t += AUTOFIRE_S) at(t, () => s.fire(true))
      const wave = 4
      events.push({ t: wave, name: 'wave tell' })
      at(wave, () => s.waveIncoming())
      // The 5× tier starts the slow-mo, which ducks the music.
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
          events.push({ t, name: `FRENZY (kill ${n}): slow-mo ducks the music for ${FRENZY.durationS} s` })
          at(t + 0.08, () => {
            s.frenzy()
            frenzyAt = t + 0.08
          })
        }
      }
      events.push({ t: 1.6, name: `kills every ${KILL_EVERY_S} s, combo climbing` })
      events.sort((a, b) => a.t - b.t)
    },
  }
}

/** The ride render's script (seconds): `speed` is the share of top speed `CoasterCamera` gives `wind`. */
const RIDE = { readyS: 0.5, goS: 2.5, liftS: 5, crestS: 9, dropS: 9.6, topS: 11.1, easeS: 12.6, seconds: 15, crawl: 0.2, cruise: 0.6 }

function rideSpeed(t: number): number {
  const r = RIDE
  if (t < r.goS) return 0
  if (t < r.dropS) return r.crawl
  if (t < r.topS) return r.crawl + ((1 - r.crawl) * (t - r.dropS)) / (r.topS - r.dropS)
  if (t < r.easeS) return 1
  return Math.max(r.cruise, 1 - ((1 - r.cruise) * (t - r.easeS)) / 1.5)
}

function ridePlan(level: string): Plan {
  const s = sfx
  const r = RIDE
  const events = [
    { t: r.readyS, name: 'countdown Ready' },
    { t: r.goS, name: 'countdown GO + launch whoosh: wind and rumble at the crawl' },
    { t: r.liftS, name: 'chain lift: clanking at the crawl' },
    { t: r.crestS, name: 'crest: chain off' },
    { t: r.dropS, name: 'drop: wind and rumble up to top speed' },
    { t: r.easeS, name: 'easing to a cruise' },
  ]
  return {
    seconds: r.seconds,
    events,
    seams: [],
    bar: null,
    script: ({ at }) => {
      void s.prepare(level, biomeOf(level))
      at(r.readyS, () => s.countdown(false))
      at(r.readyS + 1, () => s.countdown(false))
      at(r.goS, () => {
        s.countdown(true)
        s.rideLaunch()
      })
      // As CoasterCamera does, every 60 fps frame.
      for (let t = 0; t < r.seconds; t += 1 / 60) {
        at(t, () => {
          s.wind(rideSpeed(t))
          s.chain(t >= r.liftS && t < r.crestS ? 1 : 0)
        })
      }
    },
  }
}

const LAUNCH = { blipS: 0.3, landS: 0.42, readyS: 1.0, goS: 1.6, killS: 2.4, seconds: 3.4 }

/** Run after `prepare(null, …)` (the menus' bank) and `prebake(level)`, whose install `land` is. */
function launchPlan(level: string, land: () => void): Plan {
  const s = sfx
  const events = [
    { t: LAUNCH.blipS, name: 'ui launch (menus\' bank and room)' },
    { t: LAUNCH.landS, name: `${level}'s bank and room land: the menus' graph fades out` },
    { t: LAUNCH.readyS, name: 'countdown Ready' },
    { t: LAUNCH.goS, name: 'countdown GO' },
    { t: LAUNCH.killS, name: 'kill 1x' },
  ]
  return {
    seconds: LAUNCH.seconds,
    events,
    seams: [],
    bar: null,
    clicks: [LAUNCH.landS],
    script: ({ at }) => {
      at(LAUNCH.blipS, () => s.ui('launch'))
      at(LAUNCH.landS, land)
      at(LAUNCH.readyS, () => s.countdown(false))
      at(LAUNCH.goS, () => s.countdown(true))
      at(LAUNCH.killS, () => s.kill(1, 'pop', null))
    },
  }
}

const RESUME = { pauseS: 0.2, readyS: 0.5, goS: 1.6, seconds: 4 }

/** The countdown's timing is `Countdown.tsx`'s resume mode: Ready, GO 1.1 s later, `playing` at GO. */
function resumePlan(level: string, unpaused = false): Plan {
  const s = sfx
  const r = RESUME
  return {
    seconds: r.seconds,
    events: [
      ...(unpaused ? [] : [{ t: r.pauseS, name: 'paused' }]),
      { t: r.readyS, name: 'countdown Ready' },
      { t: r.goS, name: unpaused ? 'countdown GO' : 'countdown GO: the pause gate opens' },
    ],
    seams: [],
    bar: null,
    script: ({ at }) => {
      void s.prepare(level, biomeOf(level))
      if (!unpaused) at(r.pauseS, () => setPauseMix(true, true))
      at(r.readyS, () => s.countdown(false))
      at(r.goS, () => {
        s.countdown(true)
        setPauseMix(false)
      })
    },
  }
}

type GamePlanRequest = Exclude<AudioRenderRequest, { kind: 'score' | 'launch' }>

const RENDERS: { [K in GamePlanRequest['kind']]: (req: Extract<GamePlanRequest, { kind: K }>) => Plan } = {
  music: (r) => musicPlan(scrim, r.track, r.seconds, r.seam, r.layers),
  sfxSheet: (r) => sfxSheetPlan(r.level, r.kills),
  mix: (r) => mixPlan(r.level, r.seconds, r.stem === 'music', r.boss),
  ride: (r) => ridePlan(r.level),
  resume: (r) => resumePlan(r.level, r.unpaused),
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

function compileOrThrow(text: string): CompiledSong {
  const song = compile(text)
  if (song.errors.length) throw new Error(`score errors:\n${song.errors.map((e) => `line ${e.line}: ${e.msg}`).join('\n')}`)
  return song
}

/** The port on its own, seeded like the original page's render in `scripts/audio/render.mjs` (same PRNG, same call order). */
async function renderScore(req: Extract<AudioRenderRequest, { kind: 'score' }>, seed: number): Promise<AudioRenderResult> {
  const song = compileOrThrow(req.text)
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

/** The player plays the text like a game score for the length of one render. */
async function renderScoreInGame(req: Extract<AudioRenderRequest, { kind: 'score' }>, seed: number): Promise<AudioRenderResult> {
  const song = compileOrThrow(req.text)
  scrim = await import('@/audio/scrim/player')
  sfx = (await loadArcade()).arcadeSfx
  const id = 'render'
  scrim.registerSong(id, song)
  try {
    const plan = musicPlan(scrim, id, req.seconds ?? 20, req.seam)
    const buffer = await renderOffline({ seconds: plan.seconds, seed }, plan.script, stopAll)
    return { sampleRate: buffer.sampleRate, seconds: plan.seconds, pcm: toBase64(buffer), events: plan.events, seams: plan.seams, bar: plan.bar }
  } finally {
    scrim.unregisterSong(id)
  }
}

export async function renderAudio(req: AudioRenderRequest, seed = 1): Promise<AudioRenderResult> {
  if (req.kind === 'score') return req.chain === 'game' ? renderScoreInGame(req, seed) : renderScore(req, seed)
  scrim = await import('@/audio/scrim/player')
  const arcade = await loadArcade()
  sfx = arcade.arcadeSfx
  // The arcade bake is async, so it runs before the render.
  let plan: Plan
  if (req.kind === 'launch') {
    await sfx.prepare(null, 'themePark')
    plan = launchPlan(req.level, await arcade.prebake(req.level, biomeOf(req.level)))
  } else {
    if (req.kind !== 'music') await sfx.prepare(req.level ?? 'level1', biomeOf(req.level ?? 'level1'))
    plan = (RENDERS[req.kind] as (r: GamePlanRequest) => Plan)(req)
  }
  const buffer = await renderOffline({ seconds: plan.seconds, seed }, plan.script, stopAll)
  return {
    sampleRate: buffer.sampleRate, seconds: plan.seconds, pcm: toBase64(buffer), events: plan.events, seams: plan.seams, bar: plan.bar,
    clicks: plan.clicks,
  }
}
