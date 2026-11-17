/*
 * Plays `audio/scores/` in the game: one `musicBus` per score into the stereo `scoreChannel`, so a change is a
 * 1 s crossfade. Built on Scrimshaw Jukebox's player (docs/audio/reference/scrimshaw-jukebox.html),
 * simonw/tools commit 5fc8e8b, Apache-2.0 (docs/audio/reference/LICENSE-scrimshaw-apache-2.0.txt); modified: game
 * integration (crossfades, pause / resume mid-song, intensity layers, boss sections, dispose) replaces the page's player.
 */

import { audioContext, audioNow as now, isAudioReady } from '../AudioEngine'
import { fadeOutMusicBus, openMusicBus, type MusicBus } from '../musicBus'
import { SCORES, scoreIdFor } from '../scores'
import { compile, type CompiledSong } from './score'
import { MAX_INTENSITY, layerState, nextLayerStep, recordLayerStep, resumeLayers, type LayerGrid, type LayerState } from './layers'
import { LOOK_AHEAD_S, ScoreScheduler } from './scheduler'
import { barLineAtOrAfter, sectionSong, type ScoreSection } from './sections'
import { createCore, createSynth, type Session, type Synth, type SynthCore } from './synth'

const TICK_MS = 25
/** First note this far after the call. */
export const SCORE_START_DELAY_S = 0.15
const PAUSE_FADE_S = 0.05
/** A section switch lands on the first bar line past the scheduler's look-ahead, so nothing of the old section is already scheduled beyond it. */
const SWITCH_LEAD_S = LOOK_AHEAD_S + 2 * (TICK_MS / 1000)

/** A section switch waiting for its bar line: `scheduler` plays the new section from audio time `at`. */
interface PendingSection {
  section: ScoreSection
  scheduler: ScoreScheduler
  at: number
  /** Asked for while this one was waiting: switched to once it lands. */
  then: ScoreSection | null
}

interface Track {
  id: string
  bus: MusicBus
  synth: Synth
  scheduler: ScoreScheduler
  session: Session | null
  /** Song time where a paused track stopped. */
  pausedAt: number | null
  stopWarm: () => void
  /** Null for a score without layers. */
  layers: LayerGrid | null
  layerState: LayerState
  section: ScoreSection
  next: PendingSection | null
}

const songs = new Map<string, CompiledSong>()
let core: SynthCore | null = null
/** Every connected track; the last one is current unless it is fading out. */
const live: Track[] = []
let current: Track | null = null
let timer: number | null = null
let manualClock = false
/** The game's last `setIntensity`. */
let targetIntensity = 0

