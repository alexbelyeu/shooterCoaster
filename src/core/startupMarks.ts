/** Startup phases as one `performance.mark` (`sc:<phase>`) each, the first time they happen in a page load. */
export const STARTUP_PHASES = [
  'boot',
  'titleFrame',
  // The title screen's mount: PLAY takes clicks from here, while it fades in.
  'playReady',
  'runStart',
  // ShaderWarmup's mount effect, which runs after the level's other effects.
  'levelMounted',
  'envBaked',
  'warmupDone',
  'firstPlayingFrame',
] as const

export type StartupPhase = (typeof STARTUP_PHASES)[number]

const marked = new Set<StartupPhase>()

export function markStartup(phase: StartupPhase): void {
  if (marked.has(phase)) return
  marked.add(phase)
  performance.mark(`sc:${phase}`)
}

/** ms from navigation to each phase reached so far. */
export function startupTimings(): Partial<Record<StartupPhase, number>> {
  const out: Partial<Record<StartupPhase, number>> = {}
  for (const phase of STARTUP_PHASES) {
    const entry = performance.getEntriesByName(`sc:${phase}`, 'mark')[0]
    if (entry) out[phase] = Math.round(entry.startTime)
  }
  return out
}
