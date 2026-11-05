// Pure rules for the studio-health watchdog (scripts/studio-health.cjs): a repo snapshot in, findings out
// ({ key, title, owner, body, lastSeen, state? }), one watchdog issue per `key`. Findings from runs ignore runs
// older than their key's last close, so closing after a fix sticks; `state` findings (true right now) refile
// for as long as they hold.

const { SCHEDULE, nextRun } = require('./studio-status.cjs')

const HOUR = 3600e3

/** Files that can't change what the game does or how CI tests it (docs/audio/ is read by unit tests). */
const NO_GAME_EFFECT = /^(?!docs\/audio\/)(docs\/|\.claude\/(agents|commands)\/|[^/]+\.md$|.*\/[^/]+\.md$)/
/** Jobs that play the game; a failure there on a PR that touched no game code is not the PR's fault. */
const GAME_JOB = /^(verify|portal|smoke\b|deploy|nightly)/
/** Jobs on main whose failure already opens `agent:prod-broken` (ci.yml's `verify` gate and what it needs; prod-alert.cjs). */
const ALERTED_ON_MAIN = {
  '.github/workflows/ci.yml': /^(verify|unit|lighthouse|smoke)\b/,
  '.github/workflows/prod-smoke.yml': /./,
}
/** How long a scheduled run gets to finish and post to the token ledger before it counts as missed. */
const SLOT_GRACE = 2 * HOUR
const STALL_SLOTS = 2

const isDocsOnly = (files) => files.length > 0 && files.every((f) => NO_GAME_EFFECT.test(f))

/** Job- and step-level `timeout-minutes` from a workflow file, keyed by job name (or id) and "job / step". */
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
      const name = m[1].trim().replace(/^['"]|['"]$/g, '')
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

/** The timeout for a job as the API names it ("smoke (level1)" matches a "smoke" job), or null. */
function timeoutFor(timeouts, jobName) {
  if (timeouts[jobName] !== undefined) return timeouts[jobName]
  const base = jobName.replace(/\s*\(.*\)$/, '')
  return timeouts[base] ?? null
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
const baseJob = (name) => name.replace(/\s*\(.*\)$/, '')
const isMainRun = (r) => r.head_branch === 'main' && r.event !== 'pull_request'
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}

/**
 * snapshot: {
 *   now, runs: [{ id, name, path, event, conclusion, head_branch, head_sha, created_at, html_url, prNumber,
 *                 jobs?: [{ name, conclusion, started_at, completed_at, steps, html_url, timedOut?, errors? }] }],
 *   prFiles: { [prNumber]: string[] }, timeouts: { [workflowPath]: { [jobOrStep]: minutes } },
 *   openPrs: [{ number, title, labels: string[], created_at, updated_at, labelledAt?: { [label]: iso } }],
 *   openIssues: [{ number, title, labels: string[], created_at }],
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

  // 2. Flaky checks: a game job failed where the change can't have caused it.
  const shaOutcome = {}
  for (const r of runs) {
    const k = `${r.path}@${r.head_sha}`
    shaOutcome[k] = shaOutcome[k] || new Set()
    shaOutcome[k].add(r.conclusion)
  }
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
    const passedSameSha = shaOutcome[`${r.path}@${r.head_sha}`]?.has('success')
    if (!docsOnly && !passedSameSha) continue
    for (const job of r.jobs || []) {
      // A timed-out job is filed as a timeout below, not as a flake.
      if (job.conclusion !== 'failure' || job.timedOut || !GAME_JOB.test(job.name)) continue
      const step = failedStep(job) || 'unknown step'
      const name = `${baseJob(job.name)} / ${step}`
      if (!fresh(`flaky:${name}`, r)) continue
      flaky[name] = flaky[name] || []
      flaky[name].lastSeen = Math.max(flaky[name].lastSeen || 0, at(r))
      const err = job.errors?.length ? `: \`${job.errors[0].slice(0, 160)}\`` : ''
      flaky[name].push(`- ${runLink(r)}: ${docsOnly ? `PR #${r.prNumber} touches docs only` : 'the same commit passed on another run'} ([job](${job.html_url}))${err}`)
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
      const limit = applies(timeoutFor(limits, job.name), minutes(job)) ? timeoutFor(limits, job.name) : null
      // A step with its own limit that ran out (the job then still has time to report).
      const step = (job.steps || []).find((s) => {
        const stepLimit = limits[`${job.name} / ${s.name}`]
        return s.started_at && s.completed_at && applies(stepLimit, minutes(s)) && minutes(s) >= stepLimit - 0.5
      })
      const timedOutStep = job.timedOut ? (job.steps || []).find((s) => s.conclusion === 'failure' || s.conclusion === 'cancelled') : null
      const stopped = step || timedOutStep
      const where = stopped ? `${job.name} / ${stopped.name}` : job.name
      const key = `timeout:${r.path}:${where}`
      if ((step || job.timedOut || (limit && minutes(job) >= limit - 0.5)) && fresh(key, r)) {
        const stepLimit = step ? limits[`${job.name} / ${step.name}`] : timedOutStep && minutes(timedOutStep) < (limit ?? Infinity) - 0.5 ? Math.round(minutes(timedOutStep)) : limit ?? Math.round(minutes(job))
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
    const builderWork = snap.openIssues.filter((i) => i.labels.includes('agent:ready') && !i.labels.includes('epic')).length +
      snap.openPrs.filter((p) => p.labels.includes('agent:changes-requested')).length
    const qaWork = snap.openPrs.filter((p) => p.labels.includes('agent:needs-qa')).length
    const from = snap.lastAgentActivity ?? now - 48 * HOUR
    const missed = [
      ...(builderWork ? missedSlots('Builders', from, now) : []),
      ...(qaWork ? missedSlots('QA', from, now) : []),
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

  return out
}

/** Open `agent:prod-broken` issues (prod-alert.cjs or a red main in ci.yml) older than 12 h: escalated to Alex in place. */
const staleProdAlerts = (snap) =>
  snap.openIssues.filter((i) => i.labels.includes('agent:prod-broken') && snap.now - Date.parse(i.created_at) > 12 * HOUR)

module.exports = { findings, staleProdAlerts, parseTimeouts, isDocsOnly }
