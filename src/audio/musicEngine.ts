import { lazyChunk } from '@/core/staleBuild'
import { dropSound } from './soundGuard'

type ScrimPlayer = typeof import('./scrim/player')
const importPlayer = lazyChunk(() => import('./scrim/player').then((p) => (loaded = p)))
let loaded: ScrimPlayer | null = null

/**
 * Runs `fn` with the score player (`scrim/player.ts`), a lazy chunk loaded on first use (after the first gesture); calls
 * run in order. Settles once `fn` has run, or the chunk failed (the loading screen waits on it, #674); a failed load is
 * tried again by the next call (#823).
 */
export function withScrim(fn: (p: ScrimPlayer) => void): Promise<void> {
  return importPlayer().then(fn).catch((e) => dropSound('score engine', e))
}

/** The score player once something has loaded it (e2e reads its state synchronously). */
export function scrimPlayer(): ScrimPlayer | null {
  return loaded
}
