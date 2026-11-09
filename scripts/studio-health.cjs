// Studio-health watchdog, run every 2 h by .github/workflows/studio-health.yml: a plain Action, not an agent, so it
// keeps watching when the agents are what's broken. Keeps one `studio-health` issue per finding of
// studioHealthRules.cjs (PROTOCOL.md "Labels" has the lifecycle) and escalates stale `agent:prod-broken` alerts.
// Local dry run (prints the findings, writes nothing): node scripts/studio-health.cjs --dry-run

const fs = require('node:fs')
const path = require('node:path')
const { findings: findFindings, staleProdAlerts, parseTimeouts } = require('./studioHealthRules.cjs')
const { readPauseState } = require('./studio-status.cjs')
const { getAll } = require('./automerge.cjs')
const { fetchTelemetry, phoneFrameBudget } = require('./playerTelemetry.cjs')

const LABEL = 'studio-health'
const HOUR = 3600e3
const WINDOW = 48 * HOUR
const ESCALATE_AFTER = 24 * HOUR
const marker = (key) => `<!-- studio-health:${key} -->`
const ESCALATED = '<!-- studio-health-escalated -->'
const keyOf = (issue) => (issue.body || '').match(/<!-- studio-health:(.+?) -->/)?.[1] ?? null
const labelNames = (x) => (x.labels || []).map((l) => (typeof l === 'string' ? l : l.name))
const stamp = (ms) => `${new Date(ms).toISOString().slice(0, 16)}Z`

/** `builder_runs_per_day` in STEERING.md (the Builders runbook's default: 6). */
const builderBudget = (steering) => Number(/^builder_runs_per_day:\s*(\d+)/m.exec(steering)?.[1] ?? 6)

