import { dropSound } from './soundGuard'

/** The Tone.js music managers (default), or the score engine (`?audio=scrim`, `audio/scrim/`) until it reaches parity. */
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
