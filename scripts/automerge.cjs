// The merge gate for the autonomous studio: squash-merges PRs labelled
// `agent:qa-approved` once the `verify` check is green on their head commit.
//
// Run by .github/workflows/automerge.yml (actions/github-script) on PR events, after
// every CI run, and as a sweep every 10 minutes, so a missed or stale event can't
// strand an approved PR. Each run picks its candidate PRs, puts every one through the
// same checks, merges what passes and says why it skipped the rest: a PR comment
// (once per reason and head) for approved PRs, and one line per PR in the job summary.
// An approved PR that conflicts with main goes back to Fix instead of sitting approved,
// and an API error on one PR never stops the run (or the CI dispatch after its merges).
//
// Local dry run of the sweep through the `gh` CLI (prints what it would do, writes nothing):
//   node scripts/automerge.cjs --dry-run

const APPROVED = 'agent:qa-approved'
const CHANGES_REQUESTED = 'agent:changes-requested'

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

/** CI jobs that `verify` waits on (ci.yml): GitHub creates the `verify` check only once they end. */
const isVerifyNeed = (name) => name === 'unit + build' || name === 'lighthouse' || name.startsWith('smoke (')

/** The newest `verify` check run of a commit, a `waiting` stand-in while the jobs it needs run, or undefined. */
function latestVerify(checkRuns) {
  const verify = checkRuns.filter((r) => r.name === 'verify').sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0]
  if (verify) return verify
  return checkRuns.some((r) => isVerifyNeed(r.name) && r.status !== 'completed') ? { name: 'verify', status: 'waiting' } : undefined
}

/**
 * What to do with one PR: `merge`, `wait` (verify still running), `skip` (approved but
 * blocked: worth telling the PR), `handback` (it conflicts with main: back to Fix) or
 * `ignore` (not approved or not open: nothing to say).
 * `verify` is the newest `verify` check run on the head commit (undefined when there is none).
 * The conflict check comes before verify's: CI doesn't run on a conflicting PR.
 */
function decide(pr, verify, repoFullName) {
  if (pr.state !== 'open') return { action: 'ignore', reason: 'not open' }
  if (!hasLabel(pr, APPROVED)) return { action: 'ignore', reason: 'not approved' }
  if (pr.draft) return { action: 'skip', reason: 'the PR is a draft' }
  if (pr.base.ref !== 'main') return { action: 'skip', reason: `its base is \`${pr.base.ref}\`, not \`main\`` }
  if (pr.head.repo?.full_name?.toLowerCase() !== repoFullName.toLowerCase()) return { action: 'skip', reason: 'its head branch is on a fork' }
  if (!pr.head.ref.startsWith('agent/')) return { action: 'skip', reason: `\`${pr.head.ref}\` is not an \`agent/*\` branch` }
  if (pr.mergeable === false) return { action: 'handback', reason: 'it conflicts with `main`' }
  if (!verify) return { action: 'skip', reason: 'there is no `verify` check on the head commit' }
  if (verify.status !== 'completed') return { action: 'wait', reason: `\`verify\` is ${verify.status.replace('_', ' ')}` }
  if (verify.conclusion !== 'success') return { action: 'skip', reason: `\`verify\` is ${verify.conclusion} on the head commit` }
  return { action: 'merge', reason: 'approved and verify is green' }
}

const skipComment = (reason, sha) =>
  `Auto-merge skipped: ${reason}.\nHead: \`${sha}\`. Retried every 10 minutes and after every CI run.`

const failComment = (message, sha) =>
  `Auto-merge failed: ${message}\nHead: \`${sha}\`. Retried every 10 minutes and after every CI run.`

/** GitHub's merge API answers a conflict with "Pull Request is not mergeable". */
const isConflictError = (message) => /not mergeable/i.test(message)

