import { dropSound } from './soundGuard'

/**
 * Which engine plays the music: the Tone.js managers (default) or the Scrimshaw score engine
 * (`?audio=scrim`, `audio/scrim/`) while it runs in parallel until parity (hard rule 7).
 * SFX stay on Tone.js either way.
 */
export type MusicEngine = 'tone' | 'scrim'

export function engineFromQuery(search: string): MusicEngine {
  return new URLSearchParams(search).get('audio') === 'scrim' ? 'scrim' : 'tone'
}

export const MUSIC_ENGINE: MusicEngine = typeof location === 'undefined' ? 'tone' : engineFromQuery(location.search)

type ScrimPlayer = typeof import('./scrim/player')
let player: Promise<ScrimPlayer> | null = null
let loaded: ScrimPlayer | null = null

/** Runs `fn` with the score player, loaded on first use so default players never download it; calls run in order. */
export function withScrim(fn: (p: ScrimPlayer) => void): void {
  player ??= import('./scrim/player').then((p) => (loaded = p))
  player.then(fn).catch((e) => dropSound('score engine', e))
}

/** The score player once something has loaded it (e2e reads its state synchronously). */
export function scrimPlayer(): ScrimPlayer | null {
  return loaded
}