async function collect(api, now, workflowsDir) {
  const since = new Date(now - WINDOW).toISOString()
  // Per workflow: the status page and this watchdog run hundreds of times a day and would crowd the rest out.
  const { workflows } = await api('GET /repos/{owner}/{repo}/actions/workflows', { per_page: 100 })
  const runs = []
  for (const w of workflows.filter((w) => w.state === 'active' && !/(studio-status|studio-health|report-notify)\.yml$/.test(w.path))) {
    for (let page = 1; page <= 5; page++) {
      const res = await api('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', { workflow_id: w.id, created: `>=${since}`, per_page: 100, page })
      runs.push(...res.workflow_runs)
      if (res.workflow_runs.length < 100) break
    }
  }
  const done = runs
    .filter((r) => r.status === 'completed' && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped')
    .map((r) => ({
      id: r.id, name: r.name, path: r.path, event: r.event, conclusion: r.conclusion,
      head_branch: r.head_branch, head_sha: r.head_sha, created_at: r.created_at, html_url: r.html_url,
      prNumber: r.pull_requests?.[0]?.number ?? null,
    }))

  // Jobs for every failure, for successes of the same workflow and commit (a flake is a job that also passed), and for
  // the newest 12 successes per workflow (runtime creep).
  const failed = done.filter((r) => r.conclusion !== 'success')
  const want = new Set(failed.map((r) => r.id))
  const failedShas = new Set(failed.map((r) => `${r.path}@${r.head_sha}`))
  for (const r of done) if (failedShas.has(`${r.path}@${r.head_sha}`)) want.add(r.id)
  const perWorkflow = {}
  for (const r of done.filter((r) => r.conclusion === 'success').sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    perWorkflow[r.path] = (perWorkflow[r.path] || 0) + 1
    if (perWorkflow[r.path] <= 12) want.add(r.id)
  }
  for (const r of done) {
    if (!want.has(r.id)) continue
    const res = await api('GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs', { run_id: r.id, per_page: 100 })
    r.jobs = res.jobs.map((j) => ({
      id: j.id, name: j.name, conclusion: j.conclusion, started_at: j.started_at, completed_at: j.completed_at, html_url: j.html_url,
      steps: (j.steps || []).map((s) => ({ name: s.name, conclusion: s.conclusion, started_at: s.started_at, completed_at: s.completed_at })),
    }))
  }

  // A run's PR link is dropped once the PR merges: match by head branch instead.
  const recentPrs = await api('GET /repos/{owner}/{repo}/pulls', { state: 'all', sort: 'updated', direction: 'desc', per_page: 100 })
  const prByBranch = new Map()
  for (const p of recentPrs) if (!prByBranch.has(p.head.ref)) prByBranch.set(p.head.ref, p.number) // newest first: a reused branch keeps its latest PR
  for (const r of done) if (!r.prNumber && r.event === 'pull_request') r.prNumber = prByBranch.get(r.head_branch) ?? null

  // Failed jobs: GitHub's own annotations say whether a job or step timed out, and give the error.
  for (const r of done) {
    for (const j of r.jobs || []) {
      if (j.conclusion !== 'failure' && j.conclusion !== 'timed_out') continue
      const notes = await api('GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations', { check_run_id: j.id }).catch(() => [])
      const failures = notes.filter((a) => a.annotation_level === 'failure').map((a) => a.message.split('\n')[0])
      j.timedOut = j.conclusion === 'timed_out' || failures.some((m) => /timed out|exceeded the maximum execution time/i.test(m))
      j.errors = failures.filter((m) => !/^Process completed with exit code/.test(m)).slice(0, 3)
    }
  }

  const prFiles = {}
  for (const n of new Set(done.filter((r) => r.conclusion === 'failure' && r.prNumber).map((r) => r.prNumber))) {
    prFiles[n] = (await getAll(api, '/repos/{owner}/{repo}/pulls/{pull_number}/files', { pull_number: n }, 30)).map((f) => f.filename)
  }

  const timeouts = {}
  for (const file of fs.readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f))) {
    timeouts[`.github/workflows/${file}`] = parseTimeouts(fs.readFileSync(path.join(workflowsDir, file), 'utf8'))
  }

  const [openPrs, openItems, ledger, pause, watchdogOpen, watchdogClosed, repoEvents, steering] = await Promise.all([
    getAll(api, '/repos/{owner}/{repo}/pulls', { state: 'open' }, 10),
    getAll(api, '/repos/{owner}/{repo}/issues', { state: 'open' }, 10),
    api('GET /repos/{owner}/{repo}/issues', { state: 'open', labels: 'token-ledger', per_page: 5 }),
    readPauseState(api, now),
    getAll(api, '/repos/{owner}/{repo}/issues', { state: 'open', labels: LABEL }, 10),
    getAll(api, '/repos/{owner}/{repo}/issues', { state: 'closed', labels: LABEL, sort: 'updated', direction: 'desc' }, 2),
    getAll(api, '/repos/{owner}/{repo}/issues/events', {}, 5),
    api('GET /repos/{owner}/{repo}/contents/{path}', { path: 'docs/agents/STEERING.md' })
      .then((f) => Buffer.from(f.content, 'base64').toString('utf8'), () => ''),
  ])

  // Builders runs logged per session (the daily budget counts them), from the ledger's `<!-- ledger {json} -->` comments.
  const ledgerIssue = ledger.sort((a, b) => a.number - b.number)[0]
  const builderRuns = new Map()
  const ledgerRuns = []
  if (ledgerIssue) {
    const comments = await getAll(api, '/repos/{owner}/{repo}/issues/{issue_number}/comments', {
      issue_number: ledgerIssue.number, since: new Date(now - WINDOW - 24 * HOUR).toISOString(),
    }, 20)
    for (const c of comments) {
      let e = null
      try {
        e = JSON.parse(/<!-- ledger (\{.*\}) -->/.exec(c.body || '')?.[1] ?? 'null')
      } catch {
        e = null
      }
      if (e?.role === 'builders') builderRuns.set(e.session || c.id, Date.parse(e.at || c.created_at))
      if (e?.weighted) {
        ledgerRuns.push({
          role: e.role, ref: e.ref || null, weighted: e.weighted, at: Date.parse(e.at || c.created_at), minutes: e.minutes ?? null,
          url: c.html_url, missTokens: e.diag?.missTokens ?? 0, misses: e.diag?.misses ?? 0, peakContext: e.diag?.peakContext ?? null,
          missesAfter: (e.diag?.topMisses || []).slice(0, 2).map((m) => m.after),
          heaviest: (e.diag?.heaviest || []).slice(0, 3).map((h) => `${h.tool} (${h.chars} chars)`),
          agents: e.diag?.agents || [],
        })
      }
    }
  }

  // Queued work is timed from its queue label, not its last activity: stuck / waiting PRs, and when the work a
  // scheduled run would pick up appeared (a stall counts only the slots after that).
  const labelledAt = (events, labels) => {
    const out = {}
    for (const e of events) if (e.event === 'labeled' && labels.includes(e.label?.name)) {
      if (!out[e.label.name] || e.created_at > out[e.label.name]) out[e.label.name] = e.created_at
    }
    return out
  }
  const queueLabels = ['agent:qa-approved', 'agent:needs-qa', 'agent:changes-requested']
  const prs = openPrs.filter((p) => !p.draft)
  for (const p of prs) {
    p.labelledAt = {}
    const mine = labelNames(p).filter((l) => queueLabels.includes(l))
    if (!mine.length) continue
    p.labelledAt = labelledAt(await getAll(api, '/repos/{owner}/{repo}/issues/{issue_number}/events', { issue_number: p.number }, 5), mine)
  }
  // Ready issues: the repo's recent events (an issue labelled before them has been ready all along).
  const readyEvents = repoEvents.filter((e) => e.issue && !e.issue.pull_request)

  const closedAt = {}
  for (const i of watchdogClosed) {
    const key = keyOf(i)
    if (key && i.closed_at) closedAt[key] = Math.max(closedAt[key] || 0, Date.parse(i.closed_at))
  }

  return {
    now,
    runs: done,
    prFiles,
    timeouts,
    openPrs: prs.map((p) => ({
      number: p.number, title: p.title, labels: labelNames(p), created_at: p.created_at, updated_at: p.updated_at, labelledAt: p.labelledAt,
    })),
    openIssues: openItems.filter((i) => !i.pull_request).map((i) => ({
      number: i.number, title: i.title, labels: labelNames(i), created_at: i.created_at,
      labelledAt: labelledAt(readyEvents.filter((e) => e.issue.number === i.number), ['agent:ready']),
    })),
    closedAt,
    watchdogOpen,
    lastAgentActivity: ledger.length ? Math.max(...ledger.map((i) => Date.parse(i.updated_at))) : null,
    paused: pause.paused,
    pauseEndedAt: pause.endedAt,
    builderRuns: [...builderRuns.values()],
    ledgerRuns,
    builderBudget: builderBudget(steering),
    telemetry: await fetchTelemetry(),
    phoneFrameBudget: phoneFrameBudget(),
  }
}

