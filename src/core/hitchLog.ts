/**
 * The `?perf=1` hitch recorder's log (#536): every frame over `HITCH_MS`, what the renderer compiled and
 * allocated in it, the bus events around it, and the load path's milestones. Pure: the probe feeds it samples.
 */

/** A frame longer than this is a hitch: a 60 Hz frame is 16.7 ms, three missed frames is a visible stutter. */
export const HITCH_MS = 50
/** Entries kept: a whole run of a badly stuttering device fits, an hour-long session can't grow without bound. */
export const MAX_ENTRIES = 400
/** Distinct event names kept per frame. */
const MAX_FRAME_EVENTS = 12

/** One frame as the probe saw it: the time since the previous sample and the renderer's counters now. */
export interface FrameSample {
  /** ms since page load. */
  t: number
  frameMs: number
  phase: string
  level: string | null
  /** `gl.info.programs.length`. */
  programs: number
  geometries: number
  textures: number
  /** Draw calls since the previous sample: 0 is a frame the canvas drew nothing in. */
  drawCalls: number
  /** `performance.memory.usedJSHeapSize` (Chrome only), else null. */
  heap: number | null
}

export interface HitchEntry {
  t: number
  frameMs: number
  phase: string
  level: string | null
  programs: number
  geometries: number
  textures: number
  /** Bytes, null where the browser doesn't say. */
  heap: number | null
  drawCalls: number
  /** Event name -> times emitted since the previous sample. */
  events: Record<string, number>
}

export interface Milestone {
  t: number
  name: string
}

export interface HitchLog {
  entries: HitchEntry[]
  dropped: number
  milestones: Milestone[]
  frames: number
  hitches: number
  blankFrames: number
  worst: { frameMs: number; t: number; phase: string; level: string | null } | null
  /** `programs` when the last warm-up finished; null before any. */
  warmupPrograms: number | null
  /** Programs compiled after a warm-up finished, summed over runs. */
  programsAfterWarmup: number
  prev: FrameSample | null
  frameEvents: Record<string, number>
}

export function createHitchLog(): HitchLog {
  return {
    entries: [],
    dropped: 0,
    milestones: [],
    frames: 0,
    hitches: 0,
    blankFrames: 0,
    worst: null,
    warmupPrograms: null,
    programsAfterWarmup: 0,
    prev: null,
    frameEvents: {},
  }
}

/** A bus event: lands on the next sample, the frame it happened in or just before. */
export function noteEvent(log: HitchLog, name: string): void {
  const events = log.frameEvents
  if (name in events) events[name]++
  else if (Object.keys(events).length < MAX_FRAME_EVENTS) events[name] = 1
}

export function noteMilestone(log: HitchLog, name: string, t: number): void {
  if (log.milestones.length >= MAX_ENTRIES) return
  log.milestones.push({ t, name })
}

/**
 * A level's warm-up finished with `programs` compiled: what is compiled from here on is a hitch the warm-up
 * missed. `null` when the next level scene starts loading, whose own warm-up compiles are not counted.
 */
export function noteWarmup(log: HitchLog, programs: number | null): void {
  log.warmupPrograms = programs
}

function grew(now: number, before: number | undefined): number {
  return before === undefined ? 0 : now - before
}

export function recordFrame(log: HitchLog, s: FrameSample): HitchEntry | null {
  // Compared before it is overwritten with this sample: the probe reuses one sample object every frame.
  const prev = log.prev
  const programs = grew(s.programs, prev?.programs)
  const geometries = grew(s.geometries, prev?.geometries)
  const textures = grew(s.textures, prev?.textures)
  const heap = s.heap !== null && prev?.heap != null ? s.heap - prev.heap : null
  // Above the warm-up's count only: the warm-up's last compiles can land in the sample after it finished.
  if (log.warmupPrograms !== null && prev) log.programsAfterWarmup += Math.max(0, s.programs - Math.max(prev.programs, log.warmupPrograms))
  if (prev) Object.assign(prev, s)
  else log.prev = { ...s }
  log.frames++
  const blank = s.drawCalls === 0
  if (blank) log.blankFrames++
  const events = log.frameEvents
  log.frameEvents = {}
  if (s.frameMs <= HITCH_MS && !blank) return null

  const entry: HitchEntry = {
    t: s.t,
    frameMs: s.frameMs,
    phase: s.phase,
    level: s.level,
    programs,
    geometries,
    textures,
    heap,
    drawCalls: s.drawCalls,
    events,
  }
  if (s.frameMs > HITCH_MS) {
    log.hitches++
    if (!log.worst || s.frameMs > log.worst.frameMs) log.worst = { frameMs: s.frameMs, t: s.t, phase: s.phase, level: s.level }
  }
  if (log.entries.length >= MAX_ENTRIES) log.dropped++
  else log.entries.push(entry)
  return entry
}

export interface ReportHeader {
  userAgent: string
  gpu: string | null
  quality: string
  dpr: number
  /** The first time each startup phase happened (`startupMarks.ts`), ms since load. */
  startup: Partial<Record<string, number>>
}

const ms = (t: number) => `${Math.round(t)}`

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

function entryLine(e: HitchEntry): string {
  const where = e.level ? `${e.phase}/${e.level}` : e.phase
  const parts = [`${ms(e.t).padStart(7)} ms`, `${e.frameMs.toFixed(0).padStart(5)} ms frame`, where]
  if (e.drawCalls === 0) parts.push('BLANK (0 draw calls)')
  if (e.programs) parts.push(`programs ${signed(e.programs)}`)
  if (e.geometries) parts.push(`geometries ${signed(e.geometries)}`)
  if (e.textures) parts.push(`textures ${signed(e.textures)}`)
  if (e.heap !== null) parts.push(`heap ${signed(Math.round(e.heap / 1024))} KB`)
  const events = Object.entries(e.events).map(([name, n]) => (n > 1 ? `${name} x${n}` : name))
  if (events.length) parts.push(`events: ${events.join(', ')}`)
  return parts.join(' | ')
}

/** The headline the panel shows. */
export function hitchSummary(log: HitchLog): string {
  const worst = log.worst ? `${log.worst.frameMs.toFixed(0)} ms` : 'none'
  return `hitches ${log.hitches} | worst ${worst} | programs after warm-up ${log.programsAfterWarmup} | blank frames ${log.blankFrames}`
}

/** The plain-text report the Copy button copies, for pasting into a GitHub issue. */
export function formatHitchReport(log: HitchLog, h: ReportHeader): string {
  const lines = [
    'ShooterCoaster ?perf=1 report',
    `user agent: ${h.userAgent}`,
    `gpu: ${h.gpu ?? 'unknown'}`,
    `quality: ${h.quality} | dpr: ${h.dpr}`,
    `frames: ${log.frames} | ${hitchSummary(log)}`,
    '',
    'load path, first time each (ms since load):',
    ...Object.entries(h.startup)
      .sort(([, a], [, b]) => (a ?? 0) - (b ?? 0))
      .map(([name, t]) => `  ${ms(t ?? 0).padStart(7)} ${name}`),
    '',
    'milestones (ms since load):',
    ...log.milestones.map((m) => `  ${ms(m.t).padStart(7)} ${m.name}`),
    '',
    `frames over ${HITCH_MS} ms or blank (${log.entries.length}${log.dropped ? `, ${log.dropped} more not kept` : ''}):`,
    ...log.entries.map(entryLine),
  ]
  return lines.join('\n')
}
