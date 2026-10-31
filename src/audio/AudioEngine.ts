import type * as Tone from 'tone'
import { useSettingsStore } from '@/store/useSettingsStore'
import { MUSIC_ENGINE, type MusicEngine } from './musicEngine'
import { loadTone, tone, unlockAudioContext } from './tone'

let initialized = false
let starting: Promise<void> | null = null

/** Call it from a user gesture (click / tap / key): it unlocks audio there, then loads Tone and builds the master chain. */
export function initAudio(): Promise<void> {
  starting ??= loadTone()
    .then(async (T) => {
      await T.start()
      setChain(createMasterChain())
      initialized = true
      applyMix()
      syncVolumes(true)
      // iOS Safari interrupts the context when the tab or portal frame is hidden and resumes it only from a touchend / click.
      window.addEventListener('touchend', unlockAudioContext, { capture: true, passive: true })
      window.addEventListener('click', unlockAudioContext, { capture: true })
    })
    .catch((e: unknown) => {
      starting = null
      throw e
    })
  return starting
}

export function isAudioReady(): boolean {
  return initialized
}

const DUCK_OPEN_HZ = 20000
const DUCK_CLOSED_HZ = 800
const DUCK_RAMP_S = 0.25
const PAUSE_MUSIC_DB = -12
const PAUSE_RAMP_S = 0.2

// sfx → pause gate and music → duck → pause gain both end in the limiter, so stacked kill layers can't clip.
interface MasterChain {
  limiter: Tone.Limiter | Tone.Compressor
  /** Takes back the hard limiter's make-up gain. */
  trim: Tone.Gain | null
  duck: Tone.Filter
  musicPause: Tone.Gain
  sfxPause: Tone.Gain
  sfx: Tone.Channel
  music: Tone.Channel
  /** The score engine's music (`?audio=scrim`): stereo, where Tone's channels fold to mono. Silent otherwise. */
  score: Tone.Channel
  /** The arcade SFX (`?audio=scrim`, `arcade/`): stereo, for positional pan. Silent otherwise. */
  arcade: Tone.Channel
}

/** Under `?audio=scrim`: a hard knee, so loud SFX stay under −1 dBTP (Tone's Limiter has a 30 dB soft knee; decision 2026-10-31-217). */
const HARD_LIMITER = { threshold: -3, ratio: 20, knee: 0, attack: 0.001, release: 0.08 }
/** DynamicsCompressor's built-in make-up gain: 0.6 × the gain it takes off a full-scale signal (Web Audio spec). */
const HARD_LIMITER_MAKEUP_DB = -0.6 * HARD_LIMITER.threshold * (1 - 1 / HARD_LIMITER.ratio)

/** Built in Tone's current context: the live one at import, an offline one while `offlineRender.ts` renders. */
function createMasterChain(engine: MusicEngine = MUSIC_ENGINE): MasterChain {
  const { Channel, Compressor, Filter, Gain, Limiter, dbToGain } = tone()
  const hard = engine === 'scrim'
  const trim = hard ? new Gain(dbToGain(-HARD_LIMITER_MAKEUP_DB)).toDestination() : null
  const limiter = hard ? new Compressor(HARD_LIMITER).connect(trim!) : new Limiter(-1).toDestination()
  const musicPause = new Gain(1).connect(limiter)
  const sfxPause = new Gain(1).connect(limiter)
  const duck = new Filter({ type: 'lowpass', frequency: DUCK_OPEN_HZ, rolloff: -12 }).connect(musicPause)
  const sfx = new Channel(-6, 0).connect(sfxPause)
  const music = new Channel(-10, 0).connect(duck)
  const score = new Channel({ volume: -10, channelCount: 2 }).connect(duck)
  const arcade = new Channel({ volume: -6, channelCount: 2 }).connect(sfxPause)
  return { limiter, trim, duck, musicPause, sfxPause, sfx, music, score, arcade }
}

/** Built by `initAudio`: read the channels only while `isAudioReady()`. */
let chain: MasterChain | null = null
let ducked = false
let pauseMix = false

// Live bindings: an offline render swaps them for the length of the render.
export let sfxChannel: Tone.Channel
export let musicChannel: Tone.Channel
export let scoreChannel: Tone.Channel
export let arcadeChannel: Tone.Channel