const FOOTER = '\n\n---\n_Kept current by the studio-health watchdog (`.github/workflows/studio-health.yml`, every 2 h). ' +
  'It closes this issue when the problem clears. Open over 24 h and still seen in the last 24 h, it is escalated to Alex (`needs-alex`), once._'

function issueBody(f, escalated) {
  const seen = f.state
    ? '_This is the current state, checked every 2 h. Closed while it still holds, it is filed again._'
    : `**Last seen:** ${stamp(f.lastSeen)} (the newest run showing it). If a PR merged after that already fixes it, ` +
      'close this issue with a link to the PR: only a run newer than the close files it again.'
  return `${marker(f.key)}${escalated ? `\n${ESCALATED}` : ''}\n${f.body}\n\n${seen}${FOOTER}`
}

/** Opens, updates, escalates and closes the watchdog's issues (`open`: its open issues) to match `found`. */
async function reconcile(api, found, open, now, log, { telemetryDown = false } = {}) {
  try {
    await api('POST /repos/{owner}/{repo}/labels', { name: LABEL, color: 'b60205', description: 'Opened and closed by the studio-health watchdog' })
  } catch {
    // already exists
  }
  const byKey = new Map()
  for (const i of open) {
    const key = keyOf(i)
    if (key) byKey.set(key, i)
  }
  const seen = new Set()
  for (const f of found) {
    seen.add(f.key)
    const issue = byKey.get(f.key)
    if (!issue) {
      const alex = f.owner === 'alex'
      const labels = [LABEL, 'P1', 'type:tech', alex ? 'needs-alex' : 'agent:ready']
      const created = await api('POST /repos/{owner}/{repo}/issues', { title: f.title, body: issueBody(f, alex), labels })
      log(`opened #${created.number}: ${f.title}`)
      continue
    }
    const wasEscalated = (issue.body || '').includes(ESCALATED)
    const escalate = !wasEscalated && now - Date.parse(issue.created_at) > ESCALATE_AFTER && now - f.lastSeen < ESCALATE_AFTER
    const body = issueBody(f, wasEscalated || escalate)
    if (issue.body !== body || issue.title !== f.title) {
      await api('PATCH /repos/{owner}/{repo}/issues/{issue_number}', { issue_number: issue.number, title: f.title, body })
      log(`updated #${issue.number}: ${f.title}`)
    }
    if (escalate) {
      await api('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', { issue_number: issue.number, labels: ['needs-alex'] })
      await api('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        issue_number: issue.number,
        body: 'Escalating to Alex: open for over 24 h and still happening. Agents: this stays P1 and ahead of feature work until it clears.',
      })
      log(`escalated #${issue.number}`)
    }
  }
  for (const [key, issue] of byKey) {
    if (seen.has(key)) continue
    // No telemetry answer (503, timeout) says nothing about player problems: leave them open.
    if (telemetryDown && key.startsWith('player-')) continue
    await api('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      issue_number: issue.number,
      body: `Cleared ${stamp(now)}: the watchdog no longer sees this problem.`,
    })
    await api('PATCH /repos/{owner}/{repo}/issues/{issue_number}', { issue_number: issue.number, state: 'closed', state_reason: 'completed' })
    log(`closed #${issue.number} (cleared)`)
  }
}

