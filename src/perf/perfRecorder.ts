import type { WebGLRenderer } from 'three'
import { eventBus } from '@/core/EventBus'
import { createHitchLog, formatHitchReport, noteEvent, noteMilestone, noteWarmup, type HitchLog } from '@/core/hitchLog'
import { startupTimings } from '@/core/startupMarks'
import { useGameStore } from '@/store/useGameStore'
import { useSettingsStore } from '@/store/useSettingsStore'

/** The page's one hitch log: fed by `PerfProbe` every frame and by the listeners below, read by `PerfPanel`. */
export const hitchLog: HitchLog = createHitchLog()

/** Set by `PerfProbe` once the canvas exists. */
export const perfContext = { gl: null as WebGLRenderer | null, gpu: null as string | null, dpr: 1 }

const milestone = (name: string) => noteMilestone(hitchLog, name, performance.now())

/** `?perf=1` (#536): starts recording bus events, phase changes, warm-ups and tab hides, from boot (`main.tsx`). */
export function startPerfRecorder(): void {
  eventBus.tap = (event) => noteEvent(hitchLog, event)
  milestone(`recorder started, phase ${useGameStore.getState().phase}`)
  useGameStore.subscribe((s, prev) => {
    if (s.phase !== prev.phase) milestone(`phase ${s.phase}${s.currentLevel ? ` ${s.currentLevel}` : ''}`)
    if (s.sceneReady === prev.sceneReady) return
    const programs = perfContext.gl?.info.programs?.length ?? 0
    noteWarmup(hitchLog, s.sceneReady ? programs : null)
    milestone(s.sceneReady ? `warm-up done, ${programs} programs` : 'level scene loading')
  })
  document.addEventListener('visibilitychange', () => milestone(`tab ${document.visibilityState}`))
}

export function noteContextLoss(lost: boolean): void {
  milestone(lost ? 'webgl context lost' : 'webgl context restored')
}

export function hitchReport(): string {
  return formatHitchReport(hitchLog, {
    userAgent: navigator.userAgent,
    gpu: perfContext.gpu,
    quality: useSettingsStore.getState().quality,
    dpr: perfContext.dpr,
    startup: startupTimings(),
  })
}
