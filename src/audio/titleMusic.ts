import { isAudioReady } from './AudioEngine'
import { scrimPlayer, withScrim } from './musicEngine'
import type { MusicGrid } from './scrim/player'

let playing = false

/** The title score (`scores/title.scrim`) on the title and level select. */
export function startTitleMusic(): void {
  if (playing || !isAudioReady()) return
  playing = true
  withScrim((p) => p.playScore('title'))
}

/** `untilNextTrack`: keep the music playing until the next track opens and crossfade under it (entering a run). */
export function stopTitleMusic(untilNextTrack = false): void {
  if (!playing) return
  playing = false
  withScrim((p) => (untilNextTrack ? p.handOverScore('title') : p.stopScore('title')))
}

/** The title music's beat grid on the audio clock (`audioNow`), for the title's cuts and logo hits (#419); null without music. */
export function titleBeatGrid(): MusicGrid | null {
  if (!playing || !isAudioReady()) return null
  return scrimPlayer()?.musicGrid() ?? null
}
