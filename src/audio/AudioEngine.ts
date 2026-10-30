import * as Tone from 'tone'
import { useSettingsStore } from '@/store/useSettingsStore'

let initialized = false

/**
 * Master audio engine wrapping Tone.js.
 * Must be initialized on user gesture (click/tap).
 */
export async function initAudio(): Promise<void> {
  if (initialized) return
  await Tone.start()
  initialized = true
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
  limiter: Tone.Limiter
  duck: Tone.Filter
  musicPause: Tone.Gain
  sfxPause: Tone.Gain
  sfx: Tone.Channel
  music: Tone.Channel
}

/** Built in Tone's current context: the live one at import, an offline one while `offlineRender.ts` renders. */
function createMasterChain(): MasterChain {
  const limiter = new Tone.Limiter(-1).toDestination()
  const musicPause = new Tone.Gain(1).connect(limiter)
  const sfxPause = new Tone.Gain(1).connect(limiter)
  const duck = new Tone.Filter({ type: 'lowpass', frequency: DUCK_OPEN_HZ, rolloff: -12 }).connect(musicPause)
  const sfx = new Tone.Channel(-6, 0).connect(sfxPause)
  const music = new Tone.Channel(-10, 0).connect(duck)
  return { limiter, duck, musicPause, sfxPause, sfx, music }
}

let chain = createMasterChain()
let ducked = false
let pauseMix = false

// Live bindings: an offline render swaps them for the length of the render.
export let sfxChannel = chain.sfx
export let musicChannel = chain.music

function setChain(c: MasterChain) {
  chain = c
  sfxChannel = c.sfx
  musicChannel = c.music
}

/** `offlineRender.ts`: a fresh chain in the (offline) current context, audio marked ready; returns the restore. */
export function swapInOfflineChain(): () => void {
  const live = { chain, initialized, ducked, pauseMix }
  const offline = createMasterChain()
  setChain(offline)
  initialized = true
  ducked = false
  pauseMix = false
  syncVolumes(true)
  return () => {
    setChain(live.chain)
    initialized = live.initialized
    ducked = live.ducked
    pauseMix = live.pauseMix
    for (const node of [offline.sfx, offline.music, offline.duck, offline.musicPause, offline.sfxPause, offline.limiter]) node.dispose()
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

const VOLUME_RAMP_S = 0.08

/** Settings volume + mute onto the channels: a short ramp, never a cut (a click); `immediate` for a fresh chain. */
function syncVolumes(immediate = false): void {
  const { sfxVolume, musicVolume, muted } = useSettingsStore.getState()
  const levels = [
    [sfxChannel, muted ? -Infinity : Tone.gainToDb(sfxVolume)],
    [musicChannel, muted ? -Infinity : Tone.gainToDb(musicVolume)],
  ] as const
  const now = Tone.now()
  for (const [channel, db] of levels) {
    channel.volume.cancelScheduledValues(now)
    if (immediate) channel.volume.setValueAtTime(db, now)
    else channel.volume.rampTo(db, VOLUME_RAMP_S, now)
  }
}

// Sliders and the mute button apply live, in game or on the title.
syncVolumes(true)
useSettingsStore.subscribe((s, prev) => {
  if (s.musicVolume !== prev.musicVolume || s.sfxVolume !== prev.sfxVolume || s.muted !== prev.muted) syncVolumes()
})
