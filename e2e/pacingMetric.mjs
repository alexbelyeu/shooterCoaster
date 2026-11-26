/**
 * Pacing (#450): how much of a run, sampled frame by frame by the smoke's `pacing` step, has nothing to shoot on screen.
 * A target counts when the rider can shoot it (#925, `__SC_TEST__.sight()`): in view, readable, and not behind the world.
 * A sample stands for the level time up to the next one; the GO grace and the boss tell are meant to be empty, so they
 * count neither way and end a gap.
 */

const GO_GRACE_SECONDS = 2
/** Boss stages after its defeat. */
const BEATEN = new Set(['defeated', 'done'])
/**
 * The player the pacing run and the ride review play as (#925): hits a game second on the nearest shootable targets
 * (`autoFire(true, rate)`). Unfired, a run kept every enemy alive and its leftovers filled the gym's empty stretches; a player
 * who shoots what they see is who meets them.
 */
export const PLAYER_HITS_PER_SECOND = 3
const LISTED_GAP_SECONDS = 1

const round = (x, places) => Number(x.toFixed(places))

/**
 * Whether sampling ended short of the run's `end`: more than `step` × 2 before it, unless the boss was beaten by then (a
 * boss win with nothing left ends the run early, #961).
 * @param {{ t: number, bossStage?: string }[]} samples
 */
export function samplingCutShort(samples, end, step) {
  const last = samples.at(-1)
  return last.t < end - 2 * step && !BEATEN.has(last.bossStage)
}

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
    // The tell is meant to be empty, and once the boss is beaten the run is its coda: neither counts.
    if (s.bossTell || BEATEN.has(s.bossStage)) return close()
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
      row = { t, min: s.targets, max: s.targets, track: round(s.track, 3), waveTell: false, bossTell: false, boss: s.bossStage ?? 'none', bossFramed: false }
      rows.push(row)
    }
    row.min = Math.min(row.min, s.targets)
    row.max = Math.max(row.max, s.targets)
    row.waveTell ||= !!s.waveTell
    row.bossTell ||= !!s.bossTell
    row.bossFramed ||= !!s.bossFramed
    if (s.bossStage) row.boss = s.bossStage
  }
  return rows
}

/** `level2 pacing: no target 23% of 60 s, longest gap 7.4 s at 31 s (track 0.52)` */
export function pacingSummary(level, m) {
  const gap = m.longestGap
    ? `longest gap ${m.longestGap.seconds.toFixed(1)} s at ${m.longestGap.start.toFixed(0)} s (track ${m.longestGap.track.toFixed(2)})`
    : 'no gap'
  const boss = m.boss
    ? `, boss shootable ${m.boss.framedSeconds.toFixed(1)} of ${m.boss.fightSeconds.toFixed(0)} s${m.boss.beatenAt != null ? ` (beaten at ${m.boss.beatenAt.toFixed(0)} s)` : ''}`
    : ''
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
 * Boss framing (#925): of the boss's fight (from its first `active` sample to its defeat or the run's end, at most `BOSS_FIGHT_SECONDS`),
 * the seconds one of its weak points was shootable (`sight().bossFramed`), and the longest stretch it was not. A ride that
 * turns away from the boss two seconds after she rises leaves the player nothing to fight.
 * @param {{ t: number, bossStage?: string, bossFramed?: boolean }[]} samples
 */
export function bossFraming(samples, end, fightSeconds = BOSS_FIGHT_SECONDS) {
  const first = samples.findIndex((s) => s.bossStage === 'active')
  if (first < 0) return null
  const from = samples[first].t
  // The fight ends at the boss's defeat (a player who beats it early has fought it, not lost sight of it).
  const beaten = samples.find((s, i) => i > first && BEATEN.has(s.bossStage))
  const until = Math.min(end, from + fightSeconds, beaten ? beaten.t : Infinity)
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
    beatenAt: beaten ? round(beaten.t, 2) : null,
    fightSeconds: round(window, 2),
    framedSeconds: round(framed, 2),
    framedShare: window > 0 ? round(framed / window, 3) : 0,
    longestUnframed: { start: round(longest.start, 2), seconds: round(longest.seconds, 2) },
    unframedSeconds: round(gap, 2),
  }
}

/**
 * Which of a level's pacing problems fail and which only warn. `knownOver: "#<open issue>"` turns them into warnings until that
 * issue lands; with `knownOverOnly: "boss"` only the boss framing floor is excused, so the gap and share still hold the level.
 * @param {{ knownOver?: string, knownOverOnly?: 'boss' } | undefined} budget
 * @param {string[]} ride `pacingBudgetProblems`
 * @param {string[]} boss `bossFramingProblems`
 */
export function pacingGate(budget, ride, boss) {
  if (!budget?.knownOver) return { fail: [...ride, ...boss], warn: [] }
  if (budget.knownOverOnly === 'boss') return { fail: ride, warn: boss }
  return { fail: [], warn: [...ride, ...boss] }
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

/** How many enemies in one aim-assist circle make a bunch one sweep clears (#1058): its longest stretch is reported. */
export const BUNCH_SWEEP = 4

/**
 * Challenge (#1058): how hard the run was for the model player. Something shootable at every moment (the gap and share
 * above) is cheapest met by a cluster parked in front of the camera; these push back.
 * - `scoreShare`: its final score over the level's `maxScore` (the stars' ratio; the score carries the combo multiplier, so it
 *   can pass 1), and `baseScoreShare`: its kills' points before the multiplier over `maxScore`.
 * - `killShare`: enemies it killed over enemies that came into play (`runTally()`).
 * - `bunching`: per level second, the most shootable enemies inside one aim-assist circle (`sight().bunch`); the seconds'
 *   90th percentile and the longest stretch of seconds with `BUNCH_SWEEP` or more.
 * - `bossSeconds`: the boss's arrival to its defeat; null when it was not beaten.
 * @param {{ t: number, bunch?: number }[]} samples
 * @param {{ score: number, maxScore: number, spawned: number, killed: number, basePoints?: number }} run
 * @param {ReturnType<typeof bossFraming>} boss
 */
export function challengeMetrics(samples, run, boss) {
  const seconds = []
  for (const s of samples) {
    const t = Math.floor(s.t)
    const row = seconds.at(-1)
    if (row?.t === t) row.max = Math.max(row.max, s.bunch ?? 0)
    else seconds.push({ t, max: s.bunch ?? 0 })
  }
  const sorted = seconds.map((r) => r.max).sort((a, b) => a - b)
  const p90 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)] : 0
  let longest = null
  let open = null
  for (const r of seconds) {
    if (r.max >= BUNCH_SWEEP && open && r.t === open.start + open.seconds) open.seconds++
    else open = r.max >= BUNCH_SWEEP ? { start: r.t, seconds: 1 } : null
    if (open && (!longest || open.seconds > longest.seconds)) longest = { ...open }
  }
  return {
    scoreShare: run.maxScore > 0 ? round(run.score / run.maxScore, 3) : 0,
    baseScoreShare: run.maxScore > 0 ? round((run.basePoints ?? 0) / run.maxScore, 3) : 0,
    killShare: run.spawned > 0 ? round(run.killed / run.spawned, 3) : 0,
    killed: run.killed,
    spawned: run.spawned,
    bunchingP90: p90,
    bunchingMax: sorted.at(-1) ?? 0,
    longestBunch: longest,
    bossSeconds: boss?.beatenAt != null ? round(boss.beatenAt - boss.arrivedAt, 2) : null,
  }
}

