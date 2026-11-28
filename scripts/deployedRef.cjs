// The commit production serves, for prod-smoke.yml's nightly parts to check out. Production deploys once a day
// (deploy.yml), so main's head is usually ahead of it: the 11-27 nightly ran main's tests (#1059's challenge limits,
// a medals-chunk wait) against the build deployed hours before them and went red on checks the deployed build never
// had (#1074). Testing the deployed commit's own smoke keeps the nightly a verdict on what players run.

const deploy = require('./deploy.cjs')

const ENV = 'Production'

// ---------- pure rule (unit-tested in deployedRef.test.ts) ----------

/**
 * The sha of the newest deployment that is serving (its newest status `success`; deploy.cjs `outcome`), or null.
 * `deployments` newest first, as GitHub lists them, `statuses[i]` the statuses of `deployments[i]`, newest first.
 */
function servingSha(deployments, statuses) {
  const i = deployments.findIndex((_, k) => deploy.outcome(statuses[k] ?? []) === 'success')
  return i < 0 ? null : deployments[i].sha
}

// ---------- the run ----------

async function run({ github, context, core }) {
  const repo = context.repo
  const deployments = (await github.rest.repos.listDeployments({ ...repo, environment: ENV, per_page: 10 })).data
  const statuses = await Promise.all(
    deployments.map(async (d) => (await github.rest.repos.listDeploymentStatuses({ ...repo, deployment_id: d.id, per_page: 10 })).data),
  )
  const sha = servingSha(deployments, statuses)
  if (sha) core.notice(`Production serves ${sha.slice(0, 7)}: the nightly runs that commit's smoke`)
  else core.warning(`No serving ${ENV} deployment found: the nightly runs main's smoke`)
  core.setOutput('sha', sha ?? 'main')
}

module.exports = run
Object.assign(module.exports, { servingSha })
