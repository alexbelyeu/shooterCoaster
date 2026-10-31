import { useEffect, useReducer, useSyncExternalStore } from 'react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { adaptiveBudgetScale } from './adaptiveDpr'
import { qualityProfile, type QualityProfile } from './graphicsQuality'
import { budgetDpr, composerMultisampling, pixelBudget } from './renderBudget'

/** Phones and tablets. Read once: a device's primary pointer doesn't change mid-session. */
export const isCoarsePointer =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches

/** The current graphics quality's preset; re-renders when the setting changes. */
export function useQualityProfile(): QualityProfile {
  return qualityProfile(useSettingsStore((s) => s.quality))
}

export function useComposerMultisampling(): number {
  return composerMultisampling(isCoarsePointer, useQualityProfile())
}

// Adaptive step-downs for this page load (`auto` quality only); never reset, never undone.
let adaptiveSteps = 0
const stepListeners = new Set<() => void>()

export function getAdaptiveSteps(): number {
  return adaptiveSteps
}

export function setAdaptiveSteps(steps: number): void {
  if (steps === adaptiveSteps) return
  adaptiveSteps = steps
  for (const listener of stepListeners) listener()
}

function subscribeSteps(listener: () => void): () => void {
  stepListeners.add(listener)
  return () => stepListeners.delete(listener)
}

function currentDpr(profile: QualityProfile, steps: number): number {
  const budget = pixelBudget(isCoarsePointer) * adaptiveBudgetScale(steps)
  return budgetDpr(window.devicePixelRatio, window.innerWidth, window.innerHeight, budget, profile.maxDpr)
}

/** Canvas dpr from the pixel budget, the quality's cap and the adaptive steps; recomputed on resize. The canvas fills the window. */
export function useCanvasDpr(): number {
  const quality = useSettingsStore((s) => s.quality)
  const steps = useSyncExternalStore(subscribeSteps, getAdaptiveSteps)
  // A resize re-renders; the dpr is recomputed from the window on every render.
  const [, onResize] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return currentDpr(qualityProfile(quality), quality === 'auto' ? steps : 0)
}
