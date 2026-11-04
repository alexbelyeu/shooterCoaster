// Pure rules for the studio-health watchdog (scripts/studio-health.cjs): no network, unit-tested in
// scripts/studioHealth.test.ts. Every rule turns a snapshot of the repo (workflow runs, jobs, PRs, issues,
// the token ledger's last activity) into findings: { key, title, owner, body }. `key` is stable while the
// problem lasts, so the watchdog keeps one issue per problem; `owner` is 'agents' (builders fix it) or
// 'alex' (only Alex can: account, credentials, settings).

const HOUR = 3600e3

/** Files that can't change what the game does or how CI tests it. */
const NO_GAME_EFFECT = /^(docs\/|\.claude\/(agents|commands)\/|[^/]+\.md$|.*\/[^/]+\.md$)/
/** Jobs that play the game; a failure there on a PR that touched no game code is not the PR's fault. */
const GAME_JOB = /^(verify|portal|smoke\b|deploy|nightly)/

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

const minutes = (job) => (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 60e3
const failedStep = (job) => (job.steps || []).find((s) => s.conclusion === 'failure')?.name || null
const runLink = (r) => `[${r.name} ${r.head_sha.slice(0, 7)}](${r.html_url})`
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}

/**
 * snapshot: {
 *   now, runs: [{ id, name, path, event, conclusion, head_branch, head_sha, created_at, html_url, prNumber,
 *                 jobs?: [{ name, conclusion, started_at, completed_at, steps, html_url, timedOut? }] }],
 *   prFiles: { [prNumber]: string[] }, timeouts: { [workflowPath]: { [jobOrStep]: minutes } },
 *   openPrs: [{ number, title, labels: string[], created_at, updated_at, labelledAt? }],
 *   openIssues: [{ number, title, labels: string[], created_at }],
 *   lastAgentActivity: ms | null, paused: boolean,
 * }
 */
