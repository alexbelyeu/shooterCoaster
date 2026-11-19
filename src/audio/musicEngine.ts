import { dropSound } from './soundGuard'

type ScrimPlayer = typeof import('./scrim/player')
let player: Promise<ScrimPlayer> | null = null
let loaded: ScrimPlayer | null = null

/**
 * Runs `fn` with the score player (`scrim/player.ts`), a lazy chunk loaded on first use (after the first gesture); calls
 * run in order. Settles once `fn` has run, or the chunk failed (the loading screen waits on it, #674).
 */
export function withScrim(fn: (p: ScrimPlayer) => void): Promise<void> {
  player ??= import('./scrim/player').then((p) => (loaded = p))
  return player.then(fn).catch((e) => dropSound('score engine', e))
}

/** The score player once something has loaded it (e2e reads its state synchronously). */
export function scrimPlayer(): ScrimPlayer | null {
  return loaded
}
