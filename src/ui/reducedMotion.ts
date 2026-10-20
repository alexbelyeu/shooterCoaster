import { useSyncExternalStore } from 'react'

/** One shared, live MediaQueryList for `prefers-reduced-motion: reduce`. */
const mql: MediaQueryList | null =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

/** Cheap enough for per-frame reads (`matches` is a live property, no allocation). */
export function prefersReducedMotion(): boolean {
  return mql?.matches ?? false
}

function subscribe(onChange: () => void): () => void {
  if (!mql) return () => {}
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** React hook form, re-renders when the OS setting changes. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}
