// Alerting for the production checks (.github/workflows/prod-smoke.yml, #352): one
// `agent:prod-broken` issue per suite, opened on a green → red transition and closed with a
// comment when that suite is green again. A red run while the issue is open says nothing, so
// Alex gets one email per outage, not one per deploy. The issue is the state: no other record.
//
// Suites: `deploy` (e2e/prod-check.mjs after every production deploy) and `nightly` (the full
// smoke against the live site). Each owns the issue carrying its marker; CI's red-main issue
// carries none and is never touched here.
//
// Called from actions/github-script after the check step, with the step's exit code:
//   0 = green, 124 / 137 = `timeout` stopped it at the cap (TERM, then KILL), anything else = red.
// A cancelled run (superseded by a newer deploy) never reaches this script.

const fs = require('node:fs')

const LABEL = 'agent:prod-broken'
const TIMED_OUT = [124, 137]
const SUITES = {
  deploy: { title: 'Production deploy check failing', name: 'deploy health check', results: 'prod-check.json' },
  nightly: { title: 'Production nightly smoke failing', name: 'nightly full smoke', results: 'results.json' },
}

// ---------- pure rules (unit-tested in prod-alert.test.ts) ----------

const marker = (suite) => `<!-- prod-smoke:${suite} -->`

/** The open issue this suite owns, if any. */
function ownIssue(openIssues, suite) {
  return openIssues.find((i) => (i.body || '').includes(marker(suite)))
}

/** `open` (green → red), `close` (red → green), or `none`: a red run while red stays quiet. */
function decide(red, issue) {
  if (red) return issue ? 'none' : 'open'
  return issue ? 'close' : 'none'
}

/**
 * The failed checks of a results file: prod-check.json (`{ checks, running }`) or the smoke's
 * results.json (an array). Each `{ id, problems }`.
 */
function failedChecks(results) {
  const checks = Array.isArray(results) ? results : results?.checks ?? []
  return checks.filter((c) => !c.ok).map((c) => ({ id: c.id, problems: c.problems ?? [] }))
}

/** One paragraph on what went wrong: the checks that failed, or a timeout / crash with no failed check. */
function whatHappened({ exitCode, capMinutes, results }) {
  const failed = failedChecks(results)
  const list = failed
    .map((c) => `- **${c.id}**: ${c.problems.slice(0, 3).join('; ') || 'failed'}${c.problems.length > 3 ? ` (+${c.problems.length - 3} more)` : ''}`)
    .join('\n')
  const running = !Array.isArray(results) && results?.running ? ` while running **${results.running}**` : ''
  if (TIMED_OUT.includes(exitCode)) {
    if (!results) return `Timed out after ${capMinutes} min before the suite reported any result.`
    return failed.length
      ? `Timed out after ${capMinutes} min${running}. Failed before that:\n${list}`
      : `Timed out after ${capMinutes} min${running}, no check failed.`
  }
  if (failed.length) return `${failed.length === 1 ? 'Check' : 'Checks'} failed:\n${list}`
  return `Exited with code ${exitCode} before any check failed${running} (a crash, not a failed check: see the run log).`
}

function issueBody({ suite, exitCode, capMinutes, results, runUrl, sha, event }) {
  return [
    `The production ${SUITES[suite].name} went red (${event}, \`${sha.slice(0, 7)}\`).`,
    '',
    whatHappened({ exitCode, capMinutes, results }),
    '',
    `Run: ${runUrl} (artifacts: screenshots + \`${SUITES[suite].results}\`).`,
    '',
    `Further red runs stay quiet; this issue closes itself on the next green ${SUITES[suite].name}.`,
    marker(suite),
  ].join('\n')
}

const closeComment = ({ suite, runUrl, sha }) =>
  `The production ${SUITES[suite].name} is green again at \`${sha.slice(0, 7)}\`: ${runUrl}. Closing.`

// ---------- GitHub side ----------

function readResults(dir, suite) {
  try {
    return JSON.parse(fs.readFileSync(`${dir}/${SUITES[suite].results}`, 'utf8'))
  } catch {
    return null
  }
}

/** Called from actions/github-script; `env` carries SUITE, EXIT_CODE, CAP_MINUTES, RESULTS_DIR. */
module.exports = async function run({ github, context, core, env = process.env }) {
  const suite = env.SUITE
  if (!SUITES[suite]) throw new Error(`unknown suite "${suite}"`)
  const exitCode = Number(env.EXIT_CODE)
  const red = exitCode !== 0
  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
  const open = await github.paginate(github.rest.issues.listForRepo, { ...context.repo, state: 'open', labels: LABEL, per_page: 100 })
  const issue = ownIssue(open, suite)
  const action = decide(red, issue)
  const facts = { suite, exitCode, capMinutes: Number(env.CAP_MINUTES), results: readResults(env.RESULTS_DIR || 'e2e-results', suite), runUrl, sha: context.sha, event: context.eventName }
  if (action === 'open') {
    const created = await github.rest.issues.create({
      ...context.repo, title: SUITES[suite].title, body: issueBody(facts), labels: [LABEL, 'P1', 'type:bug'],
    })
    core.info(`opened #${created.data.number}`)
  } else if (action === 'close') {
    await github.rest.issues.createComment({ ...context.repo, issue_number: issue.number, body: closeComment(facts) })
    await github.rest.issues.update({ ...context.repo, issue_number: issue.number, state: 'closed', state_reason: 'completed' })
    core.info(`closed #${issue.number}`)
  } else {
    core.info(red ? `still red, #${issue.number} already open: no alert` : 'green, nothing open')
  }
  await core.summary
    .addHeading(`Production ${SUITES[suite].name}: ${red ? 'red' : 'green'}`, 3)
    .addRaw(red ? whatHappened(facts) : 'Every check passed.', true)
    .write()
}

module.exports.decide = decide
module.exports.ownIssue = ownIssue
module.exports.failedChecks = failedChecks
module.exports.whatHappened = whatHappened
module.exports.issueBody = issueBody
module.exports.closeComment = closeComment
module.exports.marker = marker