function findings(snap) {
  const out = []
  const { now } = snap
  const runs = snap.runs.filter((r) => r.conclusion)

  // 1. main is red: the newest completed run of each workflow on main failed.
  const byWorkflow = {}
  for (const r of runs) {
    if (r.head_branch !== 'main' || r.event === 'pull_request') continue
    if (!['failure', 'success', 'timed_out'].includes(r.conclusion)) continue
    const prev = byWorkflow[r.path]
    if (!prev || Date.parse(r.created_at) > Date.parse(prev.created_at)) byWorkflow[r.path] = r
  }
  for (const r of Object.values(byWorkflow)) {
    if (r.conclusion === 'success') continue
    const job = (r.jobs || []).find((j) => j.conclusion === 'failure' || j.conclusion === 'timed_out')
    const where = job ? `${job.name}${failedStep(job) ? ` / ${failedStep(job)}` : ''}` : 'a job'
    out.push({
      lastSeen: Date.parse(r.created_at),
      key: `main-red:${r.path}`,
      title: `main is red: ${r.name} (${where})`,
      owner: 'agents',
      body: `The newest run of **${r.name}** on \`main\` failed at **${where}**: ${runLink(r)}.\n\n` +
        'Find the cause in the run (check-run annotations, the job log, `results.json` in the artifact), fix it on a branch, and say in the PR whether it was the code or the test. ' +
        'Hard rule 1: main must stay green. If the check itself is wrong, fix the check; never weaken it to pass.',
    })
  }

  // 2. Flaky checks: a game job failed where the change can't have caused it.
  const flaky = {}
  const shaOutcome = {}
  for (const r of runs) {
    const k = `${r.path}@${r.head_sha}`
    shaOutcome[k] = shaOutcome[k] || new Set()
    shaOutcome[k].add(r.conclusion)
  }
  for (const r of runs) {
    if (r.conclusion !== 'failure') continue
    const docsOnly = r.prNumber && snap.prFiles[r.prNumber] && isDocsOnly(snap.prFiles[r.prNumber])
    const passedSameSha = shaOutcome[`${r.path}@${r.head_sha}`]?.has('success')
    if (!docsOnly && !passedSameSha) continue
    for (const job of r.jobs || []) {
      if (job.conclusion !== 'failure' || !GAME_JOB.test(job.name)) continue
      const step = failedStep(job) || 'unknown step'
      const key = `${job.name.replace(/\s*\(.*\)$/, '')} / ${step}`
      flaky[key] = flaky[key] || []
      flaky[key].lastSeen = Math.max(flaky[key].lastSeen || 0, Date.parse(r.created_at))
      const err = job.errors?.length ? `: \`${job.errors[0].slice(0, 160)}\`` : ''
      flaky[key].push(`- ${runLink(r)}: ${docsOnly ? `PR #${r.prNumber} touches docs only` : 'the same commit passed on another run'} ([job](${job.html_url}))${err}`)
    }
  }
  for (const [key, lines] of Object.entries(flaky)) {
    out.push({
      lastSeen: lines.lastSeen,
      key: `flaky:${key}`,
      title: `Flaky check: ${key} (${lines.length} in 48 h)`,
      owner: 'agents',
      body: `**${key}** failed where the change under test can't have caused it:\n\n${lines.join('\n')}\n\n` +
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
      const limit = timeoutFor(limits, job.name)
      // A step with its own limit that ran out (the job then still has time to report).
      const step = (job.steps || []).find((s) => {
        const stepLimit = limits[`${job.name} / ${s.name}`]
        return stepLimit && s.started_at && s.completed_at && minutes(s) >= stepLimit - 0.5
      })
      const timedOutStep = job.timedOut ? (job.steps || []).find((s) => s.conclusion === 'failure' || s.conclusion === 'cancelled') : null
      if (step || job.timedOut || (limit && minutes(job) >= limit - 0.5)) {
        const at = step || timedOutStep
        const where = at ? `${job.name} / ${at.name}` : job.name
        const stepLimit = step ? limits[`${job.name} / ${step.name}`] : timedOutStep && minutes(timedOutStep) < (limit ?? Infinity) - 0.5 ? Math.round(minutes(timedOutStep)) : limit ?? Math.round(minutes(job))
        const k = `timeout:${r.path}:${where}`
        const seen = out.find((f) => f.key === k)
        if (seen) seen.lastSeen = Math.max(seen.lastSeen, Date.parse(r.created_at))
        else {
          out.push({
            lastSeen: Date.parse(r.created_at),
            key: k,
            title: `Timeout: ${where} hit its ${stepLimit} min limit`,
            owner: 'agents',
            body: `**${where}** ran out of time in ${runLink(r)}. A timeout reports no check result, so it hides whether anything is actually wrong.\n\n` +
              'Make the job fit with headroom (split it, drop duplicated work, move slow checks off the PR gate). Raising the limit only moves the cliff.',
          })
        }
      }
      if (job.conclusion === 'success' && limit) {
        const k = `${r.path}::${job.name.replace(/\s*\(.*\)$/, '')}`
        durations[k] = durations[k] || { limit, mins: [], run: r }
        durations[k].mins.push(minutes(job))
      }
    }
  }
  for (const [k, d] of Object.entries(durations)) {
    if (d.mins.length < 3) continue
    const med = median(d.mins)
    if (med < 0.75 * d.limit) continue
    const job = k.split('::')[1]
    out.push({
      key: `creep:${k}`,
      title: `Runtime creep: ${job} takes ${med.toFixed(0)} of its ${d.limit} min limit`,
      owner: 'agents',
      body: `Over its last ${d.mins.length} successful runs **${job}** took a median **${med.toFixed(1)} min** against a ${d.limit} min limit (≥ 75 %). ` +
        'The next few added checks will push it into timeouts. Cut its runtime now: duplicated work, checks that belong in unit tests, or work that belongs in the nightly run.',
    })
  }

  // 4. The studio stopped: work is queued but no agent run has been logged for 6 h.
  const queued = snap.openIssues.filter((i) => i.labels.includes('agent:ready')).length +
    snap.openPrs.filter((p) => p.labels.some((l) => l === 'agent:needs-qa' || l === 'agent:changes-requested')).length
  if (!snap.paused && queued > 0 && snap.lastAgentActivity !== undefined) {
    const idle = snap.lastAgentActivity == null ? Infinity : now - snap.lastAgentActivity
    if (idle > 6 * HOUR) {
      out.push({
        key: 'stalled',
        title: `Studio stalled: no agent run logged for ${Number.isFinite(idle) ? `${Math.floor(idle / HOUR)} h` : 'a long time'}, ${queued} items queued`,
        owner: 'alex',
        body: `${queued} issues/PRs are waiting for agents, but no agent run has posted to the token ledger for ${Number.isFinite(idle) ? `${(idle / HOUR).toFixed(0)} h` : 'as far back as it goes'}. ` +
          'Every runbook ends by posting there, so the scheduled tasks are probably not running or are exiting early (disabled, no GitHub credentials, a pause, a broken setup step).\n\n' +
          'Check the "ShooterCoaster ·" scheduled tasks: their last runs and how long they took. A run that ends in under a minute did nothing.',
      })
    }
  }

  // 5. Stuck PRs.
  for (const p of snap.openPrs) {
    const since = Date.parse(p.labelledAt || p.updated_at)
    if (p.labels.includes('agent:qa-approved') && now - since > 3 * HOUR) {
      out.push({
        key: `stuck-approved:${p.number}`,
        title: `Approved but not merged for ${Math.floor((now - since) / HOUR)} h: #${p.number}`,
        owner: 'agents',
        body: `#${p.number} (${p.title}) has been \`agent:qa-approved\` for over 3 h and auto-merge hasn't merged it. ` +
          'Read its latest "Auto-merge" comment and its `verify` check, then fix whatever blocks it (red check, conflict, a gap in `scripts/automerge.cjs`).',
      })
    }
  }
  const waiting = snap.openPrs.filter((p) => p.labels.includes('agent:needs-qa') && now - Date.parse(p.labelledAt || p.updated_at) > 24 * HOUR)
  if (waiting.length) {
    out.push({
      key: 'qa-backlog',
      title: `QA backlog: ${waiting.length} PRs waiting over 24 h`,
      owner: 'agents',
      body: `Waiting for review for over a day: ${waiting.map((p) => `#${p.number}`).join(', ')}. ` +
        'Find why QA isn\'t keeping up (runs failing or exiting early, reviews too slow, runs spent on other work) and fix the cause, not just these PRs.',
    })
  }

  // 6. A production alert nobody has fixed.
  for (const i of snap.openIssues) {
    if (i.labels.includes('agent:prod-broken') && now - Date.parse(i.created_at) > 12 * HOUR) {
      out.push({
        key: `prod-broken:${i.number}`,
        title: `Production alert open for ${Math.floor((now - Date.parse(i.created_at)) / HOUR)} h: #${i.number}`,
        owner: 'agents',
        body: `#${i.number} (${i.title}) has been open for over 12 h. Either production is broken for players or the check is wrong; both need fixing today.`,
      })
    }
  }

  return out
}

module.exports = { findings, parseTimeouts, timeoutFor, isDocsOnly, median }
