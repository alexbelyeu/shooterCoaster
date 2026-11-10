// Pure rules for the studio-health watchdog (scripts/studio-health.cjs): a repo snapshot in, findings out
// ({ key, title, owner, body, lastSeen, state? }), one watchdog issue per `key`. Findings from runs ignore runs
// older than their key's last close, so closing after a fix sticks; `state` findings (true right now) refile
// for as long as they hold.

const { SCHEDULE, nextRun } = require('./studio-status.cjs')
const { telemetryFindings } = require('./playerTelemetry.cjs')

const HOUR = 3600e3

/** Files that can't change what the game does or how CI tests it (docs/audio/ is read by unit tests). */
const NO_GAME_EFFECT = /^(?!docs\/audio\/)(docs\/|\.claude\/(agents|commands)\/|[^/]+\.md$|.*\/[^/]+\.md$)/
/** Files that can change how the game builds or what its checks see: a main commit touching none of them can't fix a red check. */
const CAN_FIX_A_CHECK = /^(src|e2e|public|api|scripts)\/|^\.github\/workflows\/|^(budgets\.json|package(-lock)?\.json|vite\.config\.ts|index\.html|tsconfig[^/]*\.json)$/
/** Jobs that play the game; a failure there on a PR that touched no game code is not the PR's fault. */
const GAME_JOB = /^(verify|portal|smoke\b|deploy|nightly)/
/** Jobs on main whose failure already opens `agent:prod-broken` (ci.yml's `verify` gate and what it needs; prod-alert.cjs). */
const ALERTED_ON_MAIN = {
  '.github/workflows/ci.yml': /^(verify|changes|unit|lighthouse|smoke)\b/,
  '.github/workflows/prod-smoke.yml': /./,
}
/** prod-smoke.yml's nightly runs at 06:00 UTC: older than this, GitHub's cron ran late or skipped it (#487). */
const NIGHTLY_OVERDUE = 26 * HOUR
/** How long a scheduled run gets to finish and post to the token ledger before it counts as missed. */
const SLOT_GRACE = 2 * HOUR
const STALL_SLOTS = 2
/** A run over this many weighted tokens is filed (`heavy:<role>`): a typical run is 0.1–2.5M. */
const HEAVY_RUN = 5e6

/** ci.yml's `verify` gate fails whenever a job it needs fails: that failure is filed once, under the job (#401). */
const isGateEcho = (r, job) =>
  r.path === '.github/workflows/ci.yml' && job.name === 'verify' &&
  (r.jobs || []).some((j) => j !== job && (j.conclusion === 'failure' || j.conclusion === 'timed_out' || j.timedOut))

const isDocsOnly = (files) => files.length > 0 && files.every((f) => NO_GAME_EFFECT.test(f))

/** A matrix job's name without its matrix part: "smoke (${{ matrix.shard }})" in YAML, "smoke (level1)" from the API. */
const baseJob = (name) => name.replace(/\s*\(.*\)$/, '')

/**
 * Did the runner stop this job or a step at its `timeout-minutes`? Only GitHub's own wording counts: a test's
 * failure message may say "timed out" too (vitest's "Test timed out in 5000ms", #495), and that is a failed test.
 */
const RUNNER_TIMEOUT = /^The job running on runner .* has exceeded the maximum execution time of|^The action '.*' has timed out after \d+ minutes/
const runnerTimedOut = (failureMessages) => failureMessages.some((m) => RUNNER_TIMEOUT.test(m))

