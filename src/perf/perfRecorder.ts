import type { WebGLRenderer } from 'three'
import { eventBus } from '@/core/EventBus'
import {
  callerLabel,
  createHitchLog,
  formatHitchReport,
  noteCallback,
  noteEvent,
  noteMilestone,
  noteTabShown,
  noteWarmup,
  type HitchLog,
} from '@/core/hitchLog'
import { startupTimings } from '@/core/startupMarks'
import { useGameStore } from '@/store/useGameStore'
import { useSettingsStore } from '@/store/useSettingsStore'

/** The page's one hitch log: fed by `PerfProbe` every frame and by the listeners below, read by `PerfPanel`. */
export const hitchLog: HitchLog = createHitchLog()

/** Set by `PerfProbe` once the canvas exists. */
export const perfContext = { gl: null as WebGLRenderer | null, gpu: null as string | null, dpr: 1 }

/** ms spent in each kind of callback since `PerfProbe` last took them (#596): its sample's split. */
export const frameTime = { raf: 0, render: 0, timers: 0 }

const milestone = (name: string) => noteMilestone(hitchLog, name, performance.now())

/** This chunk's file name: the stack frames a label skips, the wrappers' own. */
const SELF_FILE = import.meta.url.slice(import.meta.url.lastIndexOf('/') + 1)
/** Labels of callbacks passed more than once (R3F's loop every frame, an interval's handler): one stack each. */
const labels = new WeakMap<object, string>()

function labelOf(fn: object): string {
  let label = labels.get(fn)
  if (label === undefined) {
    label = callerLabel(new Error().stack, SELF_FILE)
    labels.set(fn, label)
  }
  return label
}

type Callback = (...args: never[]) => unknown

/** Times `fn` into `frameTime[kind]` and, while playing, into the log's per-source table. */
function timed<F extends Callback>(fn: F, kind: 'raf' | 'timers'): F {
  const label = labelOf(fn)
  return ((...args: never[]) => {
    const start = performance.now()
    try {
      return fn(...args)
    } finally {
      const end = performance.now()
      frameTime[kind] += end - start
      if (useGameStore.getState().phase === 'playing') noteCallback(hitchLog, label, start, end - start)
    }
  }) as F
}

/**
 * Wraps the page's animation-frame and timer entry points so every callback is timed (#596): a long frame's
 * time splits into ours (in rAF, in timers) and everything else. Callers look these up on `window` at call
 * time (R3F's loop, the music scheduler's interval), so wrapping them after boot still sees every later call.
 */
function wrapCallbacks(): void {
  const raf = window.requestAnimationFrame.bind(window)
  const timeout = window.setTimeout.bind(window)
  const interval = window.setInterval.bind(window)
  window.requestAnimationFrame = (cb) => raf(timed(cb, 'raf'))
  window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) =>
    timeout(typeof fn === 'function' ? timed(fn as Callback, 'timers') : fn, ms, ...args)) as typeof window.setTimeout
  window.setInterval = ((fn: TimerHandler, ms?: number, ...args: unknown[]) =>
    interval(typeof fn === 'function' ? timed(fn as Callback, 'timers') : fn, ms, ...args)) as typeof window.setInterval
}

/**
 * `?perf=1` (#536): starts recording bus events, phase changes, warm-ups and tab hides, and timing every
 * animation-frame and timer callback, from boot (`main.tsx`).
 */
export function startPerfRecorder(): void {
  wrapCallbacks()
  eventBus.taps.add((event) => noteEvent(hitchLog, event))
  milestone(`recorder started, phase ${useGameStore.getState().phase}`)
  useGameStore.subscribe((s, prev) => {
    if (s.phase !== prev.phase) milestone(`phase ${s.phase}${s.currentLevel ? ` ${s.currentLevel}` : ''}`)
    if (s.sceneReady === prev.sceneReady) return
    const programs = perfContext.gl?.info.programs?.length ?? 0
    noteWarmup(hitchLog, s.sceneReady ? programs : null)
    milestone(s.sceneReady ? `warm-up done, ${programs} programs` : 'level scene loading')
  })
  document.addEventListener('visibilitychange', () => {
    milestone(`tab ${document.visibilityState}`)
    if (document.visibilityState === 'visible') noteTabShown(hitchLog)
  })
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
