import * as Tone from 'tone'
import { useSettingsStore } from '@/store/useSettingsStore'
import { MUSIC_ENGINE, type MusicEngine } from './musicEngine'

let initialized = false

/**
 * Master audio engine wrapping Tone.js.
 * Must be initialized on user gesture (click/tap).
 */
export async function initAudio(): Promise<void> {
  if (initialized) return
  await Tone.start()
  initialized = true
  syncVolumes()
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
  const hard = engine === 'scrim'
  const trim = hard ? new Tone.Gain(Tone.dbToGain(-HARD_LIMITER_MAKEUP_DB)).toDestination() : null
  const limiter = hard ? new Tone.Compressor(HARD_LIMITER).connect(trim!) : new Tone.Limiter(-1).toDestination()
  const musicPause = new Tone.Gain(1).connect(limiter)
  const sfxPause = new Tone.Gain(1).connect(limiter)
  const duck = new Tone.Filter({ type: 'lowpass', frequency: DUCK_OPEN_HZ, rolloff: -12 }).connect(musicPause)
  const sfx = new Tone.Channel(-6, 0).connect(sfxPause)
  const music = new Tone.Channel(-10, 0).connect(duck)
  const score = new Tone.Channel({ volume: -10, channelCount: 2 }).connect(duck)
  const arcade = new Tone.Channel({ volume: -6, channelCount: 2 }).connect(sfxPause)
  return { limiter, trim, duck, musicPause, sfxPause, sfx, music, score, arcade }
}

let chain = createMasterChain()
let ducked = false
let pauseMix = false

// Live bindings: an offline render swaps them for the length of the render.
export let sfxChannel = chain.sfx
export let musicChannel = chain.music
export let scoreChannel = chain.score
export let arcadeChannel = chain.arcade

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
  syncVolumes()
  return () => {
    setChain(live.chain)
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
  const hz = on ? DUCK_CLOSED_HZ : DUCK_OPEN_HZ
  if (immediate) {
    const now = Tone.now()
    chain.duck.frequency.cancelScheduledValues(now)
    chain.duck.frequency.setValueAtTime(hz, now)
  } else chain.duck.frequency.rampTo(hz, DUCK_RAMP_S)
}

export function isMusicDucked(): boolean {
  return ducked
}

/** While paused: music down `PAUSE_MUSIC_DB`, SFX silent. */
export function setPauseMix(on: boolean, immediate = false): void {
  if (on === pauseMix) return
  pauseMix = on
  const music = on ? Tone.dbToGain(PAUSE_MUSIC_DB) : 1
  const sfx = on ? 0 : 1
  if (immediate) {
    const now = Tone.now()
    for (const [node, value] of [[chain.musicPause, music], [chain.sfxPause, sfx]] as const) {
      node.gain.cancelScheduledValues(now)
      node.gain.setValueAtTime(value, now)
    }
  } else {
    chain.musicPause.gain.rampTo(music, PAUSE_RAMP_S)
    chain.sfxPause.gain.rampTo(sfx, PAUSE_RAMP_S)
  }
}

export function isPauseMixOn(): boolean {
  return pauseMix
}

export function syncVolumes(): void {
  const { sfxVolume, musicVolume, muted } = useSettingsStore.getState()
  const music = muted ? -Infinity : Tone.gainToDb(musicVolume)
  const sfx = muted ? -Infinity : Tone.gainToDb(sfxVolume)
  sfxChannel.volume.value = sfx
  arcadeChannel.volume.value = sfx
  musicChannel.volume.value = music
  scoreChannel.volume.value = music
}