/** `score 186% of max (base 72%), killed 92% (120 of 130), bunching p90 3 (4+ for 6 s from 12 s), boss down in 7.5 s` */
export function challengeSummary(c) {
  const bunch = c.longestBunch ? ` (${BUNCH_SWEEP}+ for ${c.longestBunch.seconds} s from ${c.longestBunch.start} s)` : ''
  const boss = c.bossSeconds != null ? `, boss down in ${c.bossSeconds.toFixed(1)} s` : ', boss not beaten'
  return `score ${(c.scoreShare * 100).toFixed(0)}% of max (base ${(c.baseScoreShare * 100).toFixed(0)}%), killed ${(c.killShare * 100).toFixed(0)}% (${c.killed} of ${c.spawned}), ` +
    `bunching p90 ${c.bunchingP90}${bunch}${boss}`
}

/**
 * A level's challenge limits: budgets.json `challenge._default` under its own `challenge.<level>` (#1058). A separate section
 * from `pacing`, with its own `knownOver`, so excusing an easy level never excuses a gap.
 * The share gate is on `baseScoreShare`: with the combo multiplier the final score runs 1.7 to 4.3 times `maxScore`, so a
 * ceiling on it would say nothing a level's tuning can change.
 * @returns {{ baseScoreShareMax?: number, bunchingP90Max?: number, bossSecondsMin?: number, knownOver?: string }}
 */
export function challengeBudget(budgets, level) {
  const section = budgets?.challenge ?? {}
  return { ...section._default, ...section[level] }
}

/** Problems against the limits, as `{ fail, warn }`: all warnings while `knownOver` names the issue that fixes the level. */
export function challengeGate(c, budget) {
  const problems = []
  if (budget.baseScoreShareMax != null && c.baseScoreShare > budget.baseScoreShareMax) {
    problems.push(`base score ${(c.baseScoreShare * 100).toFixed(0)}% of max over ${(budget.baseScoreShareMax * 100).toFixed(0)}%`)
  }
  if (budget.bunchingP90Max != null && c.bunchingP90 > budget.bunchingP90Max) {
    problems.push(`bunching p90 ${c.bunchingP90} in one aim-assist circle over ${budget.bunchingP90Max}`)
  }
  if (budget.bossSecondsMin != null && c.bossSeconds != null && c.bossSeconds < budget.bossSecondsMin) {
    problems.push(`boss down in ${c.bossSeconds.toFixed(1)} s, under ${budget.bossSecondsMin} s`)
  }
  return budget.knownOver ? { fail: [], warn: problems } : { fail: problems, warn: [] }
}
