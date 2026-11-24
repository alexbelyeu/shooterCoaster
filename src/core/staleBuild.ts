/**
 * A lazy chunk that fails to load stays failed until the page reloads: a deploy while the tab is open (#823) removes the
 * old build's hashed chunks, and the browser keeps a failed `import()` failed for the page's life, so importing the same
 * URL again never reaches the network (#888; a cache-busted URL is no way round it: the other chunks import a shared chunk
 * by its own URL). Lazy chunks load through `lazyChunk`, which forgets a failure and reports it here; `app/staleReload.ts` reloads
 * the page at a safe moment once it still serves the game, once per session.
 */
import type { GamePhase } from '@/types/game'

type FailureListener = (err: unknown) => void
let listener: FailureListener | null = null

/** The page's one listener for failed chunk imports (`app/staleReload.ts`). */
export function onChunkFailure(fn: FailureListener | null): void {
  listener = fn
}

/**
 * `importer` memoised while it is pending or has loaded; a failure is reported (the reload's cue) and forgotten, so the
 * next call runs `importer` again rather than holding a rejection of its own (the browser may still replay its cached one).
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
