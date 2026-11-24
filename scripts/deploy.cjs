// Production deploys (deploy.yml). Vercel no longer builds every merge to main (vercel.json `git.deploymentEnabled`;
// Standard build minutes are billed from 8 Dec 2026): this deploys main's head once a day, on demand, and after every
// green CI on main while an `agent:prod-broken` issue is open, so a revert or fix still ships at once. It calls the project's
// Deploy Hook (secret VERCEL_DEPLOY_HOOK), which can only build main, rather than holding a Vercel token here, then
// waits for the GitHub deployment Vercel posts for the commit: its deployment_status starts prod-smoke.yml's check.

const ENV = 'Production'
const PROD_BROKEN = 'agent:prod-broken'
const APPEAR_MS = 5 * 60e3
const FINISH_MS = 20 * 60e3
const POLL_MS = 15e3

// ---------- pure rules (unit-tested in deploy.test.ts) ----------

/** 'success', 'failure' or 'pending' from one deployment's statuses (GitHub lists them newest first). */
function outcome(statuses) {
  const state = statuses[0]?.state
  if (state === 'success') return 'success'
  if (['failure', 'error'].includes(state)) return 'failure'
  return 'pending'
}

/**
 * Whether production already serves this commit: one of its deployments' newest status is `success`. A deployment
 * Vercel later marked `inactive` was replaced (a newer deploy or a rollback), so the commit isn't live any more.
 */
const isLive = (statusesPerDeployment) => statusesPerDeployment.some((s) => outcome(s) === 'success')

/** Why to deploy now, or null to wait for the daily run. */
function reason({ event, force, prodBroken }) {
  if (event === 'workflow_run') return prodBroken.length ? `production is broken (${prodBroken.map((i) => `#${i.number}`).join(', ')})` : null
  if (event === 'schedule') return 'the daily deploy'
  return force ? 'started by hand, forced' : 'started by hand'
}

// ---------- the run ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run({ github, context, core }) {
  const repo = context.repo
  // main's head now, not the commit that started the run: the hook builds main as it is when called.
  const sha = (await github.rest.repos.getBranch({ ...repo, branch: 'main' })).data.commit.sha
  const short = sha.slice(0, 7)
  const force = context.eventName === 'workflow_dispatch' && String(context.payload.inputs?.force) === 'true'

  const prodBroken = context.eventName === 'workflow_run'
    ? (await github.rest.issues.listForRepo({ ...repo, state: 'open', labels: PROD_BROKEN, per_page: 20 })).data.filter((i) => !i.pull_request)
    : []
  const why = reason({ event: context.eventName, force, prodBroken })
  if (!why) {
    core.notice(`${context.sha.slice(0, 7)} waits for the daily deploy (05:00 UTC) or Deploy now in the control center.`)
    return
  }

  const deploymentsOf = async (filter) =>
    (await github.rest.repos.listDeployments({ ...repo, ...filter, environment: ENV, per_page: 30 })).data
  const statusesOf = async (d) =>
    (await github.rest.repos.listDeploymentStatuses({ ...repo, deployment_id: d.id, per_page: 10 })).data

  if (!force && isLive(await Promise.all((await deploymentsOf({ sha })).map(statusesOf)))) {
    core.notice(`Production already serves ${short}: nothing to deploy.`)
    return
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK
  if (!hook) {
    core.setFailed('VERCEL_DEPLOY_HOOK is not set: create a Deploy Hook for main in the shooter-coaster Vercel project and save its URL as this repo secret.')
    return
  }
  const startedAt = Date.now()
  const res = await fetch(hook, { method: 'POST' })
  if (!res.ok) {
    core.setFailed(`The Deploy Hook answered ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return
  }
  core.info(`Deploying ${short} (${why}).`)

  let deployment = null
  while (!deployment) {
    if (Date.now() - startedAt > APPEAR_MS) {
      core.setFailed(`Vercel posted no ${ENV} deployment of ${short} to GitHub within ${APPEAR_MS / 60e3} min, so prod-smoke.yml's deploy check won't run. Check the shooter-coaster project's Deployments on Vercel.`)
      return
    }
    await sleep(POLL_MS)
    // Any new one, not only this sha's: a merge landing as the hook is called makes Vercel build that one.
    deployment = (await deploymentsOf({})).find((d) => Date.parse(d.created_at) >= startedAt - 60e3)
  }
  const built = deployment.sha.slice(0, 7)

  for (;;) {
    const statuses = await statusesOf(deployment)
    const result = outcome(statuses)
    if (result === 'success') {
      core.notice(`Production now serves ${built}: ${statuses[0].environment_url || 'https://scoaster.com'}`)
      return
    }
    if (result === 'failure') {
      core.setFailed(`Vercel's build of ${built} failed: ${statuses[0].log_url || statuses[0].target_url || 'see the Vercel dashboard'}`)
      return
    }
    if (Date.now() - startedAt > FINISH_MS) {
      core.setFailed(`The deploy of ${built} hadn't finished after ${FINISH_MS / 60e3} min.`)
      return
    }
    await sleep(POLL_MS)
  }
}

module.exports = run
Object.assign(module.exports, { outcome, isLive, reason })
