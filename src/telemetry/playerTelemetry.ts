/**
 * Real-player telemetry (#373): collects errors, WebGL context losses and frame times through the page load
 * and sends them as one beacon to `/api/telemetry` when the page is first hidden or closed. Installed by
 * `main.tsx` behind the same gate as Web Analytics (Vercel builds only; never `?e2e=1`, `?internal=1` or the portal).
 */
import { isInternalBrowser, type FlagStorage } from '@/app/analyticsGate'
import {
  addFrame,
  buildReport,
  cleanMessage,
  createLevelFrames,
  firstStackFrame,
  isGameError,
  MAX_LEVELS,
  recordError,
  type ErrorEntry,
  type LevelFrames,
} from './telemetryReport'

export const TELEMETRY_ENDPOINT = '/api/telemetry'

const errors: ErrorEntry[] = []
const levels = new Map<string, LevelFrames>()
let contextLost = 0
let gpu: string | null = null
let active = false

export const telemetryActive = () => active

/** Every frame of play (`TelemetryFrameProbe`). */
export function recordFrame(level: string, ms: number, quality: string, dpr: number): void {
  let lf = levels.get(level)
  if (!lf) {
    if (levels.size >= MAX_LEVELS) return
    lf = createLevelFrames(level)
    levels.set(level, lf)
  }
  addFrame(lf, ms)
  lf.quality = quality
  lf.dpr = dpr
}

/** The unmasked renderer where the browser offers it (newer Chrome returns it from RENDERER anyway). */
export function noteRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  if (gpu) return
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    gpu = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '') || null
  } catch {
    gpu = null
  }
}

export function installTelemetry(version: string, storage: FlagStorage | null): void {
  if (active) return
  active = true
  // The device class: phones and tablets (as `useRenderBudget`'s `isCoarsePointer`) or desktops.
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const origin = window.location.origin
  const note = (message: unknown, stack: unknown, filename?: string) => {
    const text = cleanMessage(message)
    if (isGameError(filename, text, stack, origin)) recordError(errors, text, firstStackFrame(stack))
  }
  window.addEventListener('error', (e) => note(e.error ?? e.message, e.error?.stack, e.filename))
  window.addEventListener('unhandledrejection', (e) => note(e.reason, (e.reason as Error | undefined)?.stack))
  // The event doesn't bubble: capture it on its way to the canvas.
  window.addEventListener('webglcontextlost', () => contextLost++, true)

  let sent = false
  const send = () => {
    // `?internal=1` in another tab silences this one too, like `dropInternalEvents`.
    if (sent || isInternalBrowser(storage)) return
    const report = buildReport({ version, touch, cores: navigator.hardwareConcurrency ?? null, gpu }, errors, contextLost, levels.values())
    if (!report) return
    sent = true
    try {
      navigator.sendBeacon?.(TELEMETRY_ENDPOINT, new Blob([JSON.stringify(report)], { type: 'application/json' }))
    } catch {
      // Nothing to do: telemetry never disturbs the game.
    }
  }
  // Phones often never fire `pagehide` when the app is swiped away: hiding the tab is the last reliable moment.
  window.addEventListener('pagehide', send)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send()
  })
}
