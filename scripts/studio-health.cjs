// Studio-health watchdog: a plain GitHub Action (not an agent), so it keeps watching when the agents are the
// thing that's broken. Every 2 h it reads the last 48 h of workflow runs plus the open PRs, issues and the token
// ledger, turns them into findings (rules in scripts/studioHealthRules.cjs) and keeps exactly one issue per
// problem (label `studio-health`):
//   - a new problem opens an issue: `agent:ready` + P1 so builders take it first (owner 'agents'), or
//     `needs-alex` straight away when only Alex can fix it (owner 'alex': the studio itself isn't running);
//   - while it lasts, the issue body is kept current; after 24 h open it also gets `needs-alex`, once;
//   - when it clears, the issue is closed with a note.
// Run by .github/workflows/studio-health.yml. Local dry run (prints the findings, writes nothing):
//   node scripts/studio-health.cjs --dry-run

const fs = require('node:fs')
const path = require('node:path')
const { findings: findFindings, parseTimeouts } = require('./studioHealthRules.cjs')

const LABEL = 'studio-health'
const HOUR = 3600e3
const WINDOW = 48 * HOUR
const ESCALATE_AFTER = 24 * HOUR
const marker = (key) => `<!-- studio-health:${key} -->`
const labelNames = (x) => (x.labels || []).map((l) => (typeof l === 'string' ? l : l.name))

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

  // Jobs for every failure, and for the newest 12 successes per workflow (runtime creep).
  const want = new Set(done.filter((r) => r.conclusion !== 'success').map((r) => r.id))
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
  const prByBranch = new Map(recentPrs.map((p) => [p.head.ref, p.number]))
  for (const r of done) if (!r.prNumber && r.event === 'pull_request') r.prNumber = prByBranch.get(r.head_branch) ?? null

  // Failed jobs: GitHub's own annotations say whether a job or step timed out, and give the error.
  for (const r of done) {
    for (const j of r.jobs || []) {
      if (j.conclusion !== 'failure' && j.conclusion !== 'timed_out') continue
      const notes = await api('GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations', { check_run_id: j.id }).catch(() => [])
      const failures = notes.filter((a) => a.annotation_level === 'failure').map((a) => a.message.split('\n')[0])
      j.timedOut = j.conclusion === 'timed_out' || failures.some((m) => /timed out/i.test(m))
      j.errors = failures.filter((m) => !/^Process completed with exit code/.test(m)).slice(0, 3)
    }
  }

  const prFiles = {}
  for (const n of new Set(done.filter((r) => r.conclusion === 'failure' && r.prNumber).map((r) => r.prNumber))) {
    const files = await api('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', { pull_number: n, per_page: 100 })
    prFiles[n] = files.map((f) => f.filename)
  }

  const timeouts = {}
  for (const file of fs.readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f))) {
    timeouts[`.github/workflows/${file}`] = parseTimeouts(fs.readFileSync(path.join(workflowsDir, file), 'utf8'))
  }

  const [openPrs, openItems, ledger, pauses] = await Promise.all([
    api('GET /repos/{owner}/{repo}/pulls', { state: 'open', per_page: 100 }),
    api('GET /repos/{owner}/{repo}/issues', { state: 'open', per_page: 100 }),
    api('GET /repos/{owner}/{repo}/issues', { state: 'open', labels: 'token-ledger', per_page: 5 }),
    api('GET /repos/{owner}/{repo}/issues', { state: 'open', labels: 'pause', per_page: 5 }),
  ])
  return {
    now,
    runs: done,
    prFiles,
    timeouts,
    openPrs: openPrs.filter((p) => !p.draft).map((p) => ({
      number: p.number, title: p.title, labels: labelNames(p), created_at: p.created_at, updated_at: p.updated_at,
    })),
    openIssues: openItems.filter((i) => !i.pull_request).map((i) => ({
      number: i.number, title: i.title, labels: labelNames(i), created_at: i.created_at,
    })),
    lastAgentActivity: ledger.length ? Math.max(...ledger.map((i) => Date.parse(i.updated_at))) : null,
    paused: pauses.some((i) => !i.pull_request),
  }
}