// builder.md step 1 and qa.md "Light re-review" key their light path on this wording.
const handbackComment = (sha) =>
  [
    'Auto-merge failed: this branch conflicts with `main`.',
    `Head: \`${sha}\`. Merge conflict only; full review passed: QA's approval of this head stands, and this is not a QA send-back (it doesn't count towards the 3).`,
    '',
    `Changes requested (\`${APPROVED}\` → \`${CHANGES_REQUESTED}\`):`,
    '1. Merge `origin/main` into the branch: no rebase, no force-push.',
    "2. Resolve each conflict keeping both sides' behaviour. Change nothing else.",
    '3. Run `npm test` and `npm run build`, push, and swap the label to `agent:needs-qa` for a light re-review.',
  ].join('\n')

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

  // Add before remove: if a label call fails the PR stays approved, so the next sweep retries.
  const handBack = async (number, sha) => {
    if (dryRun) {
      note(number, `[dry run] would hand back to Fix: it conflicts with main (${sha.slice(0, 7)})`)
      return
    }
    await comment(number, handbackComment(sha))
    await api('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', { issue_number: number, labels: [CHANGES_REQUESTED] })
    await api('DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}', { issue_number: number, name: APPROVED })
    note(number, `handed back to Fix: it conflicts with main (${sha.slice(0, 7)})`)
  }

  const merged = []
  const gatePr = async (number) => {
    const pr = await api('GET /repos/{owner}/{repo}/pulls/{pull_number}', { pull_number: number })
    let verify
    if (pr.state === 'open' && hasLabel(pr, APPROVED)) {
      const { check_runs } = await api('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', { ref: pr.head.sha, per_page: 100 })
      verify = latestVerify(check_runs)
    }
    const verdict = decide(pr, verify, `${owner}/${repo}`)
    const sha = pr.head.sha.slice(0, 7)
    if (verdict.action === 'ignore' || verdict.action === 'wait') {
      note(number, `${verdict.action === 'wait' ? 'waiting' : 'not a candidate'}: ${verdict.reason} (${sha})`)
      return
    }
    if (verdict.action === 'skip') {
      note(number, `skipped: ${verdict.reason} (${sha})`)
      await comment(number, skipComment(verdict.reason, pr.head.sha))
      return
    }
    if (verdict.action === 'handback') return handBack(number, pr.head.sha)
    if (dryRun) {
      note(number, `[dry run] would merge (${sha})`)
      return
    }
    try {
      await api('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
        pull_number: number, sha: pr.head.sha, merge_method: 'squash', commit_title: `${pr.title} (#${number})`,
      })
    } catch (e) {
      log.warning(`#${number}: merge failed — ${e.message}`)
      if (isConflictError(e.message)) return handBack(number, pr.head.sha)
      lines.push(`#${number}: merge failed: ${e.message} (${sha})`)
      await comment(number, failComment(e.message, pr.head.sha))
      return
    }
    merged.push(number)
    note(number, `merged (${sha})`)
  }

  for (const number of numbers) {
    try {
      await gatePr(number)
    } catch (e) {
      log.warning(`#${number}: error — ${e.message}`)
      lines.push(`#${number}: error: ${e.message}`)
    }
  }

  // Pushes made with GITHUB_TOKEN don't trigger ci.yml's `push: main`, so start
  // verify on main explicitly (workflow_dispatch is exempt from that rule). One
  // run covers every merge in this batch: it tests main's head.
  if (merged.length) {
    const list = merged.map((n) => `#${n}`).join(', ')
    try {
      const head = await api('GET /repos/{owner}/{repo}/branches/{branch}', { branch: 'main' })
      const label = `${list} (${head.commit.sha.slice(0, 7)})`
      await api('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
        workflow_id: 'ci.yml', ref: 'main', inputs: { merged: label },
      })
      log.info(`dispatched CI on main after ${label}`)
    } catch (e) {
      log.warning(`could not dispatch CI on main after ${list}: ${e.message}`)
      lines.push(`could not dispatch CI on main after ${list}: ${e.message}`)
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
module.exports.handbackComment = handbackComment
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
