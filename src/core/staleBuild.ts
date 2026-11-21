/**
 * A deploy while the tab is open (#823): Vercel swaps the whole build, so the old build's hashed lazy chunks are gone
 * and their imports fail for good. Lazy chunks load through `lazyChunk`, which forgets a failure and reports it here;
 * `app/staleReload.ts` checks whether a new build is live and reloads the page at a safe moment, once per session.
 */
import type { GamePhase } from '@/types/game'

type FailureListener = (err: unknown) => void
let listener: FailureListener | null = null

/** The page's one listener for failed chunk imports (`app/staleReload.ts`). */
export function onChunkFailure(fn: FailureListener | null): void {
  listener = fn
}

/**
 * `importer` memoised while it is pending or has loaded; a failure is reported and forgotten, so the next call fetches
 * again instead of replaying a cached rejection for the rest of the session.
 */
export function lazyChunk<T>(importer: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null
  return () => {
    pending ??= importer().catch((err: unknown) => {
      pending = null
      listener?.(err)
      throw err
    })
    return pending
  }
}

/** The page's module entry script (`<script type="module" src>`), from the HTML a build serves; null when it has none. */
export function entryScriptSrc(html: string): string | null {
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/\btype\s*=\s*["']module["']/i.test(tag)) continue
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)
    if (src) return src[1]
  }
  return null
}

/** The page being served now starts from another entry than the running one: a deploy replaced this build. */
export function isNewBuild(running: string | null, served: string | null): boolean {
  return running !== null && served !== null && running !== served
}

/** Nothing to lose on these screens; results reloads as the player leaves it (`ResultsScreen`), after its initials. */
export const isReloadSafe = (phase: GamePhase): boolean => phase === 'title' || phase === 'levelSelect'

export const RELOAD_GUARD_KEY = 'shootercoaster-stale-reload'

/** True once per session: the reload's guard, so an outage that fails every import can't loop. False when storage fails. */
export function claimReload(storage: Pick<Storage, 'getItem' | 'setItem'> | null): boolean {
  if (!storage) return false
  try {
    if (storage.getItem(RELOAD_GUARD_KEY) !== null) return false
    storage.setItem(RELOAD_GUARD_KEY, '1')
    return true
  } catch {
    return false
  }
}
