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

// sfxChannel and musicChannel → musicDuck both end in the limiter, so stacked kill layers can't clip.
const masterLimiter = new Tone.Limiter(-1).toDestination()

const DUCK_OPEN_HZ = 20000
const DUCK_CLOSED_HZ = 800
const DUCK_RAMP_S = 0.25

const musicDuck = new Tone.Filter({ type: 'lowpass', frequency: DUCK_OPEN_HZ, rolloff: -12 }).connect(masterLimiter)
let ducked = false

export const sfxChannel = new Tone.Channel(-6, 0).connect(masterLimiter)
export const musicChannel = new Tone.Channel(-10, 0).connect(musicDuck)

/** Slow-mo "underwater" low-pass on the music bus. */
export function setMusicDucked(on: boolean, immediate = false): void {
  if (on === ducked) return
  ducked = on
  const hz = on ? DUCK_CLOSED_HZ : DUCK_OPEN_HZ
  if (immediate) {
    const now = Tone.now()
    musicDuck.frequency.cancelScheduledValues(now)
    musicDuck.frequency.setValueAtTime(hz, now)
  } else musicDuck.frequency.rampTo(hz, DUCK_RAMP_S)
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