const FOOTER = '\n\n---\n_Kept current by the studio-health watchdog (`.github/workflows/studio-health.yml`, every 2 h). ' +
  'It closes this issue when the problem clears. Open more than 24 h, it is escalated to Alex (`needs-alex`)._'

async function reconcile(api, found, now, log) {
  try {
    await api('POST /repos/{owner}/{repo}/labels', { name: LABEL, color: 'b60205', description: 'Opened and closed by the studio-health watchdog' })
  } catch {
    // already exists
  }
  const open = await api('GET /repos/{owner}/{repo}/issues', { state: 'open', labels: LABEL, per_page: 100 })
  // Closed after the problem was last seen = fixed (by an agent or by the watchdog clearing it): don't reopen on old runs.
  const closed = await api('GET /repos/{owner}/{repo}/issues', { state: 'closed', labels: LABEL, sort: 'updated', direction: 'desc', per_page: 100 })
  const closedAt = new Map()
  for (const i of closed) {
    const m = (i.body || '').match(/<!-- studio-health:(.+?) -->/)
    if (m && i.closed_at) closedAt.set(m[1], Math.max(closedAt.get(m[1]) || 0, Date.parse(i.closed_at)))
  }
  const byKey = new Map()
  for (const i of open) {
    const m = (i.body || '').match(/<!-- studio-health:(.+?) -->/)
    if (m) byKey.set(m[1], i)
  }
  const seen = new Set()
  for (const f of found) {
    seen.add(f.key)
    const body = `${marker(f.key)}\n${f.body}${FOOTER}`
    const issue = byKey.get(f.key)
    if (!issue && f.lastSeen && (closedAt.get(f.key) || 0) > f.lastSeen) continue
    if (!issue) {
      const labels = [LABEL, 'P1', 'type:tech', f.owner === 'alex' ? 'needs-alex' : 'agent:ready']
      const created = await api('POST /repos/{owner}/{repo}/issues', { title: f.title, body, labels })
      log(`opened #${created.number}: ${f.title}`)
      continue
    }
    if (issue.body !== body || issue.title !== f.title) {
      await api('PATCH /repos/{owner}/{repo}/issues/{issue_number}', { issue_number: issue.number, title: f.title, body })
      log(`updated #${issue.number}: ${f.title}`)
    }
    const labels = labelNames(issue)
    if (!labels.includes('needs-alex') && now - Date.parse(issue.created_at) > ESCALATE_AFTER) {
      await api('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', { issue_number: issue.number, labels: ['needs-alex'] })
      await api('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        issue_number: issue.number,
        body: 'Escalating to Alex: this has been open for over 24 h without clearing. Agents: this stays P1 and ahead of feature work until it does.',
      })
      log(`escalated #${issue.number}`)
    }
  }
  for (const [key, issue] of byKey) {
    if (seen.has(key)) continue
    await api('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      issue_number: issue.number,
      body: `Cleared ${new Date(now).toISOString().slice(0, 16)}Z: the watchdog no longer sees this problem.`,
    })
    await api('PATCH /repos/{owner}/{repo}/issues/{issue_number}', { issue_number: issue.number, state: 'closed', state_reason: 'completed' })
    log(`closed #${issue.number} (cleared)`)
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
  await reconcile(api, found, now, (m) => core.info(m))
}

module.exports.collect = collect

if (require.main === module) {
  const { ghReadApi } = require('./studio-status.cjs')
  const api = ghReadApi()
  const now = Date.now()
  collect(api, now, path.join(__dirname, '..', '.github/workflows'))
    .then((snap) => {
      for (const f of findFindings(snap)) console.log(`[${f.owner}] ${f.key}\n  ${f.title}\n`)
    })
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
