/**
 * The ghost's storage key and its wipe (#844), apart from `ghost.ts` so the store's "Clear local data" doesn't pull
 * the ghost's codec and recording buffers in with it.
 */
export const GHOST_KEY = 'shootercoaster-ghost:'

/** Settings "Clear local data": every level's ghost goes with the scores. */
export function clearGhosts(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(GHOST_KEY)) localStorage.removeItem(k)
  } catch {
    // no storage, nothing to clear
  }
}
