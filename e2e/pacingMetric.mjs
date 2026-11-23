/**
 * Pacing (#450): how much of a run, sampled frame by frame by the smoke's `pacing` step, has nothing to shoot on screen.
 * A target counts when the rider can shoot it (#925, `__SC_TEST__.sight()`): in view, readable, and not behind the world.
 * A sample stands for the level time up to the next one; the GO grace and the boss tell are meant to be empty, so they
 * count neither way and end a gap.
 */

const GO_GRACE_SECONDS = 2
/**
 * The player the pacing run and the ride review play as (#925): hits a game second on the nearest shootable targets
 * (`autoFire(true, rate)`). Unfired, a run kept every enemy alive and its leftovers filled the gym's empty stretches; a player
 * who shoots what they see is who meets them.
 */
export const PLAYER_HITS_PER_SECOND = 3
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
  const boss = m.boss ? `, boss shootable ${m.boss.framedSeconds.toFixed(1)} of ${m.boss.fightSeconds.toFixed(0)} s` : ''
  return `${level} pacing: no target ${(m.noTargetShare * 100).toFixed(0)}% of ${m.runSeconds.toFixed(0)} s, ${gap}${boss}`
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

/** How long a boss fight lasts at most (`pacing.ts`: the boss arrives with 20 s of the run left). */
export const BOSS_FIGHT_SECONDS = 20

/**
 * Boss framing (#925): of the boss's fight (from its first `active` sample to the run's end, at most `BOSS_FIGHT_SECONDS`),
 * the seconds one of its weak points was shootable (`sight().bossFramed`), and the longest stretch it was not. A ride that
 * turns away from the boss two seconds after she rises leaves the player nothing to fight.
 * @param {{ t: number, bossStage?: string, bossFramed?: boolean }[]} samples
 */
export function bossFraming(samples, end, fightSeconds = BOSS_FIGHT_SECONDS) {
  const first = samples.findIndex((s) => s.bossStage === 'active')
  if (first < 0) return null
  const from = samples[first].t
  const until = Math.min(end, from + fightSeconds)
  let framed = 0
  let gap = 0
  let longest = { start: from, seconds: 0 }
  let open = null
  for (let i = first; i < samples.length; i++) {
    const s = samples[i]
    if (s.t >= until) break
    const dt = Math.min(i + 1 < samples.length ? samples[i + 1].t : until, until) - s.t
    if (dt <= 0) continue
    if (s.bossFramed) {
      framed += dt
      open = null
      continue
    }
    gap += dt
    open ??= { start: s.t, seconds: 0 }
    open.seconds += dt
    if (open.seconds > longest.seconds) longest = open
  }
  const window = until - from
  return {
    arrivedAt: round(from, 2),
    fightSeconds: round(window, 2),
    framedSeconds: round(framed, 2),
    framedShare: window > 0 ? round(framed / window, 3) : 0,
    longestUnframed: { start: round(longest.start, 2), seconds: round(longest.seconds, 2) },
    unframedSeconds: round(gap, 2),
  }
}

/** Problems against the level's `budgets.json` `pacing.bossFramedShare` floor. */
export function bossFramingProblems(m, budget) {
  if (!budget?.bossFramedShare) return []
  if (!m) return ['the boss never reached its fight']
  if (m.framedShare >= budget.bossFramedShare) return []
  return [
    `the boss was shootable ${m.framedSeconds.toFixed(1)} s of its ${m.fightSeconds.toFixed(0)} s fight (${Math.round(m.framedShare * 100)}%, floor ${Math.round(budget.bossFramedShare * 100)}%), ` +
      `longest out of sight ${m.longestUnframed.seconds.toFixed(1)} s from ${m.longestUnframed.start.toFixed(1)} s`,
  ]
}
