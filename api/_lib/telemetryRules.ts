/**
 * Real-player telemetry (#373): the server's checks on a report (the limits of src/telemetry/telemetryReport.ts,
 * which api/ can't import) and the last-24-hours summary the studio reads (`GET /api/telemetry`).
 */
import { isCampaignLevel } from './rules.js'

export const MAX_TELEMETRY_BYTES = 6144
export const TELEMETRY_RATE_LIMIT = { max: 10, windowMs: 10 * 60 * 1000 } as const
export const SUMMARY_WINDOW_MS = 24 * 3600 * 1000
/** Rows older than this are deleted (now and then, on a POST). */
export const RETENTION_DAYS = 30
export const SUMMARY_ROW_LIMIT = 3000

const QUALITIES = ['auto', 'low', 'medium', 'high']
const VERSION = /^[\w.+-]{1,40}$/
const CONTROL = /[\u0000-\u001f\u007f]/

export interface ReportError {
  message: string
  frame: string
  count: number
}

export interface ReportLevel {
  level: string
  quality: string
  dpr: number
  frames: number
  p50Ms: number
  p95Ms: number
}

export interface Report {
  version: string
  touch: boolean
  cores: number | null
  gpu: string | null
  contextLost: number
  errors: ReportError[]
  levels: ReportLevel[]
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string }

const isInt = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
const isNum = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && v >= min && v <= max
const isText = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.length >= min && v.length <= max && !CONTROL.test(v)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function checkError(v: unknown): ReportError | null {
  if (!isRecord(v)) return null
  const { message, frame, count } = v
  if (!isText(message, 1, 200) || !isText(frame, 0, 160) || !isInt(count, 1, 999)) return null
  return { message, frame, count }
}

function checkLevel(v: unknown): ReportLevel | null {
  if (!isRecord(v)) return null
  const { level, quality, dpr, frames, p50Ms, p95Ms } = v
  if (!isCampaignLevel(level) || typeof quality !== 'string' || !QUALITIES.includes(quality)) return null
  if (!isNum(dpr, 0.1, 8) || !isInt(frames, 1, 10_000_000) || !isNum(p50Ms, 0, 1000) || !isNum(p95Ms, p50Ms, 1000)) return null
  return { level, quality, dpr, frames, p50Ms, p95Ms }
}

/** All or nothing: one malformed field drops the report. */
export function checkReport(body: unknown): Checked<Report> {
  if (!isRecord(body)) return { ok: false, error: 'bad body' }
  const { version, touch, cores, gpu, contextLost, errors, levels } = body
  if (typeof version !== 'string' || !VERSION.test(version)) return { ok: false, error: 'bad version' }
  if (typeof touch !== 'boolean') return { ok: false, error: 'bad touch' }
  if (cores !== null && !isInt(cores, 1, 256)) return { ok: false, error: 'bad cores' }
  if (gpu !== null && !isText(gpu, 1, 120)) return { ok: false, error: 'bad gpu' }
  if (!isInt(contextLost, 0, 100)) return { ok: false, error: 'bad contextLost' }
  if (!Array.isArray(errors) || errors.length > 5 || !Array.isArray(levels) || levels.length > 8) return { ok: false, error: 'bad lists' }
  const goodErrors = errors.map(checkError)
  const goodLevels = levels.map(checkLevel)
  if (goodErrors.some((e) => !e) || goodLevels.some((l) => !l)) return { ok: false, error: 'bad entry' }
  if (!goodErrors.length && !goodLevels.length && !contextLost) return { ok: false, error: 'empty' }
  return { ok: true, value: { version, touch, cores, gpu, contextLost, errors: goodErrors as ReportError[], levels: goodLevels as ReportLevel[] } }
}

/** The rate limit's key: an HMAC of the IP under a salt that changes every UTC day, so no row links to another day's. */
export const dailySalt = (secret: string, now: number) => `${secret}:telemetry:${new Date(now).toISOString().slice(0, 10)}`

// ---------- the summary ----------

