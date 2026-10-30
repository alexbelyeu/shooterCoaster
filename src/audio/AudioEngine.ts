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
}

/** Built in Tone's current context: the live one at import, an offline one while `offlineRender.ts` renders. */
function createMasterChain(): MasterChain {
  const limiter = new Tone.Limiter(-1).toDestination()
  const duck = new Tone.Filter({ type: 'lowpass', frequency: DUCK_OPEN_HZ, rolloff: -12 }).connect(limiter)
  const sfx = new Tone.Channel(-6, 0).connect(limiter)
  const music = new Tone.Channel(-10, 0).connect(duck)
  return { limiter, duck, sfx, music }
}

let chain = createMasterChain()
let ducked = false

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
    for (const node of [offline.sfx, offline.music, offline.duck, offline.limiter]) node.dispose()
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
  if (muted) {
    sfxChannel.volume.value = -Infinity
    musicChannel.volume.value = -Infinity
  } else {
    sfxChannel.volume.value = Tone.gainToDb(sfxVolume)
    musicChannel.volume.value = Tone.gainToDb(musicVolume)
  }
}