/** `agent:prod-broken` issues open over 12 h get `needs-alex` and one comment (marked, so only once). */
async function escalateProdAlerts(api, stale, now, log) {
  for (const i of stale) {
    const comments = await getAll(api, '/repos/{owner}/{repo}/issues/{issue_number}/comments', { issue_number: i.number }, 10)
    if (comments.some((c) => (c.body || '').includes(ESCALATED))) continue
    await api('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', { issue_number: i.number, labels: ['needs-alex'] })
    await api('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      issue_number: i.number,
      body: `${ESCALATED}\nEscalating to Alex (studio-health watchdog): this alert has been open for ${Math.floor((now - Date.parse(i.created_at)) / HOUR)} h. ` +
        'Either production or main is broken for players, or the check is wrong; both need fixing today (PROTOCOL.md "When main breaks").',
    })
    log(`escalated prod alert #${i.number}`)
  }
}

/** Called from actions/github-script. */
module.exports = async function run({ github, context, core }) {
  const api = async (route, params = {}) =>
    (await github.request(route, { owner: context.repo.owner, repo: context.repo.repo, ...params })).data
  const now = Date.now()
  const snap = await collect(api, now, path.join(process.env.GITHUB_WORKSPACE, '.github/workflows'))
  const found = findFindings(snap)
  core.info(`${found.length} finding(s): ${found.map((f) => f.key).join(', ') || 'none'}`)
  await reconcile(api, found, snap.watchdogOpen, now, (m) => core.info(m), { telemetryDown: !snap.telemetry })
  await escalateProdAlerts(api, staleProdAlerts(snap), now, (m) => core.info(m))
}

module.exports.collect = collect
module.exports.reconcile = reconcile
module.exports.escalateProdAlerts = escalateProdAlerts

if (require.main === module) {
  const { ghReadApi } = require('./studio-status.cjs')
  const api = ghReadApi()
  const now = Date.now()
  collect(api, now, path.join(__dirname, '..', '.github/workflows'))
    .then((snap) => {
      for (const f of findFindings(snap)) console.log(`[${f.owner}] ${f.key}\n  ${f.title}\n  last seen ${stamp(f.lastSeen)}\n`)
      for (const i of staleProdAlerts(snap)) console.log(`[escalate] agent:prod-broken #${i.number}: ${i.title}`)
    })
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