/** A stored report, as `telemetryDb.recent` reads it. */
export interface ReportRow {
  created_at: string
  client_version: string
  touch: boolean
  gpu: string | null
  context_lost: number
  errors: ReportError[]
  levels: ReportLevel[]
}

export interface ErrorSummary {
  /** Stable per message + frame: the studio-health watchdog files one issue per key. */
  key: string
  message: string
  frame: string
  sessions: number
  count: number
  firstSeen: string
  lastSeen: string
  versions: string[]
}

export type DeviceClass = 'touch' | 'desktop'

export interface FrameSummary {
  level: string
  device: DeviceClass
  sessions: number
  frames: number
  /** Medians over sessions of each session's own p50 / p95: the typical player's, not one slow device's. */
  p50Ms: number
  p95Ms: number
  /** The slowest session's p95. */
  worstP95Ms: number
}

export interface TelemetrySummary {
  since: string
  until: string
  sessions: number
  /** Hit the row limit: the counts are a lower bound. */
  truncated: boolean
  errors: ErrorSummary[]
  contextLost: { sessions: number; gpus: { gpu: string; sessions: number }[] }
  frames: FrameSummary[]
}

/** FNV-1a, 32-bit, hex. */
export function errorKey(message: string, frame: string): string {
  let h = 0x811c9dc5
  for (const ch of `${message}\n${frame}`) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function summarize(rows: ReportRow[], now: number, truncated = false): TelemetrySummary {
  const errors = new Map<string, ErrorSummary>()
  const frames = new Map<string, { level: string; device: DeviceClass; p50: number[]; p95: number[]; frames: number }>()
  const lostGpus = new Map<string, number>()
  let lostSessions = 0
  for (const row of rows) {
    const seenHere = new Set<string>()
    for (const e of Array.isArray(row.errors) ? row.errors : []) {
      const key = errorKey(e.message, e.frame)
      let s = errors.get(key)
      if (!s) {
        s = { key, message: e.message, frame: e.frame, sessions: 0, count: 0, firstSeen: row.created_at, lastSeen: row.created_at, versions: [] }
        errors.set(key, s)
      }
      if (!seenHere.has(key)) s.sessions++
      seenHere.add(key)
      s.count += e.count
      if (row.created_at < s.firstSeen) s.firstSeen = row.created_at
      if (row.created_at > s.lastSeen) s.lastSeen = row.created_at
      if (!s.versions.includes(row.client_version)) s.versions.push(row.client_version)
    }
    if (row.context_lost > 0) {
      lostSessions++
      const gpu = row.gpu || 'unknown'
      lostGpus.set(gpu, (lostGpus.get(gpu) ?? 0) + 1)
    }
    const device: DeviceClass = row.touch ? 'touch' : 'desktop'
    for (const l of Array.isArray(row.levels) ? row.levels : []) {
      const k = `${l.level}|${device}`
      let f = frames.get(k)
      if (!f) {
        f = { level: l.level, device, p50: [], p95: [], frames: 0 }
        frames.set(k, f)
      }
      f.p50.push(l.p50Ms)
      f.p95.push(l.p95Ms)
      f.frames += l.frames
    }
  }
  return {
    since: new Date(now - SUMMARY_WINDOW_MS).toISOString(),
    until: new Date(now).toISOString(),
    sessions: rows.length,
    truncated,
    errors: [...errors.values()]
      .sort((a, b) => b.sessions - a.sessions || b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, 20)
      .map((e) => ({ ...e, versions: e.versions.sort().slice(-5) })),
    contextLost: {
      sessions: lostSessions,
      gpus: [...lostGpus].map(([gpu, sessions]) => ({ gpu, sessions })).sort((a, b) => b.sessions - a.sessions || a.gpu.localeCompare(b.gpu)).slice(0, 5),
    },
    frames: [...frames.values()]
      .map((f) => ({
        level: f.level,
        device: f.device,
        sessions: f.p95.length,
        frames: f.frames,
        p50Ms: round1(median(f.p50)),
        p95Ms: round1(median(f.p95)),
        worstP95Ms: Math.max(...f.p95),
      }))
      .sort((a, b) => a.level.localeCompare(b.level) || a.device.localeCompare(b.device)),
  }
}