/** Job- and step-level `timeout-minutes` from a workflow file, keyed by job name (or id; a matrix job by its base name) and "job / step". */
function parseTimeouts(yamlText) {
  const out = {}
  const lines = yamlText.split('\n')
  let inJobs = false
  let job = null
  let step = null
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, '')
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue }
    if (!inJobs) continue
    if (/^\S/.test(line)) { inJobs = false; continue }
    let m
    if ((m = line.match(/^ {2}([\w-]+):\s*$/))) { job = { id: m[1], name: m[1] }; step = null; continue }
    if (!job) continue
    if ((m = line.match(/^ {4}name:\s*(.+)$/))) {
      const name = baseJob(m[1].trim().replace(/^['"]|['"]$/g, ''))
      if (out[job.name] !== undefined) { out[name] = out[job.name]; delete out[job.name] }
      job.name = name
      continue
    }
    if ((m = line.match(/^ {4}timeout-minutes:\s*(\d+)/))) { out[job.name] = Number(m[1]); continue }
    if ((m = line.match(/^ {6}- (?:name:\s*(.+))?/))) { step = m[1] ? m[1].trim().replace(/^['"]|['"]$/g, '') : null; continue }
    if ((m = line.match(/^ {8}name:\s*(.+)$/))) { step = m[1].trim().replace(/^['"]|['"]$/g, ''); continue }
    if ((m = line.match(/^ {8}timeout-minutes:\s*(\d+)/)) && step) out[`${job.name} / ${step}`] = Number(m[1])
  }
  return out
}

/** The limit of a job (or one of its steps) as the API names it ("smoke (level1)" is a "smoke" job), or null. */
function timeoutFor(timeouts, jobName, stepName) {
  const key = (job) => (stepName ? `${job} / ${stepName}` : job)
  return timeouts[key(jobName)] ?? timeouts[key(baseJob(jobName))] ?? null
}

/** Scheduled times of `who` (studio-status.cjs SCHEDULE) after `from` that are over SLOT_GRACE old at `now`. */
function missedSlots(who, from, now) {
  const entry = SCHEDULE.find((s) => s.who === who)
  const out = []
  for (let at = nextRun(entry, from); at <= now - SLOT_GRACE; at = nextRun(entry, at)) out.push(at)
  return out
}

/** Limits are main's; a job that ran well past one ran an older workflow file (a PR behind main). */
const applies = (limit, mins) => Boolean(limit) && mins <= limit + 2
const minutes = (job) => (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 60e3
const failedStep = (job) => (job.steps || []).find((s) => s.conclusion === 'failure')?.name || null
const runLink = (r) => `[${r.name} ${r.head_sha.slice(0, 7)}](${r.html_url})`
const isMainRun = (r) => r.head_branch === 'main' && r.event !== 'pull_request'
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}

/**
 * The next run of `r`'s workflow on a later main commit, if `jobName` passed there and the commits between touched no
 * file that could fix a check (#487: `smoke (level2)` red on main, green on the next commit, nothing relevant changed).
 */
function nextMainPass(snap, mainRuns, r, jobName) {
  const next = mainRuns.find((m) => m.path === r.path && m.head_sha !== r.head_sha && Date.parse(m.created_at) > Date.parse(r.created_at) &&
    (m.jobs || []).some((j) => j.name === jobName))
  if (!next || !next.jobs.some((j) => j.name === jobName && j.conclusion === 'success')) return null
  const files = snap.mainDiffs?.[`${r.head_sha}...${next.head_sha}`]
  return files && !files.some((f) => CAN_FIX_A_CHECK.test(f)) ? next : null
}

/**
 * snapshot: {
 *   now, runs: [{ id, name, path, event, conclusion, head_branch, head_sha, created_at, html_url, prNumber,
 *                 jobs?: [{ name, conclusion, started_at, completed_at, steps, html_url, timedOut?, errors? }] }],
 *   prFiles: { [prNumber]: string[] }, mainDiffs: { ['<sha>...<sha>']: string[] }, timeouts: { [workflowPath]: { [jobOrStep]: minutes } },
 *   openPrs: [{ number, title, labels: string[], created_at, updated_at, labelledAt?: { [label]: iso } }],
 *   openIssues: [{ number, title, labels: string[], created_at, fixMergedAt?: ms | null, nightlyAlert?: boolean }],
 *   prod: { nightly: { at, conclusion } | null, deploy: { at, conclusion } | null } (the newest of each prod-smoke.yml suite),
 *   closedAt: { [key]: ms }, lastAgentActivity: ms | null, paused: boolean,
 * }
 */
function findings(snap) {
  const out = []
  const { now } = snap
  const closedAt = snap.closedAt || {}
  const runs = snap.runs.filter((r) => r.conclusion)
  const at = (r) => Date.parse(r.created_at)
  const fresh = (key, r) => at(r) > (closedAt[key] || 0)
  const byTime = (a, b) => at(a) - at(b)

  // 1. main is red in a workflow that doesn't already alert: its newest completed run on main failed.
  const newestOnMain = {}
  for (const r of runs) {
    if (!isMainRun(r) || !['failure', 'success', 'timed_out'].includes(r.conclusion)) continue
    if (!newestOnMain[r.path] || at(r) > at(newestOnMain[r.path])) newestOnMain[r.path] = r
  }
  for (const r of Object.values(newestOnMain)) {
    const key = `main-red:${r.path}`
    if (r.conclusion === 'success' || !fresh(key, r)) continue
    const alerted = ALERTED_ON_MAIN[r.path]
    const failed = (r.jobs || []).filter((j) => j.conclusion === 'failure' || j.conclusion === 'timed_out')
    const unalerted = alerted ? failed.filter((j) => !alerted.test(j.name)) : failed
    if (alerted && !unalerted.length) continue
    const job = unalerted[0]
    const where = job ? `${job.name}${failedStep(job) ? ` / ${failedStep(job)}` : ''}` : 'a job'
    out.push({
      lastSeen: at(r),
      key,
      title: `main is red: ${r.name} (${where})`,
      owner: 'agents',
      body: `The newest run of **${r.name}** on \`main\` failed at **${where}**: ${runLink(r)}. Nothing else alerts on this one.\n\n` +
        'If a merge caused it, follow PROTOCOL.md "When main breaks": revert first, investigate second. ' +
        'If the workflow itself is broken, find the cause in the run (check-run annotations, the job log) and fix it on a branch. ' +
        'Hard rule 1: main must stay green. If the check itself is wrong, fix the check; never weaken it to pass.',
    })
  }

  // 2. Flaky checks: a game job failed where the change can't have caused it. "Passed on the same commit" means the
  // same job: one workflow can run different jobs on one commit (prod-smoke.yml's `deploy` and `nightly`).
  const jobPassed = new Set()
  for (const r of runs) for (const j of r.jobs || []) if (j.conclusion === 'success') jobPassed.add(`${r.path}@${r.head_sha}@${j.name}`)
  const mainRuns = runs.filter(isMainRun).sort(byTime)
  /** Was the newest run of this workflow on main, before `r`, a failure? Then a docs-only PR inherits it. */
  const mainRedAt = (r) => {
    const before = mainRuns.filter((m) => m.path === r.path && at(m) < at(r)).pop()
    return before ? before.conclusion !== 'success' : false
  }
  const flaky = {}
  for (const r of runs) {
    if (r.conclusion !== 'failure') continue
    const docsOnly = r.prNumber && snap.prFiles[r.prNumber] && isDocsOnly(snap.prFiles[r.prNumber]) && !mainRedAt(r)
    for (const job of r.jobs || []) {
      // A timed-out job is filed as a timeout below, not as a flake.
      if (job.conclusion !== 'failure' || job.timedOut || !GAME_JOB.test(job.name)) continue
      if (isGateEcho(r, job)) continue
      const next = isMainRun(r) && nextMainPass(snap, mainRuns, r, job.name)
      const why = docsOnly ? `PR #${r.prNumber} touches docs only`
        : jobPassed.has(`${r.path}@${r.head_sha}@${job.name}`) ? 'the same commit passed on another run'
        : next ? `passed on the next main commit (${runLink(next)}), which touched nothing a check depends on`
        : null
      if (!why) continue
      const step = failedStep(job) || 'unknown step'
      const name = `${baseJob(job.name)} / ${step}`
      if (!fresh(`flaky:${name}`, r)) continue
      flaky[name] = flaky[name] || []
      flaky[name].lastSeen = Math.max(flaky[name].lastSeen || 0, at(r))
      const err = job.errors?.length ? `: \`${job.errors[0].slice(0, 160)}\`` : ''
      flaky[name].push(`- ${runLink(r)}: ${why} ([job](${job.html_url}))${err}`)
    }
  }
  for (const [name, lines] of Object.entries(flaky)) {
    out.push({
      lastSeen: lines.lastSeen,
      key: `flaky:${name}`,
      title: `Flaky check: ${name} (${lines.length} in 48 h)`,
      owner: 'agents',
      body: `**${name}** failed where the change under test can't have caused it:\n\n${lines.join('\n')}\n\n` +
        'A check that fails for nothing trains everyone to ignore it. Read the FAIL line in each job log, find the shared cause ' +
        '(timing, test order, state left by an earlier step, the runner), and make the check deterministic. Don\'t retry it, raise a timeout, or loosen it to make it pass.',
    })
  }

  // 3. Timeouts and runtime creep: a job or step at or near its time limit.
  const durations = {}
  for (const r of runs) {
    const limits = snap.timeouts[r.path] || {}
    for (const job of r.jobs || []) {
      if (!job.started_at || !job.completed_at) continue
      const jobLimit = timeoutFor(limits, job.name)
      const limit = applies(jobLimit, minutes(job)) ? jobLimit : null
      // Past main's limit, GitHub's timed-out mark is an older workflow file's limit too.
      const timedOut = Boolean(job.timedOut && (!jobLimit || limit))
      // A step with its own limit that ran out (the job then still has time to report).
      const step = (job.steps || []).find((s) => {
        const stepLimit = timeoutFor(limits, job.name, s.name)
        return s.started_at && s.completed_at && applies(stepLimit, minutes(s)) && minutes(s) >= stepLimit - 0.5
      })
      const timedOutStep = timedOut ? (job.steps || []).find((s) => s.conclusion === 'failure' || s.conclusion === 'cancelled') : null
      const stopped = step || timedOutStep
      const where = stopped ? `${job.name} / ${stopped.name}` : job.name
      const key = `timeout:${r.path}:${where}`
      if ((step || timedOut || (limit && minutes(job) >= limit - 0.5)) && fresh(key, r)) {
        const stepLimit = step ? timeoutFor(limits, job.name, step.name) : timedOutStep && minutes(timedOutStep) < (limit ?? Infinity) - 0.5 ? Math.round(minutes(timedOutStep)) : limit ?? Math.round(minutes(job))
        const seen = out.find((f) => f.key === key)
        if (seen) seen.lastSeen = Math.max(seen.lastSeen, at(r))
        else {
          out.push({
            lastSeen: at(r),
            key,
            title: `Timeout: ${where} hit its ${stepLimit} min limit`,
            owner: 'agents',
            body: `**${where}** ran out of time in ${runLink(r)}. A timeout reports no check result, so it hides whether anything is actually wrong.\n\n` +
              'Make the job fit with headroom (split it, drop duplicated work, move slow checks off the PR gate). Raising the limit only moves the cliff.',
          })
        }
      }
      if (job.conclusion === 'success' && limit) {
        const k = `${r.path}::${baseJob(job.name)}`
        if (!fresh(`creep:${k}`, r)) continue
        durations[k] = durations[k] || { limit, mins: [], lastSeen: 0 }
        durations[k].mins.push(minutes(job))
        durations[k].lastSeen = Math.max(durations[k].lastSeen, at(r))
      }
    }
  }
  for (const [k, d] of Object.entries(durations)) {
    if (d.mins.length < 3) continue
    const med = median(d.mins)
    if (med < 0.75 * d.limit) continue
    const job = k.split('::')[1]
    out.push({
      lastSeen: d.lastSeen,
      key: `creep:${k}`,
      title: `Runtime creep: ${job} takes ${med.toFixed(0)} of its ${d.limit} min limit`,
      owner: 'agents',
      body: `Over its last ${d.mins.length} successful runs **${job}** took a median **${med.toFixed(1)} min** against a ${d.limit} min limit (≥ 75 %). ` +
        'The next few added checks will push it into timeouts. Cut its runtime now: duplicated work, checks that belong in unit tests, or work that belongs in the nightly run.',
    })
  }

  // 4. The studio stopped. Runs with nothing to do don't post by design, so only slots with work queued count.
  if (!snap.paused) {
    // A slot counts only once its role had work queued (the oldest queued item's label; unknown = before the window),
    // after the last pause ended, and (Builders) while the day's `builder_runs_per_day` was not yet spent.
    const labelled = (x, label) => (x.labelledAt?.[label] ? Date.parse(x.labelledAt[label]) : -Infinity)
    const builderQueue = [
      ...snap.openIssues.filter((i) => i.labels.includes('agent:ready') && !i.labels.includes('epic')).map((i) => labelled(i, 'agent:ready')),
      ...snap.openPrs.filter((p) => p.labels.includes('agent:changes-requested')).map((p) => labelled(p, 'agent:changes-requested')),
    ]
    const qaQueue = snap.openPrs.filter((p) => p.labels.includes('agent:needs-qa')).map((p) => labelled(p, 'agent:needs-qa'))
    const builderWork = builderQueue.length
    const qaWork = qaQueue.length
    const from = (queue) => Math.max(snap.lastAgentActivity ?? now - 48 * HOUR, snap.pauseEndedAt ?? -Infinity, Math.min(...queue))
    const budget = snap.builderBudget ?? Infinity
    const budgetSpent = (t) => (snap.builderRuns || []).filter((b) => b <= t && b > t - 24 * HOUR).length >= budget
    const missed = [
      ...(builderWork ? missedSlots('Builders', from(builderQueue), now).filter((t) => !budgetSpent(t)) : []),
      ...(qaWork ? missedSlots('QA', from(qaQueue), now) : []),
    ]
    if (missed.length >= STALL_SLOTS) {
      const last = snap.lastAgentActivity == null ? 'none in 48 h' : new Date(snap.lastAgentActivity).toISOString().slice(0, 16) + 'Z'
      out.push({
        state: true,
        lastSeen: now,
        key: 'stalled',
        title: `Studio stalled: ${missed.length} scheduled runs passed with no agent run logged`,
        owner: 'alex',
        body: `${builderWork} items wait for builders and ${qaWork} PRs for QA, but ${missed.length} scheduled Builders / QA runs have passed since the last token-ledger post (${last}). ` +
          'Every runbook ends by posting there, so the scheduled tasks are probably not running or are exiting early (disabled, no GitHub credentials, a broken setup step).\n\n' +
          'Check the "ShooterCoaster ·" scheduled tasks: their last runs and how long they took. A run that ends in under a minute did nothing.',
      })
    }
  }

  // 5. Stuck PRs, timed from when the label was added.
  const since = (p, label) => Date.parse(p.labelledAt?.[label] || p.updated_at)
  for (const p of snap.openPrs) {
    if (!p.labels.includes('agent:qa-approved')) continue
    const age = now - since(p, 'agent:qa-approved')
    if (age <= 3 * HOUR) continue
    out.push({
      state: true,
      lastSeen: now,
      key: `stuck-approved:${p.number}`,
      title: `Approved but not merged for ${Math.floor(age / HOUR)} h: #${p.number}`,
      owner: 'agents',
      body: `#${p.number} (${p.title}) has been \`agent:qa-approved\` for over 3 h and auto-merge hasn't merged it. ` +
        'Read its latest "Auto-merge" comment and its `verify` check, then fix whatever blocks it (red check, conflict, a gap in `scripts/automerge.cjs`).',
    })
  }
  const waiting = snap.openPrs.filter((p) => p.labels.includes('agent:needs-qa') && now - since(p, 'agent:needs-qa') > 24 * HOUR)
  if (waiting.length) {
    out.push({
      state: true,
      lastSeen: now,
      key: 'qa-backlog',
      title: `QA backlog: ${waiting.length} PRs waiting over 24 h`,
      owner: 'agents',
      body: `Waiting for review for over a day: ${waiting.map((p) => `#${p.number}`).join(', ')}. ` +
        'Find why QA isn\'t keeping up (runs failing or exiting early, reviews too slow, runs spent on other work) and fix the cause, not just these PRs.',
    })
  }

  // Token-heavy runs, one issue per role (from the token ledger's JSON lines). Closing the issue
  // settles the runs it listed: only a run newer than the close files it again.
  const heavy = {}
  for (const r of snap.ledgerRuns || []) {
    if (r.weighted <= HEAVY_RUN || now - r.at > 48 * HOUR || r.at <= (closedAt[`heavy:${r.role}`] || 0)) continue
    ;(heavy[r.role] = heavy[r.role] || []).push(r)
  }
  for (const [role, runs] of Object.entries(heavy)) {
    const M = (n) => `${(n / 1e6).toFixed(1)}M`
    const lines = runs.map((r) => {
      const waste = r.missTokens ? `, ${M(r.missTokens)} of it ${r.misses} cache misses${r.missesAfter.length ? ` (after: ${r.missesAfter.map((a) => `\`${a.slice(0, 80)}\``).join(', ')})` : ''}` : ''
      const big = r.heaviest.length ? `; heaviest results: ${r.heaviest.join(', ')}` : ''
      const K = (n) => `${Math.round(n / 1e3)}k`
      const byAgent = (r.agents || []).length > 1
        ? `; by agent: ${r.agents.map((a) => `${a.agent === 0 ? 'main' : `#${a.agent}`} ${M(a.weighted)} / ${a.turns} turns / peak ${K(a.peakContext)}`).join(', ')}`
        : ''
      return `- [${r.ref || 'no ref'}](${r.url}): ${M(r.weighted)} weighted tokens in ${r.minutes ?? '?'} min${waste}${byAgent}${big}`
    })
    out.push({
      key: `heavy:${role}`,
      title: `Token-heavy ${role} runs: ${runs.length} over ${HEAVY_RUN / 1e6}M in 48 h`,
      owner: 'agents',
      lastSeen: Math.max(...runs.map((r) => r.at)),
      body: `${role} runs over ${HEAVY_RUN / 1e6}M weighted tokens (a typical run is 0.1–2.5M):\n\n${lines.join('\n')}\n\n` +
        'Find where the tokens went (the ledger line\'s `diag`: cache misses after idle waits, re-read files, large tool results) ' +
        'and fix the cause in the role or runbook (`.claude/agents/`, `docs/agents/runbooks/`), not just the run. ' +
        'Usual causes: sleeping or polling past 5 minutes (each wake re-reads the whole context), a foreground command over ~4.5 minutes (the same idle gap: a whole smoke shard chained after test + build), running the full smoke or `verify` locally, `cat` of big files or logs, hundreds of turns at a 200k+ context.',
    })
  }

  // Real players (#373): errors in several sessions, levels slow on phones.
  out.push(...telemetryFindings(snap.telemetry, { closedAt: snap.closedAt, budget: snap.phoneFrameBudget }))

  return out
}

const oldProdAlerts = (snap) =>
  snap.openIssues.filter((i) => i.labels.includes('agent:prod-broken') && snap.now - Date.parse(i.created_at) > 12 * HOUR)

/**
 * An old alert whose fix has merged and shipped, waiting only on the nightly to run green and close it (#487: #469 sat
 * open behind a late cron and was escalated though fixed): a fix PR linked to it merged, the deploy check went green
 * after that, and no nightly has gone red since.
 */
function awaitsNightly(snap, issue) {
  // Only the nightly suite's own alert (prod-alert.cjs marker) is closed by a green nightly; a red-main alert from ci.yml is not.
  if (!issue.nightlyAlert) return false
  const fixed = issue.fixMergedAt
  const { deploy, nightly } = snap.prod || {}
  if (!fixed || !deploy || deploy.conclusion !== 'success' || deploy.at < fixed) return false
  return !(nightly && nightly.at > fixed && nightly.conclusion && nightly.conclusion !== 'success')
}

/** Open `agent:prod-broken` issues (prod-alert.cjs or a red main in ci.yml) older than 12 h: escalated to Alex in place. */
const staleProdAlerts = (snap) => oldProdAlerts(snap).filter((i) => !awaitsNightly(snap, i))
/** Old alerts not escalated because they only wait for the nightly to confirm the fix. */
const waitingProdAlerts = (snap) => oldProdAlerts(snap).filter((i) => awaitsNightly(snap, i))

/** The newest nightly started over NIGHTLY_OVERDUE ago (or none in the window): the watchdog dispatches one (#487). */
const nightlyOverdue = (snap) => !snap.prod?.nightly || snap.now - snap.prod.nightly.at > NIGHTLY_OVERDUE

module.exports = { findings, staleProdAlerts, waitingProdAlerts, nightlyOverdue, parseTimeouts, runnerTimedOut, isDocsOnly, ALERTED_ON_MAIN }