function songFor(id: string): CompiledSong {
  let song = songs.get(id)
  if (!song) {
    const text = SCORES[scoreIdFor(id)]
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

export function tickScores(): void {
  const t = now()
  const hidden = typeof document !== 'undefined' && document.hidden
  for (let i = 0; i < live.length; i++) {
    const track = live[i]
    if (!track.session) continue
    if (track.next && t >= track.next.at) landSection(track)
    track.scheduler.tick(t, hidden)
    track.next?.scheduler.tick(t, hidden)
  }
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

function layerGrid(song: CompiledSong): LayerGrid | null {
  const section = song.loop.sections[0] ?? song.intro.sections[0]
  if (!section || !song.voices.some((v) => v.layer)) return null
  return { introS: song.intro.dur, beatS: section.barDur / section.beats, barS: section.barDur }
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

function fadeOut(track: Track, untilNextTrack = false) {
  if (current === track) current = null
  fadeOutMusicBus(track.bus, [{ dispose: () => disposeTrack(track) }], untilNextTrack)
}

/** Crossfades to score `id` from song time `from` (the top); nothing if it is already the current track or audio is still locked. */
export function playScore(id: string, from = 0): void {
  if (current?.id === id || !isAudioReady()) return
  if (current) fadeOut(current)
  const song = songFor(id)
  const start = now() + SCORE_START_DELAY_S
  const bus = openMusicBus(busName(id), start)
  const synth = createSynth(coreFor(audioContext()), bus.gain, { voicing: 'game' })
  // The intro plays every layer; the loop opens on the game's intensity.
  const intensity = from < song.intro.dur ? MAX_INTENSITY : targetIntensity
  const track: Track = {
    id,
    bus,
    synth,
    session: synth.session(song, intensity),
    scheduler: new ScoreScheduler(song, (ev, t) => track.session?.play(ev, t)),
    pausedAt: null,
    stopWarm: synth.warm(song),
    layers: layerGrid(song),
    layerState: layerState(intensity),
    section: 'main',
    next: null,
  }
  track.scheduler.start(start, from)
  live.push(track)
  current = track
  ensureTimer()
  track.scheduler.tick(now())
}

/** Fades out the current track if it is one of `ids`. */
export function stopScore(...ids: string[]): void {
  if (current && ids.includes(current.id)) fadeOut(current)
}

/** Keeps the current track, if it is one of `ids`, playing until the next score opens, then fades it under that one (`fadeOutMusicBus`). */
export function handOverScore(...ids: string[]): void {
  if (current && ids.includes(current.id)) fadeOut(current, true)
}

/** The new section's scheduler takes over; the sting opens on every layer, like the intro, and the loop after it on the game's. */
function landSection(track: Track): void {
  const next = track.next
  if (!next) return
  track.next = null
  track.scheduler = next.scheduler
  track.section = next.section
  track.layers = layerGrid(next.scheduler.song)
  track.layerState = layerState(next.section === 'sting' ? MAX_INTENSITY : track.layerState.intensity)
  if (next.then) playSection(track.id, next.then)
}

/**
 * Moves the current track, if it is score `id`, to `section` of its score (`sections.ts`) on its next bar line: `boss`
 * on the boss's arrival, `sting` on its defeat (then the loop again), `main` back to the loop (a restart). A paused track
 * switches in place and resumes at the section's top. Nothing for a score without a boss section.
 */
export function playSection(id: string, section: ScoreSection): void {
  const track = current
  if (!track || track.id !== id) return
  if (track.next) {
    track.next.then = track.next.section === section ? null : section
    return
  }
  if (track.section === section) return
  const song = sectionSong(songFor(id), section)
  if (!song) return
  const scheduler = new ScoreScheduler(song, (ev, t) => track.session?.play(ev, t))
  if (!track.session) {
    track.next = { section, scheduler, at: 0, then: null }
    landSection(track)
    track.pausedAt = 0
    return
  }
  const t = now()
  const pos = track.scheduler.position(t)
  const at = t + barLineAtOrAfter(track.scheduler.song, pos + SWITCH_LEAD_S) - pos
  track.scheduler.endAt(at)
  scheduler.start(at)
  track.next = { section, scheduler, at, then: null }
  if (section === 'sting') track.session.setIntensity(MAX_INTENSITY, at)
}

/** Holds the current track where it is (a paused run, a hidden tab) and picks it up there again. */
export function pauseScore(paused: boolean): void {
  const track = current
  if (!track || paused === (track.pausedAt !== null)) return
  if (paused) {
    // A switch still waiting for its bar line: the new section resumes from its top.
    if (track.next) {
      track.session?.stop(PAUSE_FADE_S)
      track.session = null
      landSection(track)
      track.pausedAt = 0
      return
    }
    track.pausedAt = Math.max(0, track.scheduler.position(now()))
    track.session?.stop(PAUSE_FADE_S)
    track.session = null
  } else {
    const from = track.pausedAt ?? 0
    const start = now() + SCORE_START_DELAY_S
    const { open, pending } = resumeLayers(track.layerState, from)
    track.session = track.synth.session(track.scheduler.song, open)
    if (pending) track.session.setIntensity(pending.intensity, start + pending.at - from)
    track.scheduler.start(start, from)
    track.pausedAt = null
    track.scheduler.tick(now())
  }
}

/** Intensity 0–3 (`layers.ts`), from `LevelAudio` every frame; a paused track holds its layers and catches up on resume. */
export function setIntensity(intensity: number): void {
  targetIntensity = intensity
  const track = current
  // A section switch holds the layers until it lands (the new section counts its beat lines from its own top).
  if (!track?.layers || !track.session || track.pausedAt !== null || track.next) return
  const t = now()
  const pos = track.scheduler.position(t)
  const s = track.layerState
  const step = nextLayerStep(s.intensity, s.at, intensity, pos, track.layers)
  if (!step) return
  recordLayerStep(s, step, pos)
  track.session.setIntensity(step.intensity, t + step.at - pos)
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

export interface MusicGrid {
  /** Audio time of the current score's song time 0. */
  origin: number
  beatS: number
  beats: number
}

const grid: MusicGrid = { origin: 0, beatS: 0, beats: 4 }

/** Null while paused, fading or silent; one shared object. */
export function musicGrid(): MusicGrid | null {
  const track = current
  if (!track || track.pausedAt !== null || track.bus.fading) return null
  const section = track.scheduler.song.loop.sections[0] ?? track.scheduler.song.intro.sections[0]
  if (!section) return null
  const t = now()
  grid.origin = t - track.scheduler.position(t)
  grid.beats = section.beats
  grid.beatS = section.barDur / section.beats
  return grid
}

/** e2e: the tracks (current last) with the score each plays (`scoreIdFor`), whether it is paused, its song position, layer intensity and section (and where a pending switch lands), and the long-lived nodes. */
export function scrimState() {
  const t = now()
  return {
    current: current?.id ?? null,
    tracks: live.map((tr) => ({
      id: tr.id,
      score: scoreIdFor(tr.id),
      paused: tr.pausedAt !== null,
      position: tr.pausedAt ?? tr.scheduler.position(t),
      layered: tr.layers !== null,
      intensity: tr.layerState.intensity,
      section: tr.section,
      // Audio time a pending section switch lands at.
      switchAt: tr.next?.at ?? null,
    })),
    targetIntensity,
    nodes: live.reduce((n, tr) => n + tr.synth.nodeCount(), 0),
    ticking: timer !== null,
  }
}
