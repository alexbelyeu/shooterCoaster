/**
 * The browser side of `core/staleBuild.ts` (#823, #888): a chunk that failed to load stays failed until the page
 * reloads, whether a deploy removed it or the network dropped it once. When one fails, fetch this page again (same
 * origin, uncached): if it still serves the game, reload on the title or level select, or as the player leaves results
 * (`reloadIfDue`), at most once per session.
 */
import { claimReload, entryScriptSrc, isReloadSafe, onChunkFailure } from '@/core/staleBuild'
import { useGameStore } from '@/store/useGameStore'

/** Between two checks: a failing network fails every import, and one fetch of the page answers for all of them. */
const CHECK_EVERY_MS = 30_000

let due = false
let checking = false
let lastCheck = -Infinity

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** The page answers with the game (an entry script): offline, an error page or a captive portal don't. */
async function servesGame(): Promise<boolean> {
  try {
    const res = await fetch(window.location.href.split('#')[0], { cache: 'no-store' })
    return res.ok && entryScriptSrc(await res.text()) !== null
  } catch {
    return false
  }
}

function check(): void {
  const now = performance.now()
  if (due || checking || now - lastCheck < CHECK_EVERY_MS) return
  checking = true
  lastCheck = now
  void servesGame().then((serves) => {
    checking = false
    due = serves
    if (due && isReloadSafe(useGameStore.getState().phase)) reloadIfDue()
  })
}

/** A chunk failed and a reload would load it: the page still serves the game. */
export const isReloadDue = (): boolean => due

/** Reloads the page if a reload is due and this session hasn't already reloaded for one; true when it does. */
export function reloadIfDue(): boolean {
  if (!due) return false
  // This session already reloaded once: drop the flag so results stops treating a reload as pending.
  if (!claimReload(sessionStore())) {
    due = false
    return false
  }
  window.location.reload()
  return true
}

export function installStaleReload(): void {
  onChunkFailure(check)
  // Vite's own signal for a dynamic import whose chunk or preloads failed.
  window.addEventListener('vite:preloadError', check)
  useGameStore.subscribe((next, prev) => {
    if (due && next.phase !== prev.phase && isReloadSafe(next.phase)) reloadIfDue()
  })
}
