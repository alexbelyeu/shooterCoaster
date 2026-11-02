// The merge gate for the autonomous studio: squash-merges PRs labelled
// `agent:qa-approved` once the `verify` check is green on their head commit.
//
// Run by .github/workflows/automerge.yml (actions/github-script) on PR events, after
// every CI run, and as a sweep every 10 minutes, so a missed or stale event can't
// strand an approved PR. Each run picks its candidate PRs, puts every one through the
// same checks, merges what passes and says why it skipped the rest: a PR comment
// (once per reason and head) for approved PRs, and one line per PR in the job summary.
//
// Local dry run of the sweep through the `gh` CLI (prints what it would do, writes nothing):
//   node scripts/automerge.cjs --dry-run

const APPROVED = 'agent:qa-approved'

// ---------- pure rules (unit-tested in automerge.test.ts) ----------

const hasLabel = (pr, name) => (pr.labels || []).some((l) => l.name === name)

/** Unique PR numbers, ascending, from any number of lists of `{ number }`. */
function unionNumbers(...lists) {
  return [...new Set(lists.flat().map((p) => p.number))].sort((a, b) => a - b)
}

/** The sweep: every open PR labelled approved. */
function sweepNumbers(openPrs) {
  return openPrs.filter((p) => p.state === 'open' && hasLabel(p, APPROVED)).map((p) => p.number).sort((a, b) => a - b)
}

/** The newest `verify` check run of a commit, or undefined. */
function latestVerify(checkRuns) {
  return [...checkRuns].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0]
}

/**
 * What to do with one PR: `merge`, `wait` (verify still running), `skip` (approved but
 * blocked: worth telling the PR) or `ignore` (not approved or not open: nothing to say).
 * `verify` is the newest `verify` check run on the head commit (undefined when there is none).
 */
function decide(pr, verify, repoFullName) {
  if (pr.state !== 'open') return { action: 'ignore', reason: 'not open' }
  if (!hasLabel(pr, APPROVED)) return { action: 'ignore', reason: 'not approved' }
  if (pr.draft) return { action: 'skip', reason: 'the PR is a draft' }
  if (pr.base.ref !== 'main') return { action: 'skip', reason: `its base is \`${pr.base.ref}\`, not \`main\`` }
  if (pr.head.repo?.full_name?.toLowerCase() !== repoFullName.toLowerCase()) return { action: 'skip', reason: 'its head branch is on a fork' }
  if (!pr.head.ref.startsWith('agent/')) return { action: 'skip', reason: `\`${pr.head.ref}\` is not an \`agent/*\` branch` }
  if (!verify) return { action: 'skip', reason: 'there is no `verify` check on the head commit' }
  if (verify.status !== 'completed') return { action: 'wait', reason: `\`verify\` is ${verify.status.replace('_', ' ')}` }
  if (verify.conclusion !== 'success') return { action: 'skip', reason: `\`verify\` is ${verify.conclusion} on the head commit` }
  return { action: 'merge', reason: 'approved and verify is green' }
}

const skipComment = (reason, sha) =>
  `Auto-merge skipped: ${reason}.\nHead: \`${sha}\`. Retried every 10 minutes and after every CI run.`

const failComment = (message, sha) =>
  `Auto-merge failed: ${message}\nHead: \`${sha}\`. The branch probably conflicts with main: merge origin/main into it, resolve, re-verify and push (never force-push).`

/** False when the newest auto-merge comment on the PR already says exactly this. */
function shouldComment(body, comments) {
  const ours = comments.filter((c) => c.user?.type === 'Bot' && /^Auto-merge (skipped|failed):/.test(c.body || ''))
  const latest = ours.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).at(-1)
  return !latest || latest.body !== body
}

// ---------- the run ----------

async function getAll(api, route, params) {
  const out = []
  for (let page = 1; ; page++) {
    const batch = await api(`GET ${route}`, { ...params, per_page: 100, page })
    out.push(...batch)
    if (batch.length < 100) return out
  }
}

async function candidates(api, event, payload, owner, log) {
  if (event === 'pull_request') return [payload.pull_request.number]
  if (event !== 'workflow_run') return sweepNumbers(await getAll(api, '/repos/{owner}/{repo}/pulls', { state: 'open' }))

  // After CI: any one of these lookups can come back empty or stale, so take the union.
  const run = payload.workflow_run
  const [byBranch, byCommit] = await Promise.all([
    getAll(api, '/repos/{owner}/{repo}/pulls', { state: 'open', head: `${owner}:${run.head_branch}` }),
    api('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', { commit_sha: run.head_sha }),
  ])
  const numbers = unionNumbers(run.pull_requests || [], byBranch, byCommit.filter((p) => p.state === 'open'))
  if (!numbers.length && run.head_branch?.startsWith('agent/')) {
    log.warning(`CI run ${run.id} on ${run.head_branch} (${run.head_sha.slice(0, 7)}): no open PR found; the 10-minute sweep will pick it up if it is approved`)
  }
  return numbers
}

