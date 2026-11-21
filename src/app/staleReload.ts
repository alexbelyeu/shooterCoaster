/**
 * The browser side of `core/staleBuild.ts` (#823): when a chunk import fails, fetch this page again (same origin,
 * uncached) and compare its entry script with the running one. A new build is live: reload on the title or level
 * select, or as the player leaves results (`reloadForNewBuild`), at most once per session.
 */
import { claimReload, entryScriptSrc, isNewBuild, isReloadSafe, onChunkFailure } from '@/core/staleBuild'
import { useGameStore } from '@/store/useGameStore'

/** Between two checks: a failing network fails every import, and one fetch of the page answers for all of them. */
const CHECK_EVERY_MS = 30_000

let stale = false
let checking = false
let lastCheck = -Infinity

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

const absolute = (src: string | null): string | null => (src === null ? null : new URL(src, window.location.href).href)

function runningEntry(): string | null {
  return document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? null
}

async function servedEntry(): Promise<string | null> {
  try {
    const res = await fetch(window.location.href.split('#')[0], { cache: 'no-store' })
    return res.ok ? absolute(entryScriptSrc(await res.text())) : null
  } catch {
    return null
  }
}

function check(): void {
  const now = performance.now()
  if (stale || checking || now - lastCheck < CHECK_EVERY_MS) return
  checking = true
  lastCheck = now
  void servedEntry().then((served) => {
    checking = false
    stale = isNewBuild(runningEntry(), served)
    if (stale && isReloadSafe(useGameStore.getState().phase)) reloadForNewBuild()
  })
}

/** A chunk failed and the page now serves another build. */
export const isNewBuildLive = (): boolean => stale

/** Reloads the page if a new build is live and this session hasn't already reloaded for one; true when it does. */
export function reloadForNewBuild(): boolean {
  if (!stale || !claimReload(sessionStore())) return false
  window.location.reload()
  return true
}

export function installStaleReload(): void {
  onChunkFailure(check)
  // Vite's own signal for a dynamic import whose chunk or preloads failed.
  window.addEventListener('vite:preloadError', check)
  useGameStore.subscribe((next, prev) => {
    if (stale && next.phase !== prev.phase && isReloadSafe(next.phase)) reloadForNewBuild()
  })
}
