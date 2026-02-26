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

/** Master volume channels */
export const sfxChannel = new Tone.Channel(-6, 0).toDestination()
export const musicChannel = new Tone.Channel(-10, 0).toDestination()

/** Update volumes from settings store */
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

