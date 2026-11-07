/**
 * Real-player telemetry (#373), pure: what one page load reports to `/api/telemetry`. Frame times per
 * level, a few deduped errors, WebGL context losses and the device class; no ids, no cookies.
 * `api/_lib/telemetryRules.ts` checks the same limits on the server.
 */

export const BIN_MS = 0.5
/** 0.5 ms bins up to 100 ms; the last bin holds every frame of 100 ms or more. */
export const HIST_BINS = 201
/** Longer than this, the page was in the background or stalled on a tab switch: not a frame the player saw. */
export const MAX_FRAME_MS = 1000
/** A level with fewer frames than this (a quit in the first second) says nothing about its frame rate. */
export const MIN_FRAMES = 60
export const MAX_ERRORS = 5
export const MAX_ERROR_COUNT = 999
export const MAX_LEVELS = 8
export const MAX_MESSAGE = 200
export const MAX_FRAME = 160
export const MAX_GPU = 120

export interface LevelFrames {
  level: string
  hist: Uint32Array
  frames: number
  quality: string
  dpr: number
}

export interface ErrorEntry {
  message: string
  /** The first stack frame, without the origin or query: `fn (/assets/index-abc.js:1:2345)`. */
  frame: string
  count: number
}

export interface LevelReport {
  level: string
  quality: string
  dpr: number
  frames: number
  p50Ms: number
  p95Ms: number
}

export interface TelemetryReport {
  version: string
  touch: boolean
  cores: number | null
  gpu: string | null
  contextLost: number
  errors: ErrorEntry[]
  levels: LevelReport[]
}

export function createLevelFrames(level: string): LevelFrames {
  return { level, hist: new Uint32Array(HIST_BINS), frames: 0, quality: '', dpr: 0 }
}

/** Allocation-free: called every frame of play. */
export function addFrame(lf: LevelFrames, ms: number): void {
  if (!(ms > 0) || ms > MAX_FRAME_MS) return
  lf.hist[Math.min(HIST_BINS - 1, Math.floor(ms / BIN_MS))]++
  lf.frames++
}

/** The bin's midpoint (100 for the open last bin), so it is within 0.25 ms of the real percentile below 100 ms. */
export function percentileMs(hist: Uint32Array, total: number, p: number): number {
  if (total <= 0) return 0
  const rank = Math.ceil(total * p)
  let seen = 0
  for (let i = 0; i < hist.length; i++) {
    seen += hist[i]
    if (seen >= rank) return i === hist.length - 1 ? i * BIN_MS : (i + 0.5) * BIN_MS
  }
  return (hist.length - 1) * BIN_MS
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s)

/** Full URLs become their path: no origin, query or hash (a query can carry `?seed=` and the like). */
function stripUrls(s: string): string {
  return s.replace(/\b[a-z][\w+.-]*:\/\/[^/\s)]+(\/[^\s?#)]*)?(?:[?#][^\s)]*)?/gi, (_, path: string | undefined) => path ?? '/')
}

export function cleanMessage(raw: unknown): string {
  const text = typeof raw === 'string' ? raw : raw instanceof Error ? raw.message : String(raw)
  return cut(stripUrls(text).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim(), MAX_MESSAGE) || 'unknown error'
}

/** The first frame of a V8 (`    at fn (url:1:2)`) or Firefox / Safari (`fn@url:1:2`) stack; '' when there is none. */
export function firstStackFrame(stack: unknown): string {
  if (typeof stack !== 'string') return ''
  for (const line of stack.split('\n')) {
    const v8 = /^\s*at\s+(.+)$/.exec(line)
    const gecko = v8 ? null : /^([^@\s]*)@(.+:\d+:\d+)$/.exec(line.trim())
    const frame = v8 ? v8[1] : gecko ? `${gecko[1] || '<anonymous>'} (${gecko[2]})` : null
    if (frame) return cut(stripUrls(frame).replace(/\s+/g, ' ').trim(), MAX_FRAME)
  }
  return ''
}

/**
 * Errors from browser extensions, injected scripts or other origins aren't the game's: their file isn't on
 * this origin, or the browser hid the details ("Script error.").
 */
export function isGameError(filename: string | undefined, message: string, stack: unknown, origin: string): boolean {
  if (/^Script error\.?$/i.test(message.trim())) return false
  if (filename && !filename.startsWith(origin)) return false
  return !(typeof stack === 'string' && /\b(chrome|moz|safari(-web)?)-extension:\/\//.test(stack))
}

/** Deduped by message + frame; the first `MAX_ERRORS` distinct errors are kept, later repeats only counted. */
export function recordError(errors: ErrorEntry[], message: string, frame: string): void {
  const seen = errors.find((e) => e.message === message && e.frame === frame)
  if (seen) seen.count = Math.min(MAX_ERROR_COUNT, seen.count + 1)
  else if (errors.length < MAX_ERRORS) errors.push({ message, frame, count: 1 })
}

export interface Device {
  version: string
  touch: boolean
  cores: number | null
  gpu: string | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Null when there is nothing worth sending: no error, no context loss and no level played long enough. */
export function buildReport(device: Device, errors: ErrorEntry[], contextLost: number, levels: Iterable<LevelFrames>): TelemetryReport | null {
  const played: LevelReport[] = []
  for (const lf of levels) {
    if (lf.frames < MIN_FRAMES || played.length >= MAX_LEVELS) continue
    played.push({
      level: lf.level,
      quality: lf.quality,
      dpr: round1(lf.dpr),
      frames: lf.frames,
      p50Ms: percentileMs(lf.hist, lf.frames, 0.5),
      p95Ms: percentileMs(lf.hist, lf.frames, 0.95),
    })
  }
  if (!played.length && !errors.length && !contextLost) return null
  const cores = Number.isSafeInteger(device.cores) && device.cores! > 0 ? Math.min(256, device.cores!) : null
  const gpu = device.gpu ? cut(device.gpu.replace(/\s+/g, ' ').trim(), MAX_GPU) || null : null
  return { version: device.version, touch: device.touch, cores, gpu, contextLost: Math.min(100, contextLost), errors: errors.slice(0, MAX_ERRORS), levels: played }
}
