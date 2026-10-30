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
  syncVolumes()
}

export function isAudioReady(): boolean {
  return initialized
}

const DUCK_OPEN_HZ = 20000
const DUCK_CLOSED_HZ = 800
const DUCK_RAMP_S = 0.25

// sfx and music → duck both end in the limiter, so stacked kill layers can't clip.
interface MasterChain {
  limiter: Tone.Limiter
  duck: Tone.Filter
  sfx: Tone.Channel
  music: Tone.Channel
  /** The score engine's music (`?audio=scrim`): stereo, where Tone's channels fold to mono. Silent otherwise. */
  score: Tone.Channel
}

/** Built in Tone's current context: the live one at import, an offline one while `offlineRender.ts` renders. */
function createMasterChain(): MasterChain {
  const limiter = new Tone.Limiter(-1).toDestination()
  const duck = new Tone.Filter({ type: 'lowpass', frequency: DUCK_OPEN_HZ, rolloff: -12 }).connect(limiter)
  const sfx = new Tone.Channel(-6, 0).connect(limiter)
  const music = new Tone.Channel(-10, 0).connect(duck)
  const score = new Tone.Channel({ volume: -10, channelCount: 2 }).connect(duck)
  return { limiter, duck, sfx, music, score }
}

let chain = createMasterChain()
let ducked = false

// Live bindings: an offline render swaps them for the length of the render.
export let sfxChannel = chain.sfx
export let musicChannel = chain.music
export let scoreChannel = chain.score

function setChain(c: MasterChain) {
  chain = c
  sfxChannel = c.sfx
  musicChannel = c.music
  scoreChannel = c.score
}

/** `offlineRender.ts`: a fresh chain in the (offline) current context, audio marked ready; returns the restore. */
export function swapInOfflineChain(): () => void {
  const live = { chain, initialized, ducked }
  const offline = createMasterChain()
  setChain(offline)
  initialized = true
  ducked = false
  syncVolumes()
  return () => {
    setChain(live.chain)
    initialized = live.initialized
    ducked = live.ducked
    for (const node of [offline.sfx, offline.music, offline.score, offline.duck, offline.limiter]) node.dispose()
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

export function syncVolumes(): void {
  const { sfxVolume, musicVolume, muted } = useSettingsStore.getState()
  const music = muted ? -Infinity : Tone.gainToDb(musicVolume)
  sfxChannel.volume.value = muted ? -Infinity : Tone.gainToDb(sfxVolume)
  musicChannel.volume.value = music
  scoreChannel.volume.value = music
}
