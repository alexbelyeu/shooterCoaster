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
  /** ms since the previous sample inside animation-frame callbacks: R3F's loop (every `useFrame`, the render), framer-motion's. */
  rafMs: number
  /** ms inside `renderer.render` (the composer's passes): part of `rafMs`, or of `timerMs` for a render a timer runs (the warm-up's). */
  renderMs: number
  /** ms since the previous sample inside `setTimeout` / `setInterval` callbacks (the music scheduler's tick among them). */
  timerMs: number
}

/**
 * Where a frame's time went (#596). `outside` is the rest: our JS outside animation frames and timers (React's HUD
 * renders, input events) plus everything that isn't our JS (garbage collection, the GPU, the compositor).
 */
export interface FrameSplit {
  raf: number
  render: number
  timers: number
  outside: number
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
  split: FrameSplit
  /** Event name -> times emitted since the previous sample. */
  events: Record<string, number>
}

/** One callback source (a timer or an animation-frame callback, named by where it was registered) while playing. */
export interface CallbackStats {
  calls: number
  ms: number
  maxMs: number
  firstT: number
  lastT: number
}

/** Time in the hitches while `playing`, summed: what the report's split line divides. */
interface PlayingHitches extends FrameSplit {
  frames: number
  ms: number
}

/** Callback sources kept: every timer the game runs fits many times over. */
const MAX_CALLBACKS = 60

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
  /** The next frame spans a hidden tab (#541): not a hitch, whatever its length. */
  skipNext: boolean
  playingHitches: PlayingHitches
  callbacks: Map<string, CallbackStats>
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
    skipNext: false,
    playingHitches: { frames: 0, ms: 0, raf: 0, render: 0, timers: 0, outside: 0 },
    callbacks: new Map(),
  }
}

/** The tab is visible again: the frame that spans the hidden time is the switch, not a stall. */
export function noteTabShown(log: HitchLog): void {
  log.skipNext = true
}

/** A timer or animation-frame callback ran for `ms` at `t`; the recorder counts them while `playing` only. */
export function noteCallback(log: HitchLog, label: string, t: number, ms: number): void {
  let stats = log.callbacks.get(label)
  if (!stats) {
    if (log.callbacks.size >= MAX_CALLBACKS) return
    stats = { calls: 0, ms: 0, maxMs: 0, firstT: t, lastT: t }
    log.callbacks.set(label, stats)
  }
  stats.calls++
  stats.ms += ms
  if (ms > stats.maxMs) stats.maxMs = ms
  stats.lastT = t
}

/**
 * Where a callback was registered, from an `Error().stack` taken inside the wrapper: the first frame outside
 * `selfFile` (the recorder's own chunk). Chrome's `    at fn (url:line:col)` and Safari's `fn@url:line:col`.
 */
export function callerLabel(stack: string | undefined, selfFile: string): string {
  for (const line of (stack ?? '').split('\n')) {
    const m = /(?:at\s+(?:(\S+)\s+\()?|^(\S*)@)(\S+?):(\d+):(\d+)\)?\s*$/.exec(line.trim())
    if (!m || m[3].endsWith(selfFile)) continue
    const fn = m[1] ?? m[2] ?? ''
    const file = m[3].slice(m[3].lastIndexOf('/') + 1)
    return `${fn || 'anon'} ${file}:${m[4]}:${m[5]}`
  }
  return 'unknown'
}

/**
 * Programs compiled since `before` that a level's warm-up didn't (`warmup`, its count when it finished; null while
 * a level scene loads, whose own compiles aren't counted). Above the warm-up's count only: its last compiles can
 * land in the sample after it finished. The one rule for `?perf=1` and the smoke (#541).
 */
export function programsAfterWarmup(programs: number, before: number, warmup: number | null): number {
  return warmup === null ? 0 : Math.max(0, programs - Math.max(before, warmup))
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
  if (prev) log.programsAfterWarmup += programsAfterWarmup(s.programs, prev.programs, log.warmupPrograms)
  if (prev) Object.assign(prev, s)
  else log.prev = { ...s }
  log.frames++
  const blank = s.drawCalls === 0
  if (blank) log.blankFrames++
  const skip = log.skipNext
  log.skipNext = false
  const events = log.frameEvents
  if ((s.frameMs <= HITCH_MS || skip) && !blank) {
    for (const name in events) delete events[name]
    return null
  }
  log.frameEvents = {}

  const outside = Math.max(0, s.frameMs - s.rafMs - s.timerMs)
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
    split: { raf: s.rafMs, render: s.renderMs, timers: s.timerMs, outside },
    events,
  }
  if (s.frameMs > HITCH_MS && !skip) {
    log.hitches++
    if (!log.worst || s.frameMs > log.worst.frameMs) log.worst = { frameMs: s.frameMs, t: s.t, phase: s.phase, level: s.level }
    if (s.phase === 'playing') {
      const p = log.playingHitches
      p.frames++
      p.ms += s.frameMs
      p.raf += s.rafMs
      p.render += s.renderMs
      p.timers += s.timerMs
      p.outside += outside
    }
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
  parts.push(splitText(e.split))
  const events = Object.entries(e.events).map(([name, n]) => (n > 1 ? `${name} x${n}` : name))
  if (events.length) parts.push(`events: ${events.join(', ')}`)
  return parts.join(' | ')
}

const whole = (n: number) => n.toFixed(0)

function splitText(p: FrameSplit): string {
  return `rAF ${whole(p.raf)} (render ${whole(p.render)}) / timers ${whole(p.timers)} / outside ${whole(p.outside)} ms`
}

/** How the long frames while `playing` split, as shares of their time: the line that names the cause's side. */
export function playingSplitLine(log: HitchLog): string {
  const p = log.playingHitches
  if (!p.frames) return 'no hitches while playing'
  const pct = (n: number) => `${Math.round((100 * n) / p.ms)}%`
  return `${p.frames} hitches while playing, ${(p.ms / 1000).toFixed(1)} s: in animation frames ${pct(p.raf)} (render ${pct(p.render)}), timers ${pct(p.timers)}, outside ${pct(p.outside)}`
}

function callbackLines(log: HitchLog): string[] {
  return [...log.callbacks]
    .sort(([, a], [, b]) => b.ms - a.ms)
    .map(([label, c]) => {
      const period = c.calls > 1 ? `every ~${whole((c.lastT - c.firstT) / (c.calls - 1))} ms` : 'once'
      return `  ${label} | ${period} | calls ${c.calls} | total ${whole(c.ms)} ms | max ${c.maxMs.toFixed(1)} ms`
    })
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
    'where the long frames went (rAF: our animation-frame callbacks, render: renderer.render, part of rAF or timers,',
    '  timers: setTimeout / setInterval callbacks, outside: GC, GPU, compositor, React and input outside those):',
    `  ${playingSplitLine(log)}`,
    '',
    'callbacks while playing (where each was registered: chunk:line:column of the build):',
    ...callbackLines(log),
    '',
    `frames over ${HITCH_MS} ms or blank (${log.entries.length}${log.dropped ? `, ${log.dropped} more not kept` : ''}):`,
    ...log.entries.map(entryLine),
  ]
  return lines.join('\n')
}
