/**
 * Pacing (#450): how much of a run, sampled frame by frame by the smoke's `pacing` step, has nothing to shoot on screen.
 * A sample stands for the level time up to the next one; the GO grace and the boss tell are meant to be empty, so they
 * count neither way and end a gap.
 */

const GO_GRACE_SECONDS = 2
const LISTED_GAP_SECONDS = 1

const round = (x, places) => Number(x.toFixed(places))

/**
 * @param {{ t: number, targets: number, track: number, waveTell?: boolean, bossTell?: boolean }[]} samples in level-time order
 * @param {number} end the run's length in level seconds
 */
export function pacingMetrics(samples, end) {
  let counted = 0
  let empty = 0
  const gaps = []
  let open = null
  const close = () => {
    if (open) gaps.push(open)
    open = null
  }
  samples.forEach((s, i) => {
    const until = Math.min(i + 1 < samples.length ? samples[i + 1].t : end, end)
    if (s.bossTell) return close()
    const from = Math.max(s.t, GO_GRACE_SECONDS)
    if (until <= from) {
      if (s.t < GO_GRACE_SECONDS) close()
      return
    }
    const dt = until - from
    counted += dt
    if (s.targets > 0) return close()
    empty += dt
    open ??= { start: from, track: s.track, seconds: 0 }
    open.seconds += dt
  })
  close()
  const longest = gaps.reduce((a, g) => (a && a.seconds >= g.seconds ? a : g), null)
  const gap = (g) => ({ start: round(g.start, 2), seconds: round(g.seconds, 2), track: round(g.track, 3) })
  return {
    runSeconds: round(end, 2),
    countedSeconds: round(counted, 2),
    noTargetShare: counted > 0 ? round(empty / counted, 3) : 0,
    longestGapSeconds: longest ? round(longest.seconds, 2) : 0,
    longestGap: longest ? gap(longest) : null,
    gaps: gaps.filter((g) => g.seconds >= LISTED_GAP_SECONDS).map(gap),
  }
}

/** One row a level second, for pacing.json. */
export function pacingTimeline(samples) {
  const rows = []
  for (const s of samples) {
    const t = Math.floor(s.t)
    let row = rows.at(-1)
    if (!row || row.t !== t) {
      row = { t, min: s.targets, max: s.targets, track: round(s.track, 3), waveTell: false, bossTell: false }
      rows.push(row)
    }
    row.min = Math.min(row.min, s.targets)
    row.max = Math.max(row.max, s.targets)
    row.waveTell ||= !!s.waveTell
    row.bossTell ||= !!s.bossTell
  }
  return rows
}

/** `level2 pacing: no target 23% of 60 s, longest gap 7.4 s at 31 s (track 0.52)` */
export function pacingSummary(level, m) {
  const gap = m.longestGap
    ? `longest gap ${m.longestGap.seconds.toFixed(1)} s at ${m.longestGap.start.toFixed(0)} s (track ${m.longestGap.track.toFixed(2)})`
    : 'no gap'
  return `${level} pacing: no target ${(m.noTargetShare * 100).toFixed(0)}% of ${m.runSeconds.toFixed(0)} s, ${gap}`
}

/** Problems against the level's `budgets.json` `pacing` ceilings (`longestGapSeconds`, `noTargetShare`). */
export function pacingBudgetProblems(level, m, budget) {
  if (!budget) return [`no pacing budget for ${level} in budgets.json`]
  const problems = []
  if (m.longestGapSeconds > budget.longestGapSeconds) {
    const g = m.longestGap
    problems.push(`longest gap ${g.seconds.toFixed(1)} s at ${g.start.toFixed(1)} s (track ${g.track.toFixed(2)}) over budget ${budget.longestGapSeconds} s`)
  }
  if (m.noTargetShare > budget.noTargetShare) {
    problems.push(`no target ${(m.noTargetShare * 100).toFixed(0)}% of the run over budget ${(budget.noTargetShare * 100).toFixed(0)}%`)
  }
  return problems
}