async function runGate({ api, event, payload, owner, repo, dryRun, log }) {
  const numbers = await candidates(api, event, payload, owner, log)
  const lines = []
  const note = (number, text) => {
    lines.push(`#${number}: ${text}`)
    log.info(`#${number}: ${text}`)
  }
  const comment = async (number, body) => {
    const comments = await getAll(api, '/repos/{owner}/{repo}/issues/{issue_number}/comments', { issue_number: number })
    if (!shouldComment(body, comments)) return
    if (dryRun) log.info(`#${number}: [dry run] would comment: ${body.split('\n')[0]}`)
    else await api('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', { issue_number: number, body })
  }

  const merged = []
  for (const number of numbers) {
    const pr = await api('GET /repos/{owner}/{repo}/pulls/{pull_number}', { pull_number: number })
    let verify
    if (pr.state === 'open' && hasLabel(pr, APPROVED)) {
      const { check_runs } = await api('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', { ref: pr.head.sha, check_name: 'verify' })
      verify = latestVerify(check_runs)
    }
    const verdict = decide(pr, verify, `${owner}/${repo}`)
    const sha = pr.head.sha.slice(0, 7)
    if (verdict.action === 'ignore' || verdict.action === 'wait') {
      note(number, `${verdict.action === 'wait' ? 'waiting' : 'not a candidate'}: ${verdict.reason} (${sha})`)
      continue
    }
    if (verdict.action === 'skip') {
      note(number, `skipped: ${verdict.reason} (${sha})`)
      await comment(number, skipComment(verdict.reason, pr.head.sha))
      continue
    }
    if (dryRun) {
      note(number, `[dry run] would merge (${sha})`)
      continue
    }
    try {
      await api('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
        pull_number: number, sha: pr.head.sha, merge_method: 'squash', commit_title: `${pr.title} (#${number})`,
      })
      merged.push(number)
      note(number, `merged (${sha})`)
    } catch (e) {
      log.warning(`#${number}: merge failed — ${e.message}`)
      lines.push(`#${number}: merge failed: ${e.message} (${sha})`)
      await comment(number, failComment(e.message, pr.head.sha))
    }
  }

  // Pushes made with GITHUB_TOKEN don't trigger ci.yml's `push: main`, so start
  // verify on main explicitly (workflow_dispatch is exempt from that rule). One
  // run covers every merge in this batch: it tests main's head.
  if (merged.length) {
    const head = await api('GET /repos/{owner}/{repo}/branches/{branch}', { branch: 'main' })
    const label = `${merged.map((n) => `#${n}`).join(', ')} (${head.commit.sha.slice(0, 7)})`
    try {
      await api('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
        workflow_id: 'ci.yml', ref: 'main', inputs: { merged: label },
      })
      log.info(`dispatched CI on main after ${label}`)
    } catch (e) {
      log.warning(`could not dispatch CI on main: ${e.message}`)
    }
  }
  return { numbers, merged, lines }
}

/** Called from actions/github-script. */
module.exports = async function run({ github, context, core }) {
  const { owner, repo } = context.repo
  const api = async (route, params = {}) => (await github.request(route, { owner, repo, ...params })).data
  const dryRun = String(context.payload.inputs?.dry_run) === 'true'
  const { lines } = await runGate({ api, event: context.eventName, payload: context.payload, owner, repo, dryRun, log: core })
  await core.summary
    .addHeading(`Auto-merge (${context.eventName}${dryRun ? ', dry run' : ''})`, 3)
    .addRaw(lines.length ? lines.map((l) => `- ${l}`).join('\n') : '_No candidate PRs._', true)
    .write()
}

module.exports.decide = decide
module.exports.unionNumbers = unionNumbers
module.exports.sweepNumbers = sweepNumbers
module.exports.latestVerify = latestVerify
module.exports.shouldComment = shouldComment
module.exports.skipComment = skipComment
module.exports.failComment = failComment
module.exports.runGate = runGate

if (require.main === module) {
  const { execFileSync } = require('node:child_process')
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'alexbelyeu/shooterCoaster').split('/')
  const api = async (route, params = {}) => {
    const [method, tmpl] = route.split(' ')
    if (method !== 'GET') throw new Error('dry run is read-only')
    const all = { owner, repo, ...params }
    const used = new Set()
    const path = tmpl.replace(/\{(\w+)\}/g, (_, k) => (used.add(k), encodeURIComponent(all[k])))
    const qs = Object.entries(all).filter(([k]) => !used.has(k)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return JSON.parse(execFileSync('gh', ['api', qs ? `${path}?${qs}` : path], { encoding: 'utf8', maxBuffer: 64e6 }))
  }
  const log = { info: console.log, warning: (m) => console.log(`warning: ${m}`) }
  runGate({ api, event: 'schedule', payload: {}, owner, repo, dryRun: true, log }).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
