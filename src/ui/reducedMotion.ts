import { useSyncExternalStore } from 'react'
import { useSettingsStore } from '@/store/useSettingsStore'

/** One shared, live MediaQueryList for `prefers-reduced-motion: reduce`. */
const mql: MediaQueryList | null =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

/** The OS setting alone (the settings screen shows it as a locked "on"). */
export function systemPrefersReducedMotion(): boolean {
  return mql?.matches ?? false
}

/** OS setting or the in-game Reduced motion toggle. Cheap enough for per-frame reads (no allocation). */
export function prefersReducedMotion(): boolean {
  return systemPrefersReducedMotion() || useSettingsStore.getState().reducedMotion
}

function subscribe(onChange: () => void): () => void {
  const unsubscribe = useSettingsStore.subscribe((s, prev) => {
    if (s.reducedMotion !== prev.reducedMotion) onChange()
  })
  mql?.addEventListener('change', onChange)
  return () => {
    unsubscribe()
    mql?.removeEventListener('change', onChange)
  }
}

/** React hook form, re-renders when either setting changes. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}

/** System-only hook form, for the settings screen. */
export function useSystemPrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, systemPrefersReducedMotion, () => false)
}
