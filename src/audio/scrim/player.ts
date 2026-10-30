/*
 * The score engine in the game: plays `audio/scores/` on Tone's AudioContext into its own stereo
 * music channel (music volume, slow-mo duck and master limiter apply), one `musicBus` per track so a
 * change is the same 1 s crossfade as the Tone.js music. Loaded only under `?audio=scrim`
 * (`musicEngine.ts`).
 *
 * Built on Scrimshaw Jukebox's player (docs/audio/reference/scrimshaw-jukebox.html), simonw/tools
 * commit 5fc8e8b, Apache-2.0 (docs/audio/reference/LICENSE-scrimshaw-apache-2.0.txt). Modified:
 * the page player is replaced by game integration (crossfades, pause / resume mid-song, dispose).
 */

import * as Tone from 'tone'
import { isAudioReady, scoreChannel } from '../AudioEngine'
import { fadeOutMusicBus, openMusicBus, type MusicBus } from '../musicBus'
import { SCORES } from '../scores'
import { compile, type CompiledSong } from './score'
import { ScoreScheduler } from './scheduler'
import { createCore, createSynth, type Session, type Synth, type SynthCore } from './synth'

const TICK_MS = 25
/** First note this far after the call, past Tone's own look-ahead. */
export const SCORE_START_DELAY_S = 0.15
const PAUSE_FADE_S = 0.05

interface Track {
  id: string
  bus: MusicBus
  synth: Synth
  scheduler: ScoreScheduler
  session: Session | null
  /** Song time where a paused track stopped. */
  pausedAt: number | null
  stopWarm: () => void
}

const songs = new Map<string, CompiledSong>()
let core: SynthCore | null = null
/** Every connected track; the last one is current unless it is fading out. */
const live: Track[] = []
let current: Track | null = null
let timer: number | null = null
let manualClock = false

/** The game's raw context (standardized-audio-context's, which takes the same calls as the DOM one). */
const rawContext = () => Tone.getContext().rawContext as unknown as BaseAudioContext
/** Tone's clock: in an offline render it runs ahead of the raw context's. */
const now = () => Tone.getContext().currentTime

function songFor(id: string): CompiledSong {
  let song = songs.get(id)
  if (!song) {
    const text = SCORES[id]
    if (text === undefined) throw new Error(`no score "${id}"`)
    song = compile(text)
    songs.set(id, song)
  }
  return song
}

function coreFor(ctx: BaseAudioContext): SynthCore {
  if (core?.ctx !== ctx) core = createCore(ctx)
  return core
}

/** One tick of every playing track; allocates nothing. */
export function tickScores(): void {
  const t = now()
  const hidden = typeof document !== 'undefined' && document.hidden
  for (let i = 0; i < live.length; i++) if (live[i].session) live[i].scheduler.tick(t, hidden)
}

function ensureTimer() {
  if (timer === null && !manualClock) timer = window.setInterval(tickScores, TICK_MS)
}

function releaseTimer() {
  if (timer !== null && live.length === 0) {
    window.clearInterval(timer)
    timer = null
  }
}

function busName(id: string) {
  return id === 'title' || id === 'results' ? id : 'level'
}

function disposeTrack(track: Track) {
  track.stopWarm()
  track.synth.dispose()
  const i = live.indexOf(track)
  if (i >= 0) live.splice(i, 1)
  releaseTimer()
}

function fadeOut(track: Track) {
  if (current === track) current = null
  fadeOutMusicBus(track.bus, [{ dispose: () => disposeTrack(track) }])
}

/** Crossfades to score `id` from the top; nothing if it is already the current track or audio is still locked. */
export function playScore(id: string): void {
  if (current?.id === id || !isAudioReady()) return
  if (current) fadeOut(current)
  const song = songFor(id)
  const bus = openMusicBus(busName(id), scoreChannel)
  const synth = createSynth(coreFor(rawContext()), bus.gain.input as unknown as AudioNode, { voicing: 'game' })
  const track: Track = {
    id,
    bus,
    synth,
    session: synth.session(song),
    scheduler: new ScoreScheduler(song, (ev, t) => track.session?.play(ev, t)),
    pausedAt: null,
    stopWarm: synth.warm(song),
  }
  track.scheduler.start(now() + SCORE_START_DELAY_S)
  live.push(track)
  current = track
  ensureTimer()
  track.scheduler.tick(now())
}

/** Fades out the current track if it is one of `ids`. */
export function stopScore(...ids: string[]): void {
  if (current && ids.includes(current.id)) fadeOut(current)
}

/** Holds the current track where it is (a paused run, a hidden tab) and picks it up there again. */
export function pauseScore(paused: boolean): void {
  const track = current
  if (!track || paused === (track.pausedAt !== null)) return
  if (paused) {
    track.pausedAt = Math.max(0, track.scheduler.position(now()))
    track.session?.stop(PAUSE_FADE_S)
    track.session = null
  } else {
    track.session = track.synth.session(track.scheduler.song)
    track.scheduler.start(now() + SCORE_START_DELAY_S, track.pausedAt ?? 0)
    track.pausedAt = null
    track.scheduler.tick(now())
  }
}

/** `audioRender.ts`: tick from the offline render's own clock instead of a timer. */
export function driveScoresManually(on: boolean): void {
  manualClock = on
  if (on && timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

/** Fades out every track (offline render cleanup). */
export function disposeScores(): void {
  for (const t of live) if (!t.bus.fading) fadeOut(t)
}

/** Loop seams (song time) of score `id` before `until`, and its first bar length. */
export function scoreTiming(id: string, until: number): { seams: number[]; barS: number; introS: number } {
  const song = songFor(id)
  const seams: number[] = []
  if (song.loop.dur > 0) for (let t = song.intro.dur + song.loop.dur; t < until; t += song.loop.dur) seams.push(t)
  const section = song.loop.sections[0] ?? song.intro.sections[0]
  return { seams, barS: section.barDur, introS: song.intro.dur }
}

/** e2e: the tracks (current last), whether each is paused, its song position, and the long-lived nodes. */
export function scrimState() {
  const t = now()
  return {
    current: current?.id ?? null,
    tracks: live.map((tr) => ({ id: tr.id, paused: tr.pausedAt !== null, position: tr.pausedAt ?? tr.scheduler.position(t) })),
    nodes: live.reduce((n, tr) => n + tr.synth.nodeCount(), 0),
    ticking: timer !== null,
  }
}