function setChain(c: MasterChain) {
  chain = c
  sfxChannel = c.sfx
  musicChannel = c.music
  scoreChannel = c.score
  arcadeChannel = c.arcade
}

/** `offlineRender.ts`: a fresh chain for `engine` in the (offline) current context, audio marked ready; returns the restore. */
export function swapInOfflineChain(engine: MusicEngine): () => void {
  const live = { chain, initialized, ducked, pauseMix }
  const offline = createMasterChain(engine)
  setChain(offline)
  initialized = true
  ducked = false
  pauseMix = false
  syncVolumes(true)
  return () => {
    // Rendered before the first gesture: the channels stay on the disposed chain, unread until `initAudio`.
    if (live.chain) setChain(live.chain)
    else chain = null
    initialized = live.initialized
    ducked = live.ducked
    pauseMix = live.pauseMix
    for (const node of [offline.sfx, offline.arcade, offline.music, offline.score, offline.duck, offline.musicPause, offline.sfxPause, offline.limiter]) node.dispose()
    offline.trim?.dispose()
  }
}

/** Slow-mo "underwater" low-pass on the music bus. */
export function setMusicDucked(on: boolean, immediate = false): void {
  if (on === ducked) return
  ducked = on
  if (chain) applyDuck(chain, immediate)
}

function applyDuck(c: MasterChain, immediate: boolean) {
  const hz = ducked ? DUCK_CLOSED_HZ : DUCK_OPEN_HZ
  if (immediate) {
    const now = tone().now()
    c.duck.frequency.cancelScheduledValues(now)
    c.duck.frequency.setValueAtTime(hz, now)
  } else c.duck.frequency.rampTo(hz, DUCK_RAMP_S)
}

export function isMusicDucked(): boolean {
  return ducked
}

/** While paused: music down `PAUSE_MUSIC_DB`, SFX silent. */
export function setPauseMix(on: boolean, immediate = false): void {
  if (on === pauseMix) return
  pauseMix = on
  if (chain) applyPauseMix(chain, immediate)
}

function applyPauseMix(c: MasterChain, immediate: boolean) {
  const music = pauseMix ? tone().dbToGain(PAUSE_MUSIC_DB) : 1
  const sfx = pauseMix ? 0 : 1
  if (immediate) {
    const now = tone().now()
    for (const [node, value] of [[c.musicPause, music], [c.sfxPause, sfx]] as const) {
      node.gain.cancelScheduledValues(now)
      node.gain.setValueAtTime(value, now)
    }
  } else {
    c.musicPause.gain.rampTo(music, PAUSE_RAMP_S)
    c.sfxPause.gain.rampTo(sfx, PAUSE_RAMP_S)
  }
}

/** A run can be paused or in slow-mo before the first gesture: the new chain starts in that mix. */
function applyMix() {
  if (!chain) return
  applyDuck(chain, true)
  applyPauseMix(chain, true)
}

export function isPauseMixOn(): boolean {
  return pauseMix
}

const VOLUME_RAMP_S = 0.08

/** Settings volume + mute onto the channels: a short ramp, never a cut (a click); `immediate` for a fresh chain. */
function syncVolumes(immediate = false): void {
  if (!chain) return
  const { gainToDb, now: toneNow } = tone()
  const { sfxVolume, musicVolume, muted } = useSettingsStore.getState()
  const music = muted ? -Infinity : gainToDb(musicVolume)
  const sfx = muted ? -Infinity : gainToDb(sfxVolume)
  const levels = [
    [sfxChannel, sfx],
    [arcadeChannel, sfx],
    [musicChannel, music],
    [scoreChannel, music],
  ] as const
  const now = toneNow()
  for (const [channel, db] of levels) {
    if (immediate) {
      channel.volume.cancelScheduledValues(now)
      channel.volume.setValueAtTime(db, now)
    } else channel.volume.rampTo(db, VOLUME_RAMP_S, now)
  }
}

// Sliders and the mute button apply live, in game or on the title.
useSettingsStore.subscribe((s, prev) => {
  if (s.musicVolume !== prev.musicVolume || s.sfxVolume !== prev.sfxVolume || s.muted !== prev.muted) syncVolumes()
})
